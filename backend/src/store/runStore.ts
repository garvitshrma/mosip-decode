import { nanoid } from "nanoid";
import type {
  CreateRunRequest,
  Credential,
  Run,
  RunError,
  RunStatus,
  RunSummary,
  RunKind,
  Step,
  VerificationEvidence,
  VerificationOutcome,
} from "@playground/shared";
import { db } from "./prisma";

export type OfferOperationStatus = "pending" | "succeeded" | "failed" | "unknown";

export interface OfferOperation {
  id: string;
  runId: string;
  requestFingerprint: string;
  credentialConfigurationId: string;
  format: string;
  status: OfferOperationStatus;
  offerUri?: string;
  issuerUrl?: string;
}

// Everything that touches the database goes through this file. Swapping Prisma
// for something else means rewriting only what is below.

type RunRow = {
  id: string;
  issuer: string;
  wallet: string;
  verifier: string;
  format: string;
  kind: string;
  status: string;
  verificationResult: string | null;
  verificationEvidence: string | null;
  errorStep: string | null;
  errorMessage: string | null;
  createdAt: Date;
};

type StepRow = {
  id: string;
  runId: string;
  name: string;
  stage: string;
  fromParty: string;
  toParty: string;
  requestJson: string;
  responseJson: string | null;
  httpStatus: number | null;
  ok: boolean;
  durationMs: number;
  timestamp: Date;
};

export function shouldCreateCredential(kind: string | undefined): boolean {
  return (kind ?? "workflow") === "workflow";
}

function toRunError(row: RunRow): RunError | undefined {
  if (!row.errorStep && !row.errorMessage) return undefined;
  return { step: row.errorStep ?? "unknown", message: row.errorMessage ?? "" };
}

function toStep(row: StepRow): Step {
  return {
    id: row.id,
    runId: row.runId,
    name: row.name,
    stage: row.stage as Step["stage"],
    from: row.fromParty,
    to: row.toParty,
    request: JSON.parse(row.requestJson),
    response: row.responseJson ? JSON.parse(row.responseJson) : undefined,
    httpStatus: row.httpStatus ?? undefined,
    ok: row.ok,
    durationMs: row.durationMs,
    timestamp: row.timestamp.toISOString(),
  };
}

function toRun(row: RunRow, steps: StepRow[]): Run {
  return {
    id: row.id,
    issuer: row.issuer,
    wallet: row.wallet,
    verifier: row.verifier,
    format: row.format as Run["format"],
    kind: row.kind as RunKind,
    status: row.status as RunStatus,
    verificationResult: (row.verificationResult as VerificationOutcome) ?? undefined,
    verificationEvidence: (row.verificationEvidence as VerificationEvidence) ?? undefined,
    steps: steps.map(toStep),
    error: toRunError(row),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createRun(input: CreateRunRequest): Promise<Run> {
  const row = await db().run.create({
    data: {
      id: nanoid(12),
      issuer: input.issuer,
      wallet: input.wallet,
      verifier: input.verifier,
      format: input.format,
      kind: input.kind ?? "workflow",
      status: "running",
    },
  });

  if (shouldCreateCredential(input.kind)) {
    await db().credential.create({
      data: {
        id: nanoid(16),
        runId: row.id,
        format: input.format,
        credentialJson: JSON.stringify({
          "@context": ["https://www.w3.org/2018/credentials/v1"],
          type: ["VerifiableCredential"],
          issuer: { name: input.issuer },
          holder: "Demo Holder",
          issuedAt: new Date().toISOString(),
        }),
        status: "issued",
        demo: true,
      },
    });
  }

  return toRun(row, []);
}

export async function getRun(id: string): Promise<Run | null> {
  const row = await db().run.findUnique({
    where: { id },
    include: { steps: { orderBy: { timestamp: "asc" } } },
  });
  if (!row) return null;
  const { steps, ...run } = row;
  return toRun(run, steps);
}

export interface StoredCredentialSummary {
  id: string;
  runId: string;
  type: string;
  format: string;
  status: string;
  demo: boolean;
  issuer?: string;
}

export async function listStoredCredentials(): Promise<StoredCredentialSummary[]> {
  const rows = await db().credential.findMany({
    where: { status: { not: "deleted" } },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      runId: true,
      format: true,
      status: true,
      demo: true,
      run: { select: { issuer: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    runId: row.runId,
    type: row.format === "ldp_vc" ? "VerifiableCredential" : "VerifiableCredential",
    format: row.format,
    status: row.status,
    demo: row.demo,
    issuer: row.run.issuer,
  }));
}

function toOfferOperation(row: {
  id: string;
  runId: string;
  requestFingerprint: string;
  credentialConfigurationId: string;
  format: string;
  status: string;
  offerUri: string | null;
  issuerUrl: string | null;
}): OfferOperation {
  return {
    id: row.id,
    runId: row.runId,
    requestFingerprint: row.requestFingerprint,
    credentialConfigurationId: row.credentialConfigurationId,
    format: row.format,
    status: row.status as OfferOperationStatus,
    offerUri: row.offerUri ?? undefined,
    issuerUrl: row.issuerUrl ?? undefined,
  };
}

export async function getOfferOperation(runId: string): Promise<OfferOperation | null> {
  const row = await db().offerOperation.findUnique({ where: { runId } });
  return row ? toOfferOperation(row) : null;
}

export async function createOfferOperation(input: Omit<OfferOperation, "id" | "offerUri" | "issuerUrl">): Promise<OfferOperation> {
  const row = await db().offerOperation.create({
    data: {
      id: nanoid(12),
      runId: input.runId,
      requestFingerprint: input.requestFingerprint,
      credentialConfigurationId: input.credentialConfigurationId,
      format: input.format,
      status: input.status,
    },
  });
  return toOfferOperation(row);
}

export async function updateOfferOperation(
  id: string,
  patch: {
    status: OfferOperationStatus;
    offerUri?: string;
    issuerUrl?: string;
  },
): Promise<OfferOperation> {
  const row = await db().offerOperation.update({
    where: { id },
    data: {
      status: patch.status,
      offerUri: patch.offerUri,
      issuerUrl: patch.issuerUrl,
    },
  });
  return toOfferOperation(row);
}

export async function listRuns(limit = 50): Promise<RunSummary[]> {
  const rows = (await db().run.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { _count: { select: { steps: true } } },
  })) as (RunRow & { _count: { steps: number } })[];
  return rows.map((row) => {
    const { _count, ...run } = row;
    const { steps, ...summary } = toRun(run, []);
    return { ...summary, stepCount: _count.steps };
  });
}

/** Persist a step. The id is generated here so callers do not have to. */
export async function addStep(step: Omit<Step, "id">): Promise<Step> {
  const row = await db().step.create({
    data: {
      id: nanoid(12),
      runId: step.runId,
      name: step.name,
      stage: step.stage,
      fromParty: step.from,
      toParty: step.to,
      requestJson: JSON.stringify(step.request),
      responseJson: step.response === undefined ? null : JSON.stringify(step.response),
      httpStatus: step.httpStatus ?? null,
      ok: step.ok,
      durationMs: step.durationMs,
      timestamp: new Date(step.timestamp),
    },
  });
  return toStep(row);
}

export async function addStepWhileRunning(
  step: Omit<Step, "id">,
): Promise<"not-found" | "terminal" | Step> {
  return db().$transaction(async (tx) => {
    const run = await tx.run.findUnique({
      where: { id: step.runId },
      select: { status: true },
    });
    if (!run) return "not-found";
    if (run.status !== "running") return "terminal";

    const row = await tx.step.create({
      data: {
        id: nanoid(12),
        runId: step.runId,
        name: step.name,
        stage: step.stage,
        fromParty: step.from,
        toParty: step.to,
        requestJson: JSON.stringify(step.request),
        responseJson: step.response === undefined ? null : JSON.stringify(step.response),
        httpStatus: step.httpStatus ?? null,
        ok: step.ok,
        durationMs: step.durationMs,
        timestamp: new Date(step.timestamp),
      },
    });
    return toStep(row);
  });
}

export async function updateRun(
  id: string,
  patch: {
    status: RunStatus;
    verificationResult?: VerificationOutcome;
    verificationEvidence?: VerificationEvidence;
    error?: RunError;
  }
): Promise<"updated" | "not-found" | "terminal"> {
  const result = await db().run.updateMany({
    where: { id, status: "running" },
    data: {
      status: patch.status,
      verificationResult: patch.verificationResult,
      verificationEvidence: patch.verificationEvidence,
      errorStep: patch.error?.step,
      errorMessage: patch.error?.message,
    },
  });
  if (result.count === 1) return "updated";
  const run = await db().run.findUnique({ where: { id }, select: { status: true } });
  return run ? "terminal" : "not-found";
}

export async function deleteCredential(credentialId: string): Promise<{ deleted: boolean; notFound: boolean; alreadyDeleted: boolean }> {
  const credential = await db().credential.findUnique({ where: { id: credentialId } });
  if (!credential) {
    return { deleted: false, notFound: true, alreadyDeleted: false };
  }
  if (credential.status === "deleted") {
    return { deleted: false, notFound: false, alreadyDeleted: true };
  }
  await db().credential.update({
    where: { id: credentialId },
    data: { status: "deleted" },
  });
  return { deleted: true, notFound: false, alreadyDeleted: false };
}
