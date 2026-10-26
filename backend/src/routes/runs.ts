import { Router } from "express";
import { createHash } from "node:crypto";
import {
  CREDENTIAL_FORMATS,
  type CreateRunRequest,
  type CredentialFormat,
  type RunError,
  type RunKind,
  type RunStatus,
  type StepName,
  type VerificationEvidence,
  type VerificationOutcome,
  type CredentialOffer,
  type CredentialOfferRequest,
  type IssuerAdapter,
  type Run,
} from "@playground/shared";
import { findIssuer, findVerifier, findWallet } from "../adapters";
import {
  CredentialOfferOutcomeUnknownError,
  type CredentialIssuerMetadata,
} from "../adapters/injiCertify";
import {
  createOfferOperation,
  createRun,
  getOfferOperation,
  getRun,
  listStoredCredentials,
  listRuns,
  updateOfferOperation,
  updateRun,
  deleteCredential,
} from "../store/runStore";
import { recordStep, recordStepWhileRunning, recorderFor } from "../record";
import { emitRunUpdate } from "../events";
import { validateVerifierStatusTransition } from "../verificationPolicy";
import { route } from "./async";

export const runRoutes = Router();

const formatIds = CREDENTIAL_FORMATS.map((f) => f.id);
const runStatuses: RunStatus[] = ["running", "pass", "fail"];
const verificationOutcomes: VerificationOutcome[] = ["VALID", "INVALID", "EXPIRED", "REVOKED"];
const runKinds: RunKind[] = ["workflow", "verification", "issuance"];
const verifierMethods = ["qr-upload", "qr-scan", "openid4vp"] as const;
const verifierEvents = ["verifier_started", "verification_result", "verification_error"] as const;
const issuanceOfferLocks = new Map<string, {
  fingerprint: string;
  promise: Promise<CredentialOffer>;
}>();

const DEFAULT_OFFER_EXPIRY_SECONDS = 600;
const MIN_OFFER_EXPIRY_SECONDS = 60;
const MAX_OFFER_EXPIRY_SECONDS = 86400;

export class ConcurrentOfferConflictError extends Error {
  constructor() {
    super("A different credential offer request is already in progress");
  }
}

export class OfferRecoveryRequiredError extends Error {
  constructor() {
    super("Credential offer outcome requires reconciliation");
  }
}

function canonicalize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) throw new Error("Invalid credential offer request");
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => canonicalize(item, seen));
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize((value as Record<string, unknown>)[key], seen)]),
    );
  } finally {
    seen.delete(value);
  }
}

function normalizeOfferRequest(request: CredentialOfferRequest): CredentialOfferRequest {
  if (
    !request ||
    typeof request.credentialType !== "string" ||
    request.credentialType.trim().length === 0 ||
    request.issuanceFlow !== "pre_authorized_code" ||
    !request.claims ||
    typeof request.claims !== "object" ||
    Array.isArray(request.claims)
  ) {
    throw new Error("Invalid credential offer request");
  }

  const expiresIn = request.expiresIn ?? DEFAULT_OFFER_EXPIRY_SECONDS;
  if (
    !Number.isInteger(expiresIn) ||
    expiresIn < MIN_OFFER_EXPIRY_SECONDS ||
    expiresIn > MAX_OFFER_EXPIRY_SECONDS
  ) {
    throw new Error("Invalid credential offer request");
  }
  if (request.txCode !== undefined && !/^[A-Za-z0-9]{4,8}$/.test(request.txCode)) {
    throw new Error("Invalid credential offer request");
  }

  return {
    credentialType: request.credentialType.trim(),
    issuanceFlow: "pre_authorized_code",
    claims: canonicalize(request.claims) as Record<string, unknown>,
    expiresIn,
    ...(request.txCode === undefined ? {} : { txCode: request.txCode }),
  };
}

function offerRequestFingerprint(request: CredentialOfferRequest): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(request))).digest("hex");
}

type MetadataAdapter = IssuerAdapter & {
  discoverMetadata?: (ctx: {
    runId: string;
    format: Run["format"];
    record: ReturnType<typeof recorderFor>;
  }) => Promise<CredentialIssuerMetadata>;
};

export async function discoverIssuanceMetadata(
  run: Run,
  adapter: MetadataAdapter,
): Promise<{
  issuer: string;
  credentialEndpoint: string;
  configurations: Array<{ id: string; format: string }>;
}> {
  if (run.kind !== "issuance") throw new Error("Metadata requires an issuance run");
  if (run.status !== "running") throw new Error("Metadata requires a running issuance run");
  if (!adapter.discoverMetadata) throw new Error("Issuer metadata discovery is unavailable");

  const metadata = await adapter.discoverMetadata({
    runId: run.id,
    format: run.format,
    record: recorderFor(run.id),
  });
  return {
    issuer: metadata.credential_issuer,
    credentialEndpoint: metadata.credential_endpoint,
    configurations: Object.entries(metadata.credential_configurations_supported)
      .map(([id, configuration]) => ({ id, format: configuration.format })),
  };
}

export async function createIssuanceOffer(
  run: Run,
  request: CredentialOfferRequest,
  adapter: IssuerAdapter,
  record = recorderFor(run.id),
): Promise<CredentialOffer> {
  if (run.kind !== "issuance") {
    throw new Error("Credential offers require an issuance run");
  }
  if (run.status !== "running") {
    throw new Error("Credential offer requires a running issuance run");
  }
  const normalizedRequest = normalizeOfferRequest(request);
  if (run.steps.some((step) => step.name === "credential_offer" && step.ok)) {
    throw new Error("Credential offer already created");
  }

  const existing = issuanceOfferLocks.get(run.id);
  const fingerprint = offerRequestFingerprint(normalizedRequest);
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw new ConcurrentOfferConflictError();
    return existing.promise;
  }

  const creation = adapter.createOffer({
    runId: run.id,
    format: run.format,
    record,
  }, normalizedRequest).catch((error: unknown) => {
    if (error instanceof CredentialOfferOutcomeUnknownError) throw error;
    throw new Error("Credential offer creation failed");
  });
  issuanceOfferLocks.set(run.id, { fingerprint, promise: creation });
  try {
    return await creation;
  } finally {
    if (issuanceOfferLocks.get(run.id)?.promise === creation) issuanceOfferLocks.delete(run.id);
  }
}

export async function createDurableIssuanceOffer(
  run: Run,
  request: CredentialOfferRequest,
  adapter: IssuerAdapter,
): Promise<CredentialOffer> {
    const normalizedRequest = normalizeOfferRequest(request);
    const fingerprint = offerRequestFingerprint(normalizedRequest);
    let operation = await getOfferOperation(run.id);

    if (operation) {
      if (operation.requestFingerprint !== fingerprint) {
        throw new ConcurrentOfferConflictError();
      }
      if (operation.status === "succeeded" && operation.offerUri && operation.issuerUrl) {
        throw new Error("Credential offer already created");
      }
      if (operation.status === "unknown" || operation.status === "pending") {
        if (!issuanceOfferLocks.has(run.id)) throw new OfferRecoveryRequiredError();
      }
      operation = await updateOfferOperation(operation.id, { status: "pending" });
    } else {
        try {
          operation = await createOfferOperation({
            runId: run.id,
            requestFingerprint: fingerprint,
            credentialConfigurationId: normalizedRequest.credentialType,
            format: run.format,
            status: "pending",
          });
        } catch (error) {
          const concurrentOperation = await getOfferOperation(run.id);
          if (!concurrentOperation) throw error;
          if (concurrentOperation.requestFingerprint !== fingerprint) {
            throw new ConcurrentOfferConflictError();
          }
          if (concurrentOperation.status === "unknown" || concurrentOperation.status === "pending") {
            if (!issuanceOfferLocks.has(run.id)) throw new OfferRecoveryRequiredError();
          }
          operation = await updateOfferOperation(concurrentOperation.id, { status: "pending" });
        }
      }

    try {
      const offer = await createIssuanceOffer(run, normalizedRequest, adapter);
      try {
        await updateOfferOperation(operation.id, {
          status: "succeeded",
          offerUri: offer.offerUri,
          issuerUrl: offer.issuerUrl,
        });
      } catch {
        await updateOfferOperation(operation.id, { status: "unknown" }).catch(() => undefined);
        throw new OfferRecoveryRequiredError();
      }
      return offer;
    } catch (error) {
      if (error instanceof CredentialOfferOutcomeUnknownError || error instanceof OfferRecoveryRequiredError) {
        await updateOfferOperation(operation.id, { status: "unknown" }).catch(() => undefined);
        throw new OfferRecoveryRequiredError();
      }
      await updateOfferOperation(operation.id, { status: "failed" }).catch(() => undefined);
      throw error;
  }
}

function validate(body: Partial<CreateRunRequest>): string | undefined {
  if (!body.issuer || !findIssuer(body.issuer)) return `Unknown issuer: ${body.issuer}`;
  if (!body.wallet || !findWallet(body.wallet)) return `Unknown wallet: ${body.wallet}`;
  if (!body.verifier || !findVerifier(body.verifier)) return `Unknown verifier: ${body.verifier}`;
  if (!body.format || !formatIds.includes(body.format as CredentialFormat)) {
    return `Unknown format: ${body.format}`;
  }
  if (body.kind !== undefined && !runKinds.includes(body.kind as RunKind)) {
    return `Unknown run kind: ${body.kind}`;
  }
  return undefined;
}

// Phase 1 records the chosen combination and stops there. No flow is executed
// and no result is invented: the adapters that run it land in Phase 3.
runRoutes.post(
  "/runs",
  route(async (req, res) => {
    const body = req.body as Partial<CreateRunRequest>;
    const problem = validate(body);
    if (problem) {
      res.status(400).json({ error: problem });
      return;
    }

    const run = await createRun(body as CreateRunRequest);
    res.status(201).json(run);
  })
);

runRoutes.get(
  "/runs",
  route(async (_req, res) => {
    res.json(await listRuns());
  })
);

runRoutes.get(
  "/runs/:id/metadata",
  route(async (req, res) => {
    const run = await getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: `No run with id ${req.params.id}` });
      return;
    }
    if (run.kind !== "issuance") {
      res.status(409).json({ error: "Issuer metadata requires an issuance run" });
      return;
    }
    if (run.status !== "running") {
      res.status(409).json({ error: "Issuer metadata requires a running issuance run" });
      return;
    }

    const adapter = findIssuer(run.issuer) as MetadataAdapter | undefined;
    if (!adapter) {
      res.status(400).json({ error: "Unknown issuer" });
      return;
    }

    try {
      res.json(await discoverIssuanceMetadata(run, adapter));
    } catch {
      res.status(502).json({ error: "Issuer metadata discovery failed" });
    }
  })
);

runRoutes.post(
  "/runs/:id/offer",
  route(async (req, res) => {
    const run = await getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: `No run with id ${req.params.id}` });
      return;
    }
    if (run.kind !== "issuance") {
      res.status(409).json({ error: "Credential offers require an issuance run" });
      return;
    }
    if (run.status !== "running") {
      res.status(409).json({ error: "Credential offer requires a running issuance run" });
      return;
    }

    const body = req.body as Partial<CredentialOfferRequest>;
    if (
      typeof body.credentialType !== "string" ||
      body.credentialType.trim().length === 0 ||
      body.issuanceFlow !== "pre_authorized_code" ||
      !body.claims ||
      typeof body.claims !== "object" ||
      Array.isArray(body.claims)
    ) {
      res.status(400).json({ error: "Invalid credential offer request" });
      return;
    }

    let normalizedRequest: CredentialOfferRequest;
    try {
      normalizedRequest = normalizeOfferRequest(body as CredentialOfferRequest);
    } catch {
      res.status(400).json({ error: "Invalid credential offer request" });
      return;
    }

    if (run.steps.some((step) => step.name === "credential_offer" && step.ok)) {
      res.status(409).json({ error: "Credential offer already created" });
      return;
    }

    const adapter = findIssuer(run.issuer);
    if (!adapter) {
      res.status(400).json({ error: "Unknown issuer" });
      return;
    }

    try {
      const offer = await createDurableIssuanceOffer(run, normalizedRequest, adapter);
      res.status(201).json(offer);
    } catch (error) {
      if (error instanceof ConcurrentOfferConflictError) {
        res.status(409).json({ error: "A different credential offer request is already in progress" });
        return;
      }
      if (error instanceof OfferRecoveryRequiredError) {
        res.status(409).json({ error: "Credential offer outcome requires reconciliation" });
        return;
      }
      res.status(502).json({ error: "Credential offer creation failed" });
    }
  })
);

runRoutes.post(
  "/runs/:id/steps",
  route(async (req, res) => {
    const run = await getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: `No run with id ${req.params.id}` });
      return;
    }

    const body = req.body as {
      name?: unknown;
      method?: unknown;
      outcome?: unknown;
      errorCode?: unknown;
      durationMs?: unknown;
      evidence?: unknown;
      itemOutcomes?: unknown;
    };
    if (typeof body.name !== "string" || !verifierEvents.includes(body.name as typeof verifierEvents[number])) {
      res.status(400).json({ error: "Step name is required" });
      return;
    }
    if (run.kind !== "verification") {
      res.status(409).json({ error: "Verifier steps require a verification run" });
      return;
    }
    if (run.status !== "running") {
      res.status(409).json({ error: "Run already has a terminal result" });
      return;
    }
    if (typeof body.method !== "string" || !verifierMethods.includes(body.method as typeof verifierMethods[number])) {
      res.status(400).json({ error: "Unknown verification method" });
      return;
    }
    if (body.outcome !== undefined && !verificationOutcomes.includes(body.outcome as VerificationOutcome)) {
      res.status(400).json({ error: "Unknown verification outcome" });
      return;
    }
    if (body.errorCode !== undefined && (
      typeof body.errorCode !== "string" ||
      !/^[A-Za-z0-9_.-]{1,64}$/.test(body.errorCode)
    )) {
      res.status(400).json({ error: "Step errorCode must be a string" });
      return;
    }
    if (body.evidence !== "client-reported") {
      res.status(400).json({ error: "Verifier SDK outcomes must be marked client-reported" });
      return;
    }
    if (body.name === "verification_result" && body.outcome === undefined) {
      res.status(400).json({ error: "Verification result outcome is required" });
      return;
    }
    if (body.itemOutcomes !== undefined && (
      !Array.isArray(body.itemOutcomes) ||
      body.itemOutcomes.length > 32 ||
      body.itemOutcomes.some((item) => !["VALID", "INVALID", "EXPIRED", "REVOKED", "UNKNOWN"].includes(String(item)))
    )) {
      res.status(400).json({ error: "Invalid item outcomes" });
      return;
    }
    if (body.name !== "verification_result" && body.outcome !== undefined) {
      res.status(400).json({ error: "Only verification result steps can include an outcome" });
      return;
    }
    if (body.name === "verification_error" && body.outcome !== undefined) {
      res.status(400).json({ error: "Verification errors cannot include an outcome" });
      return;
    }

    const durationMs = typeof body.durationMs === "number" && Number.isFinite(body.durationMs)
      ? Math.max(0, Math.round(body.durationMs))
      : 0;
    const outcome = body.outcome as VerificationOutcome | undefined;
    const errorCode = typeof body.errorCode === "string" ? body.errorCode.slice(0, 100) : undefined;
    const itemOutcomes = Array.isArray(body.itemOutcomes) ? body.itemOutcomes : undefined;
    const stepResult = await recordStepWhileRunning(req.params.id, {
      name: body.name as StepName,
      stage: "presentation",
      from: "verifier-ui",
      to: "run-inspector",
      request: {
        method: body.method,
        event: body.name.slice(0, 100),
        evidence: body.evidence,
        itemOutcomes,
      },
      response: {
        outcome,
        errorCode,
        evidence: body.evidence,
        itemOutcomes,
      },
      ok: outcome === "VALID" || (outcome === undefined && !errorCode),
      durationMs,
    });
    if (stepResult === "terminal") {
      res.status(409).json({ error: "Run already has a terminal result" });
      return;
    }
    if (stepResult === "not-found") {
      res.status(404).json({ error: `No run with id ${req.params.id}` });
      return;
    }
    res.status(201).json(stepResult);
  })
);

runRoutes.patch(
  "/runs/:id/status",
  route(async (req, res) => {
    const run = await getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: `No run with id ${req.params.id}` });
      return;
    }

    const body = req.body as {
      status?: unknown;
      verificationResult?: unknown;
      error?: unknown;
      evidence?: unknown;
    };
    if (!runStatuses.includes(body.status as RunStatus)) {
      res.status(400).json({ error: "Unknown run status" });
      return;
    }
    if (run.kind !== "verification") {
      res.status(409).json({ error: "Verifier status updates require a verification run" });
      return;
    }
    if (body.evidence !== "client-reported") {
      res.status(400).json({ error: "Verifier SDK outcomes must be marked client-reported" });
      return;
    }
    const transitionError = validateVerifierStatusTransition(
      run.status,
      body.status as RunStatus,
      body.verificationResult as VerificationOutcome | undefined,
    );
    if (transitionError) {
      res.status(400).json({ error: transitionError });
      return;
    }
    if (body.verificationResult !== undefined &&
        !verificationOutcomes.includes(body.verificationResult as VerificationOutcome)) {
      res.status(400).json({ error: "Unknown verification outcome" });
      return;
    }

    const errorBody = body.error as { step?: unknown; message?: unknown } | undefined;
    const error: RunError | undefined = errorBody && typeof errorBody.step === "string" && typeof errorBody.message === "string"
      ? { step: errorBody.step.slice(0, 100), message: "Verifier workflow failed" }
      : undefined;
    const verificationResult = body.verificationResult as VerificationOutcome | undefined;
    const updateResult = await updateRun(req.params.id, {
      status: body.status as RunStatus,
      verificationResult,
      verificationEvidence: body.evidence as VerificationEvidence,
      error,
    });
    if (updateResult === "terminal") {
      res.status(409).json({ error: "Run already has a terminal result" });
      return;
    }
    if (updateResult === "not-found") {
      res.status(404).json({ error: `No run with id ${req.params.id}` });
      return;
    }
    emitRunUpdate({
      runId: req.params.id,
      status: body.status as RunStatus,
      verificationResult,
      verificationEvidence: body.evidence as VerificationEvidence,
      error,
    });
    res.json({ ok: true });
  })
);

runRoutes.get(
  "/runs/:id",
  route(async (req, res) => {
    const run = await getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: `No run with id ${req.params.id}` });
      return;
    }
    res.json(run);
  })
);

// Return the most recently created run (with its credential, if any) for the wallet view.
runRoutes.get(
  "/credentials",
  route(async (_req, res) => {
    res.json(await listStoredCredentials());
  })
);

// NEW: Generate and return demo credential for a run
runRoutes.post(
  "/runs/:id/credential",
  route(async (req, res) => {
    const runId = req.params.id;
    const run = await getRun(runId);
    if (!run) {
      res.status(404).json({ error: `No run with id ${runId}` });
      return;
    }
    if (run.kind !== "workflow") {
      res.status(409).json({ error: "Demo credentials are only available for workflow runs" });
      return;
    }

    // Generate demo credential based on format
    let credentialJson: string;
    switch (run.format) {
      case "ldp_vc":
        credentialJson = JSON.stringify({
          "@context": ["https://www.w3.org/2018/credentials/v1"],
          type: ["VerifiableCredential"],
          issuer: { name: run.issuer },
          holder: "Demo Holder",
          issuedAt: new Date().toISOString(),
        });
        break;
      case "vc+sd-jwt":
      case "dc+sd-jwt":
        credentialJson = JSON.stringify({
          iss: `https://example.com/credentials/${run.id}`,
          sub: "demo-user",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400,
        });
        break;
      default:
        credentialJson = JSON.stringify({
          type: "DemoCredential",
          format: run.format,
        });
    }

    res.json({
      id: `demo-cred-${run.id}`,
      runId: run.id,
      format: run.format,
      credentialJson,
      status: "issued",
      demo: true,
    });
  })
);

// NEW: Structural validation endpoint
runRoutes.post(
  "/validate",
  route(async (req, res) => {
    const { credentialJson, format } = req.body as { credentialJson: string; format: string };

    let result: { valid: boolean; message: string; structural: boolean };

    if (format === "ldp_vc") {
      // Structural validation for W3C VC JSON-LD
      try {
        const parsed = JSON.parse(credentialJson);
        if (parsed["@context"] && Array.isArray(parsed.type)) {
          result = { valid: true, message: "Credential structural validation passed", structural: true };
        } else {
          result = { valid: false, message: "Credential missing @context or type", structural: true };
        }
      } catch {
        result = { valid: false, message: "Invalid JSON", structural: true };
      }
    } else {
      // SD-JWT and other formats: accept valid JSON as-is
      try {
        JSON.parse(credentialJson);
        result = { valid: true, message: "Credential structural validation passed", structural: true };
      } catch {
        result = { valid: false, message: "Invalid JSON", structural: true };
      }
    }

    res.json(result);
  })
);

// NEW: Delete credential endpoint
runRoutes.post(
  "/runs/:id/credential/delete",
  route(async (req, res) => {
    const credentialId = req.params.id;
    const result = await deleteCredential(credentialId);
    if (result.deleted) {
      res.json({ success: true, message: "Credential deleted successfully" });
    } else if (result.notFound) {
      res.status(404).json({ error: "Credential not found" });
    } else {
      res.status(400).json({ error: "Credential already deleted" });
    }
  })
);
