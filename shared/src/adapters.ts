import type { CredentialFormat, Role, Stage, StepName, VerificationOutcome } from "./types";

/** How ready an adapter is to take part in a real run. */
export type AdapterReadiness =
  | "ready"
  // code exists but a service URL is missing from env
  | "not-configured"
  // declared, implementation lands in a later phase
  | "planned";

/** What the frontend needs to render an adapter in a dropdown. */
export interface AdapterInfo {
  id: string;
  label: string;
  role: Role;
  /** "inji" or "external" - the PS cares about non-Inji interop. */
  vendor: "inji" | "external";
  readiness: AdapterReadiness;
  formats: CredentialFormat[];
  /** Shown in the UI when readiness is not "ready". */
  note?: string;
}

/** Passed to every adapter call so it can record steps against the right run. */
export interface RunContext {
  runId: string;
  format: CredentialFormat;
  record: RecordStep;
}

export interface RecordStepInput {
  name: StepName;
  stage: Stage;
  from: string;
  to: string;
  request: unknown;
  response?: unknown;
  httpStatus?: number;
  ok: boolean;
  durationMs: number;
}

export type RecordStep = (input: RecordStepInput) => Promise<void>;

/** An OpenID4VCI credential offer the holder has to act on. */
export interface CredentialOffer {
  /** openid-credential-offer:// URI, rendered as a QR or a deep link. */
  offerUri: string;
  /** Where the credential comes from, for display. */
  issuerUrl: string;
}

/** An OpenID4VP request the wallet has to answer. */
export interface PresentationRequest {
  /** openid4vp:// or request_uri, rendered as a QR or a deep link. */
  requestUri: string;
  /** Verifier-side handle used to poll for the outcome. */
  transactionId: string;
}

export interface VerificationResult {
  outcome: VerificationOutcome;
  /** Raw verifier response, shown in the inspector. */
  raw: unknown;
}

export interface IssuerAdapter {
  info: AdapterInfo;
  createOffer(ctx: RunContext): Promise<CredentialOffer>;
}

export interface WalletAdapter {
  info: AdapterInfo;
  /** Hand the offer to the holder. Real wallets show a QR and wait for the user. */
  acceptOffer(ctx: RunContext, offer: CredentialOffer): Promise<void>;
  /** Hand the presentation request to the holder. */
  presentCredential(ctx: RunContext, request: PresentationRequest): Promise<void>;
}

export interface VerifierAdapter {
  info: AdapterInfo;
  createRequest(ctx: RunContext): Promise<PresentationRequest>;
  getResult(ctx: RunContext, request: PresentationRequest): Promise<VerificationResult>;
}

export type Adapter = IssuerAdapter | WalletAdapter | VerifierAdapter;

/** Thrown by adapters that are declared but not implemented yet. Never fake a result. */
export class AdapterNotImplemented extends Error {
  constructor(adapterId: string, what: string) {
    super(`Adapter "${adapterId}" cannot ${what} yet. This lands in a later phase.`);
    this.name = "AdapterNotImplemented";
  }
}
