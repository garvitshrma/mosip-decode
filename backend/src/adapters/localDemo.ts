import {
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign,
  verify,
  type JsonWebKey,
  type KeyObject,
} from "node:crypto";
import type {
  AdapterInfo,
  CredentialFormat,
  IssuanceFlow,
  RecordStep,
  VerificationOutcome,
} from "@playground/shared";

/**
 * Local reference stack for the demo.
 *
 * This is intentionally NOT an Inji service. It is a small, self-contained
 * OpenID4VCI / OpenID4VP-shaped exchange that runs inside the backend so the
 * prototype can be demonstrated without Docker, Collab, ngrok or a mobile
 * wallet. Every credential and presentation is signed with real Ed25519 keys
 * and every signature is really verified; nothing here flips a status string.
 *
 * Deliberate simplifications (documented in docs/DEMO_GUIDE.md):
 * - The protocol messages are recorded as in-process exchanges, not sockets.
 * - JSON is canonicalised with sorted-key JCS-style JSON (no JSON-LD RDF
 *   canonicalisation, no remote @context resolution).
 * - SD-JWT VC is issued as a compact EdDSA JWS without disclosures.
 * - OpenID4VP uses the draft-23 Presentation Definition shape, pre-registered
 *   verifier identity, and no JAR/response encryption.
 */

export const DEMO_CREDENTIAL_TYPE = "InjiInteropDemoCredential";
export const LOCAL_DEMO_ISSUER = "local-issuer";
export const LOCAL_DEMO_WALLET = "local-wallet";
export const LOCAL_DEMO_VERIFIER = "local-verifier";

const SUPPORTED_FORMATS: CredentialFormat[] = ["ldp_vc", "vc+sd-jwt", "dc+sd-jwt"];
const VC_CONTEXT = ["https://www.w3.org/2018/credentials/v1"];
const ISSUER_BASE = "http://local.demo/issuer";
const VERIFIER_BASE = "http://local.demo/verifier";
const PRE_AUTH_GRANT = "urn:ietf:params:oauth:grant-type:pre-authorized_code";

export const localDemoAdapterInfos: {
  issuers: AdapterInfo[];
  wallets: AdapterInfo[];
  verifiers: AdapterInfo[];
} = {
  issuers: [
    {
      id: LOCAL_DEMO_ISSUER,
      label: "Local reference issuer",
      role: "issuer",
      vendor: "external",
      readiness: "ready",
      formats: SUPPORTED_FORMATS,
      note: "In-process OpenID4VCI demo issuer with real Ed25519 signatures. No external service.",
    },
  ],
  wallets: [
    {
      id: LOCAL_DEMO_WALLET,
      label: "Local reference wallet",
      role: "wallet",
      vendor: "external",
      readiness: "ready",
      formats: SUPPORTED_FORMATS,
      note: "In-process holder with its own Ed25519 key; stores the signed credential.",
    },
  ],
  verifiers: [
    {
      id: LOCAL_DEMO_VERIFIER,
      label: "Local reference verifier",
      role: "verifier",
      vendor: "external",
      readiness: "ready",
      formats: SUPPORTED_FORMATS,
      note: "In-process verifier that checks issuer, holder, nonce, audience and expiry.",
    },
  ],
};

export function isLocalDemoSelection(
  issuer: string | undefined,
  wallet: string | undefined,
  verifier: string | undefined,
): boolean {
  return issuer === LOCAL_DEMO_ISSUER && wallet === LOCAL_DEMO_WALLET && verifier === LOCAL_DEMO_VERIFIER;
}

export function supportsLocalDemoFormat(format: CredentialFormat): boolean {
  return SUPPORTED_FORMATS.includes(format);
}

export interface LocalIdentity {
  privateKey: KeyObject;
  publicKey: KeyObject;
  publicJwk: JsonWebKey;
  did: string;
}

export interface LocalSignedCredential {
  id: string;
  format: CredentialFormat;
  type: string;
  issuerDid: string;
  holderDid: string;
  issuedAt: string;
  expirationDate: string;
  /** LDP VC object, or compact SD-JWT VC string. */
  credential: Record<string, unknown> | string;
  credentialJson: string;
}

export interface VerificationCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface LocalVerification {
  outcome: VerificationOutcome;
  checks: VerificationCheck[];
}

export interface LocalPresentationRequest {
  transactionId: string;
  nonce: string;
  state: string;
  verifierDid: string;
  responseUri: string;
  presentationDefinition: Record<string, unknown>;
}

export interface LocalPresentation {
  vp: Record<string, unknown>;
  presentationSubmission: Record<string, unknown>;
}

const base64url = (value: Buffer | string): string => Buffer.from(value).toString("base64url");

/** Stable, sorted-key JSON used as the demo signing input. */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot canonicalise a non-finite number");
    return JSON.stringify(value);
  }
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : canonicalJson(item))).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  throw new Error(`Cannot canonicalise value of type ${typeof value}`);
}

export function createLocalIdentity(): LocalIdentity {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicJwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
  return {
    privateKey,
    publicKey,
    publicJwk,
    did: `did:jwk:${base64url(JSON.stringify(publicJwk))}`,
  };
}

function publicKeyFromDid(did: string): KeyObject {
  if (!did.startsWith("did:jwk:")) throw new Error("Only did:jwk is supported by the local demo");
  const jwk = JSON.parse(Buffer.from(did.slice("did:jwk:".length), "base64url").toString("utf8")) as JsonWebKey;
  return createPublicKey({ key: jwk, format: "jwk" });
}

function signJson(identity: LocalIdentity, value: unknown): string {
  return sign(null, Buffer.from(canonicalJson(value)), identity.privateKey).toString("base64url");
}

function verifyJson(publicKey: KeyObject, value: unknown, signature: string): boolean {
  try {
    return verify(null, Buffer.from(canonicalJson(value)), publicKey, Buffer.from(signature, "base64url"));
  } catch {
    return false;
  }
}

function attachProof(
  document: Record<string, unknown>,
  identity: LocalIdentity,
  proofPurpose: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const proofMeta = {
    type: "DataIntegrityProof",
    cryptosuite: "eddsa-jcs-2022",
    created: new Date().toISOString(),
    verificationMethod: identity.did,
    proofPurpose,
    ...extra,
  };
  const proofValue = signJson(identity, { document, proof: proofMeta });
  return { ...document, proof: { ...proofMeta, proofValue } };
}

function proofValueOf(document: Record<string, unknown>): string | undefined {
  const proof = document.proof;
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) return undefined;
  const value = (proof as Record<string, unknown>).proofValue;
  return typeof value === "string" ? value : undefined;
}

/** Verify a Data Integrity proof over the document and its proof metadata. */
export function verifyDataIntegrityProof(
  document: Record<string, unknown>,
  expected: { purpose?: string; challenge?: string; domain?: string },
): { ok: boolean; reason?: string } {
  const proof = document.proof;
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) {
    return { ok: false, reason: "missing proof" };
  }
  const proofRecord = proof as Record<string, unknown>;
  const { proof: _proof, ...unsigned } = document;
  const { proofValue, ...proofMeta } = proofRecord;
  if (typeof proofValue !== "string" || !proofValue) return { ok: false, reason: "missing proofValue" };
  if (proofMeta.cryptosuite !== "eddsa-jcs-2022") return { ok: false, reason: "unsupported cryptosuite" };
  if (expected.purpose && proofMeta.proofPurpose !== expected.purpose) {
    return { ok: false, reason: "unexpected proof purpose" };
  }
  if (expected.challenge !== undefined && proofMeta.challenge !== expected.challenge) {
    return { ok: false, reason: "presentation challenge does not match the request nonce" };
  }
  if (expected.domain !== undefined && proofMeta.domain !== expected.domain) {
    return { ok: false, reason: "presentation domain does not match the verifier" };
  }
  const verificationMethod = proofMeta.verificationMethod;
  if (typeof verificationMethod !== "string") return { ok: false, reason: "missing verificationMethod" };
  let key: KeyObject;
  try {
    key = publicKeyFromDid(verificationMethod);
  } catch {
    return { ok: false, reason: "unsupported verificationMethod" };
  }
  const valid = verifyJson(key, { document: unsigned, proof: proofMeta }, proofValue);
  return valid ? { ok: true } : { ok: false, reason: "signature verification failed" };
}

export function signCompactJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  identity: LocalIdentity,
): string {
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = sign(null, Buffer.from(signingInput), identity.privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

export function verifyCompactJwt(jwt: string): {
  ok: boolean;
  header?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  reason?: string;
} {
  const parts = jwt.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed compact JWT" };
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as Record<string, unknown>;
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "malformed compact JWT" };
  }
  if (header.alg !== "EdDSA") return { ok: false, reason: "unsupported signature algorithm" };
  const jwk = header.jwk;
  if (jwk && typeof jwk === "object") {
    try {
      const key = createPublicKey({ key: jwk as JsonWebKey, format: "jwk" });
      const valid = verify(
        null,
        Buffer.from(`${encodedHeader}.${encodedPayload}`),
        key,
        Buffer.from(encodedSignature, "base64url"),
      );
      return valid ? { ok: true, header, payload } : { ok: false, reason: "signature verification failed" };
    } catch {
      return { ok: false, reason: "invalid public JWK" };
    }
  }
  const kid = header.kid;
  if (typeof kid === "string" && kid.startsWith("did:jwk:")) {
    try {
      const key = publicKeyFromDid(kid);
      const valid = verify(
        null,
        Buffer.from(`${encodedHeader}.${encodedPayload}`),
        key,
        Buffer.from(encodedSignature, "base64url"),
      );
      return valid ? { ok: true, header, payload } : { ok: false, reason: "signature verification failed" };
    } catch {
      return { ok: false, reason: "invalid signing key" };
    }
  }
  return { ok: false, reason: "no verifiable signing key" };
}

export function createCredentialRequestProof(
  holder: LocalIdentity,
  audience: string,
  nonce: string,
): string {
  return signCompactJwt(
    { alg: "EdDSA", typ: "openid4vci-proof+jwt", jwk: holder.publicJwk },
    {
      iss: holder.did,
      aud: audience,
      iat: Math.floor(Date.now() / 1000),
      nonce,
    },
    holder,
  );
}

export function verifyCredentialRequestProof(
  jwt: string,
  expectedAudience: string,
  expectedNonce: string,
): { ok: boolean; holderDid?: string; reason?: string } {
  const parsed = verifyCompactJwt(jwt);
  if (!parsed.ok || !parsed.header || !parsed.payload) return { ok: false, reason: parsed.reason };
  if (parsed.header.typ !== "openid4vci-proof+jwt") return { ok: false, reason: "unexpected proof type" };
  if (parsed.payload.aud !== expectedAudience) return { ok: false, reason: "proof audience mismatch" };
  if (parsed.payload.nonce !== expectedNonce) return { ok: false, reason: "proof nonce mismatch" };
  const iat = parsed.payload.iat;
  if (typeof iat !== "number" || Math.abs(Math.floor(Date.now() / 1000) - iat) > 300) {
    return { ok: false, reason: "proof is stale" };
  }
  const jwk = parsed.header.jwk;
  if (!jwk || typeof jwk !== "object") return { ok: false, reason: "proof has no holder key" };
  const did = `did:jwk:${base64url(JSON.stringify(jwk))}`;
  return { ok: true, holderDid: did };
}

export function issueLocalCredential(input: {
  format: CredentialFormat;
  issuer: LocalIdentity;
  holder: LocalIdentity;
  claims?: Record<string, unknown>;
  credentialType?: string;
  issuedAt?: Date;
  expiresAt?: Date;
}): LocalSignedCredential {
  if (!SUPPORTED_FORMATS.includes(input.format)) {
    throw new Error(`The local demo cannot issue the ${input.format} format`);
  }
  const credentialType = input.credentialType ?? DEMO_CREDENTIAL_TYPE;
  const issuedAt = input.issuedAt ?? new Date();
  const expiresAt = input.expiresAt ?? new Date(issuedAt.getTime() + 365 * 24 * 60 * 60 * 1000);
  const claims = {
    fullName: "Asha Rao",
    program: "MOSIP Decode 2026",
    credentialPurpose: "Interoperability playground demo",
    ...input.claims,
  };

  if (input.format === "ldp_vc") {
    const credential = attachProof(
      {
        "@context": VC_CONTEXT,
        id: `urn:uuid:${randomUUID()}`,
        type: ["VerifiableCredential", credentialType],
        issuer: input.issuer.did,
        issuanceDate: issuedAt.toISOString(),
        expirationDate: expiresAt.toISOString(),
        credentialSubject: {
          id: input.holder.did,
          ...claims,
        },
      },
      input.issuer,
      "assertionMethod",
    );
    return {
      id: String(credential.id),
      format: input.format,
      type: credentialType,
      issuerDid: input.issuer.did,
      holderDid: input.holder.did,
      issuedAt: issuedAt.toISOString(),
      expirationDate: expiresAt.toISOString(),
      credential,
      credentialJson: JSON.stringify(credential),
    };
  }

  const jwt = signCompactJwt(
    { alg: "EdDSA", typ: "vc+sd-jwt", kid: input.issuer.did },
    {
      iss: input.issuer.did,
      sub: input.holder.did,
      iat: Math.floor(issuedAt.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
      vct: credentialType,
      ...claims,
    },
    input.issuer,
  );
  return {
    id: `urn:uuid:${randomUUID()}`,
    format: input.format,
    type: credentialType,
    issuerDid: input.issuer.did,
    holderDid: input.holder.did,
    issuedAt: issuedAt.toISOString(),
    expirationDate: expiresAt.toISOString(),
    credential: jwt,
    credentialJson: jwt,
  };
}

export function verifyLocalCredential(
  credential: LocalSignedCredential,
  expectedIssuerDid: string,
): LocalVerification {
  const checks: VerificationCheck[] = [];
  const add = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, ...(detail ? { detail } : {}) });

  if (credential.format === "ldp_vc") {
    const document = credential.credential;
    if (!document || typeof document !== "object" || Array.isArray(document)) {
      return { outcome: "INVALID", checks: [{ name: "credential shape", ok: false, detail: "not a JSON object" }] };
    }
    const record = document as Record<string, unknown>;
    const signature = verifyDataIntegrityProof(record, { purpose: "assertionMethod" });
    add("issuer signature", signature.ok, signature.reason);
    add("issuer identity", record.issuer === expectedIssuerDid, "credential issuer must match the configured issuer");
    const proofRecord = record.proof && typeof record.proof === "object" && !Array.isArray(record.proof)
      ? (record.proof as Record<string, unknown>)
      : undefined;
    const issuerKeyBinding = proofRecord?.verificationMethod === expectedIssuerDid;
    add("issuer key binding", issuerKeyBinding, "the proof key DID must match the issuer DID");
    const types = Array.isArray(record.type) ? record.type : [];
    add("credential type", types.includes(DEMO_CREDENTIAL_TYPE), `expected ${DEMO_CREDENTIAL_TYPE}`);
    const expiration = typeof record.expirationDate === "string" ? Date.parse(record.expirationDate) : NaN;
    const notExpired = Number.isFinite(expiration) && expiration > Date.now();
    add("not expired", notExpired, "expirationDate must be in the future");
    const subject = record.credentialSubject;
    add(
      "holder binding",
      Boolean(subject && typeof subject === "object" && (subject as Record<string, unknown>).id === credential.holderDid),
      "credentialSubject.id must be the holder DID",
    );
    if (!signature.ok || record.issuer !== expectedIssuerDid || !issuerKeyBinding || !types.includes(DEMO_CREDENTIAL_TYPE)) {
      return { outcome: "INVALID", checks };
    }
    if (!notExpired) return { outcome: "EXPIRED", checks };
    return { outcome: "VALID", checks };
  }

  const parsed = verifyCompactJwt(String(credential.credential));
  add("issuer signature", parsed.ok, parsed.reason);
  if (!parsed.ok || !parsed.payload) return { outcome: "INVALID", checks };
  add("issuer identity", parsed.payload.iss === expectedIssuerDid, "iss must match the configured issuer");
  add("issuer key binding", parsed.header?.kid === expectedIssuerDid, "kid must match the issuer DID");
  add("credential type", parsed.payload.vct === DEMO_CREDENTIAL_TYPE, `expected vct ${DEMO_CREDENTIAL_TYPE}`);
  add("holder binding", parsed.payload.sub === credential.holderDid, "sub must be the holder DID");
  const expiration = typeof parsed.payload.exp === "number" ? parsed.payload.exp * 1000 : NaN;
  const notExpired = Number.isFinite(expiration) && expiration > Date.now();
  add("not expired", notExpired, "exp must be in the future");
  if (
    parsed.header?.kid !== expectedIssuerDid ||
    parsed.payload.iss !== expectedIssuerDid ||
    parsed.payload.vct !== DEMO_CREDENTIAL_TYPE
  ) {
    return { outcome: "INVALID", checks };
  }
  if (!notExpired) return { outcome: "EXPIRED", checks };
  return { outcome: "VALID", checks };
}

export function createLocalVerifierRequest(
  verifier: LocalIdentity,
  credentialType = DEMO_CREDENTIAL_TYPE,
): LocalPresentationRequest {
  const transactionId = randomUUID();
  return {
    transactionId,
    nonce: randomBytes(18).toString("base64url"),
    state: randomBytes(18).toString("base64url"),
    verifierDid: verifier.did,
    responseUri: `${VERIFIER_BASE}/vp-submission/direct-post`,
    presentationDefinition: {
      id: `pd-${transactionId}`,
      name: "MOSIP Decode interoperability demo",
      purpose: "Prove you hold a valid demo credential",
      input_descriptors: [
        {
          id: "demo-credential",
          name: credentialType,
          purpose: "A signed credential issued by the local reference issuer",
          format: {
            ldp_vc: { proof_type: ["DataIntegrityProof"] },
            "vc+sd-jwt": { alg: ["EdDSA"] },
          },
          constraints: {
            fields: [
              {
                path: ["$.type", "$.vct"],
                filter: { type: "string", pattern: credentialType },
              },
              {
                path: ["$.credentialSubject.fullName", "$.fullName"],
                intent_to_retain: false,
              },
            ],
          },
        },
      ],
    },
  };
}

export function createLocalPresentation(
  holder: LocalIdentity,
  credential: LocalSignedCredential,
  request: LocalPresentationRequest,
): LocalPresentation {
  const vp = attachProof(
    {
      "@context": VC_CONTEXT,
      type: ["VerifiablePresentation"],
      holder: holder.did,
      verifiableCredential: [credential.credential],
    },
    holder,
    "authentication",
    { challenge: request.nonce, domain: request.verifierDid },
  );
  return {
    vp,
    presentationSubmission: {
      id: `submission-${request.transactionId}`,
      definition_id: request.presentationDefinition.id,
      descriptor_map: [
        {
          id: "demo-credential",
          format: "ldp_vp",
          path: "$",
          path_nested: {
            format: credential.format,
            path: "$.verifiableCredential[0]",
          },
        },
      ],
    },
  };
}

export function verifyLocalPresentation(input: {
  presentation: LocalPresentation;
  request: LocalPresentationRequest;
  expectedIssuerDid: string;
}): LocalVerification {
  const checks: VerificationCheck[] = [];
  const add = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, ...(detail ? { detail } : {}) });
  const { vp, presentationSubmission } = input.presentation;

  const holder = typeof vp.holder === "string" ? vp.holder : undefined;
  add("holder identity", Boolean(holder), "VP must name a holder");
  const proof = verifyDataIntegrityProof(vp, {
    purpose: "authentication",
    challenge: input.request.nonce,
    domain: input.request.verifierDid,
  });
  add("holder signature", proof.ok, proof.reason);
  const proofRecord = vp.proof && typeof vp.proof === "object" && !Array.isArray(vp.proof)
    ? (vp.proof as Record<string, unknown>)
    : undefined;
  const holderKeyBinding = Boolean(holder && proofRecord?.verificationMethod === holder);
  add("holder key binding", holderKeyBinding, "VP holder must control the signing key");
  add(
    "presentation submission",
    presentationSubmission.definition_id === input.request.presentationDefinition.id,
    "definition_id must match the request",
  );

  const credentials = vp.verifiableCredential;
  const raw = Array.isArray(credentials) ? credentials[0] : undefined;
  if (raw === undefined) {
    add("credential present", false, "VP contains no credential");
    return { outcome: "INVALID", checks };
  }
  add("credential present", true);

  const credential: LocalSignedCredential = {
    id: "presented",
    format: typeof raw === "string" ? "vc+sd-jwt" : "ldp_vc",
    type: DEMO_CREDENTIAL_TYPE,
    issuerDid: input.expectedIssuerDid,
    holderDid: holder ?? "",
    issuedAt: new Date().toISOString(),
    expirationDate: "",
    credential: raw as Record<string, unknown> | string,
    credentialJson: typeof raw === "string" ? raw : JSON.stringify(raw),
  };
  const credentialVerification = verifyLocalCredential(credential, input.expectedIssuerDid);
  checks.push(...credentialVerification.checks);

  if (!proof.ok || !holder || !holderKeyBinding) return { outcome: "INVALID", checks };
  if (credentialVerification.outcome === "EXPIRED") return { outcome: "EXPIRED", checks };
  if (credentialVerification.outcome !== "VALID") return { outcome: "INVALID", checks };
  return { outcome: "VALID", checks };
}

export interface LocalDemoExecution {
  outcome: VerificationOutcome;
  credential: LocalSignedCredential;
  checks: VerificationCheck[];
}

interface DemoStepInput {
  name: string;
  stage: "issuance" | "presentation";
  from: string;
  to: string;
  request: unknown;
  response?: unknown;
  httpStatus?: number;
  ok?: boolean;
  durationMs?: number;
}

function recordDemoStep(record: RecordStep, input: DemoStepInput): Promise<void> {
  return record({
    name: input.name,
    stage: input.stage,
    from: input.from,
    to: input.to,
    request: input.request,
    response: input.response,
    httpStatus: input.httpStatus,
    ok: input.ok ?? (input.httpStatus === undefined || (input.httpStatus >= 200 && input.httpStatus < 300)),
    durationMs: input.durationMs ?? 0,
  });
}

/** Issuer identity is reused for the process so the demo has a stable issuer. */
let demoIssuer: LocalIdentity | undefined;

function getDemoIssuer(): LocalIdentity {
  demoIssuer ??= createLocalIdentity();
  return demoIssuer;
}

/**
 * Run the complete issue -> hold -> present -> verify path.
 * The caller is responsible for persisting the returned credential and the
 * final run status. All protocol steps are recorded through `record`.
 */
export async function executeLocalDemo(input: {
  runId: string;
  format: CredentialFormat;
  flow?: IssuanceFlow;
  record: RecordStep;
}): Promise<LocalDemoExecution> {
  if (!supportsLocalDemoFormat(input.format)) {
    throw new Error(`The local demo does not support ${input.format}`);
  }
  const flow = input.flow ?? "pre_authorized_code";
  const issuer = getDemoIssuer();
  const holder = createLocalIdentity();
  const verifier = createLocalIdentity();
  const { record } = input;

  const metadata = {
    credential_issuer: ISSUER_BASE,
    credential_endpoint: `${ISSUER_BASE}/credential`,
    authorization_servers: [ISSUER_BASE],
    credential_configurations_supported: {
      [DEMO_CREDENTIAL_TYPE]: {
        format: input.format,
        scope: "inji-interop-demo",
        cryptographic_binding_methods_supported: ["did:jwk"],
        credential_signing_alg_values_supported: ["EdDSA"],
        proof_types_supported: { jwt: { proof_signing_alg_values_supported: ["EdDSA"] } },
      },
    },
    grants_supported: [PRE_AUTH_GRANT, "authorization_code"],
  };

  let started = Date.now();
  await recordDemoStep(record, {
    name: "issuer_metadata",
    stage: "issuance",
    from: LOCAL_DEMO_WALLET,
    to: LOCAL_DEMO_ISSUER,
    request: {
      method: "GET",
      url: `${ISSUER_BASE}/.well-known/openid-credential-issuer`,
      headers: { accept: "application/json" },
    },
    response: { status: 200, headers: { "content-type": "application/json" }, body: metadata },
    httpStatus: 200,
    durationMs: Date.now() - started,
  });

  const offerId = randomUUID();
  const preAuthorizedCode = randomBytes(24).toString("base64url");
  const authorizationCode = randomBytes(24).toString("base64url");
  const issuerState = randomBytes(18).toString("base64url");
  const offerUri = `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(
    `${ISSUER_BASE}/credential-offer-data/${offerId}`,
  )}`;
  started = Date.now();
  await recordDemoStep(record, {
    name: "credential_offer",
    stage: "issuance",
    from: LOCAL_DEMO_ISSUER,
    to: LOCAL_DEMO_WALLET,
    request: {
      method: "POST",
      url: `${ISSUER_BASE}/${flow === "pre_authorized_code" ? "pre-authorized-data" : "credential-offer"}`,
      headers: { "content-type": "application/json" },
      body: {
        credential_configuration_id: DEMO_CREDENTIAL_TYPE,
        claims: {},
        expires_in: 300,
      },
    },
    response: {
      status: 200,
      headers: { "content-type": "application/json" },
      body: {
        credential_offer_uri: offerUri,
        expires_in: 300,
        grants:
          flow === "pre_authorized_code"
            ? { [PRE_AUTH_GRANT]: { "pre-authorized_code": "[redacted]" } }
            : { authorization_code: { authorization_server: ISSUER_BASE } },
      },
    },
    httpStatus: 200,
    durationMs: Date.now() - started,
  });

  if (flow === "authorization_code") {
    started = Date.now();
    await recordDemoStep(record, {
      name: "authorization",
      stage: "issuance",
      from: LOCAL_DEMO_WALLET,
      to: LOCAL_DEMO_ISSUER,
      request: {
        method: "GET",
        url: `${ISSUER_BASE}/authorize?client_id=local-wallet&response_type=code&scope=inji-interop-demo&issuer_state=${issuerState}&redirect_uri=${encodeURIComponent(
          "http://local.demo/wallet/callback",
        )}`,
        headers: { accept: "text/html" },
      },
      response: {
        status: 302,
        headers: { location: "http://local.demo/wallet/callback?code=[redacted]&state=demo" },
        body: { authorized: true, subject: "Asha Rao", consent: "demo-user-approved" },
      },
      httpStatus: 302,
      ok: true,
      durationMs: Date.now() - started,
    });
  }

  const accessToken = randomBytes(32).toString("base64url");
  const cNonce = randomBytes(18).toString("base64url");
  started = Date.now();
  await recordDemoStep(record, {
    name: "token",
    stage: "issuance",
    from: LOCAL_DEMO_WALLET,
    to: LOCAL_DEMO_ISSUER,
    request: {
      method: "POST",
      url: `${ISSUER_BASE}/oauth/token`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body:
        flow === "pre_authorized_code"
          ? { grant_type: PRE_AUTH_GRANT, "pre-authorized_code": preAuthorizedCode }
          : {
              grant_type: "authorization_code",
              code: authorizationCode,
              redirect_uri: "http://local.demo/wallet/callback",
            },
    },
    response: {
      status: 200,
      headers: { "content-type": "application/json" },
      body: {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 300,
        c_nonce: cNonce,
        c_nonce_expires_in: 300,
      },
    },
    httpStatus: 200,
    durationMs: Date.now() - started,
  });

  const proofJwt = createCredentialRequestProof(holder, ISSUER_BASE, cNonce);
  const proofCheck = verifyCredentialRequestProof(proofJwt, ISSUER_BASE, cNonce);
  if (!proofCheck.ok || proofCheck.holderDid !== holder.did) {
    throw new Error(`Local demo proof verification failed: ${proofCheck.reason ?? "holder mismatch"}`);
  }
  started = Date.now();
  const credential = issueLocalCredential({
    format: input.format,
    issuer,
    holder,
    claims: {
      fullName: "Asha Rao",
      program: "MOSIP Decode 2026",
      credentialPurpose: "Interoperability playground demo",
    },
  });
  await recordDemoStep(record, {
    name: "credential_request",
    stage: "issuance",
    from: LOCAL_DEMO_WALLET,
    to: LOCAL_DEMO_ISSUER,
    request: {
      method: "POST",
      url: `${ISSUER_BASE}/credential`,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: {
        format: input.format,
        credential_configuration_id: DEMO_CREDENTIAL_TYPE,
        proof: { proof_type: "jwt", jwt: proofJwt },
      },
    },
    response: {
      status: 200,
      headers: { "content-type": "application/json" },
      body: { credential: credential.credential, format: input.format },
    },
    httpStatus: 200,
    durationMs: Date.now() - started,
  });

  const credentialCheck = verifyLocalCredential(credential, issuer.did);
  started = Date.now();
  await recordDemoStep(record, {
    name: "credential",
    stage: "issuance",
    from: LOCAL_DEMO_WALLET,
    to: LOCAL_DEMO_WALLET,
    request: {
      action: "verify_and_store_credential",
      issuer: issuer.did,
      holder: holder.did,
      format: input.format,
    },
    response: {
      stored: credentialCheck.outcome === "VALID",
      outcome: credentialCheck.outcome,
      checks: credentialCheck.checks,
      credentialId: credential.id,
    },
    httpStatus: 200,
    ok: credentialCheck.outcome === "VALID",
    durationMs: Date.now() - started,
  });
  if (credentialCheck.outcome !== "VALID") {
    return { outcome: credentialCheck.outcome, credential, checks: credentialCheck.checks };
  }

  const request = createLocalVerifierRequest(verifier);
  started = Date.now();
  await recordDemoStep(record, {
    name: "authorization_request",
    stage: "presentation",
    from: LOCAL_DEMO_VERIFIER,
    to: LOCAL_DEMO_WALLET,
    request: {
      method: "POST",
      url: `${VERIFIER_BASE}/vp-request`,
      headers: { "content-type": "application/json" },
      body: {
        client_id: verifier.did,
        response_type: "vp_token",
        response_mode: "direct_post",
        response_uri: request.responseUri,
        nonce: request.nonce,
        state: request.state,
        presentation_definition: request.presentationDefinition,
      },
    },
    response: {
      status: 201,
      headers: { "content-type": "application/json" },
      body: {
        transactionId: request.transactionId,
        requestUri: `openid4vp://?request_uri=${encodeURIComponent(
          `${VERIFIER_BASE}/vp-request/${request.transactionId}`,
        )}`,
        expires_in: 300,
      },
    },
    httpStatus: 201,
    durationMs: Date.now() - started,
  });

  await recordDemoStep(record, {
    name: "presentation_definition",
    stage: "presentation",
    from: LOCAL_DEMO_VERIFIER,
    to: LOCAL_DEMO_WALLET,
    request: { transactionId: request.transactionId, client_id: verifier.did },
    response: {
      status: 200,
      headers: { "content-type": "application/json" },
      body: {
        nonce: request.nonce,
        state: request.state,
        presentation_definition: request.presentationDefinition,
      },
    },
    httpStatus: 200,
  });

  started = Date.now();
  const presentation = createLocalPresentation(holder, credential, request);
  await recordDemoStep(record, {
    name: "vp_token",
    stage: "presentation",
    from: LOCAL_DEMO_WALLET,
    to: LOCAL_DEMO_VERIFIER,
    request: {
      method: "POST",
      url: request.responseUri,
      headers: { "content-type": "application/json" },
      body: {
        vp_token: presentation.vp,
        presentation_submission: presentation.presentationSubmission,
        state: request.state,
      },
    },
    response: {
      status: 200,
      headers: { "content-type": "application/json" },
      body: { redirect_uri: `${VERIFIER_BASE}/vp-result/${request.transactionId}` },
    },
    httpStatus: 200,
    durationMs: Date.now() - started,
  });

  started = Date.now();
  const verification = verifyLocalPresentation({
    presentation,
    request,
    expectedIssuerDid: issuer.did,
  });
  await recordDemoStep(record, {
    name: "verification_result",
    stage: "presentation",
    from: LOCAL_DEMO_VERIFIER,
    to: "playground",
    request: {
      method: "GET",
      url: `${VERIFIER_BASE}/vp-result/${request.transactionId}`,
      headers: { accept: "application/json" },
    },
    response: {
      status: 200,
      headers: { "content-type": "application/json" },
      body: {
        transactionId: request.transactionId,
        vpResultStatus: verification.outcome === "VALID" ? "SUCCESS" : "FAILED",
        outcome: verification.outcome,
        checks: verification.checks,
        issuer: issuer.did,
        credentialType: credential.type,
      },
    },
    httpStatus: 200,
    ok: verification.outcome === "VALID",
    durationMs: Date.now() - started,
  });

  return { outcome: verification.outcome, credential, checks: verification.checks };
}
