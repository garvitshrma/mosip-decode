// Shared contracts between backend and frontend.
// Everything in the playground is written against this file, so change it deliberately.

/** The three roles a component can play in a run. */
export type Role = "issuer" | "wallet" | "verifier";

/**
 * Credential formats we care about.
 * SD-JWT VC appears as both "vc+sd-jwt" and "dc+sd-jwt" in the wild
 * (Collab Certify uses "dc+sd-jwt"), so both are listed and both are accepted.
 */
export type CredentialFormat = "ldp_vc" | "vc+sd-jwt" | "dc+sd-jwt" | "mso_mdoc";

export const CREDENTIAL_FORMATS: { id: CredentialFormat; label: string }[] = [
  { id: "ldp_vc", label: "W3C VC JSON-LD (ldp_vc)" },
  { id: "vc+sd-jwt", label: "SD-JWT VC (vc+sd-jwt)" },
  { id: "dc+sd-jwt", label: "SD-JWT VC (dc+sd-jwt)" },
  { id: "mso_mdoc", label: "mDoc / mDL (mso_mdoc)" },
];

/** Which half of the lifecycle a step belongs to. */
export type Stage = "issuance" | "presentation";

/**
 * Known protocol steps. A step name is a plain string so non-protocol traffic
 * (for example a metadata probe) can be recorded too, but prefer these.
 */
export const STEP_NAMES = [
  "credential_offer",
  "issuer_metadata",
  "authorization",
  "token",
  "credential_request",
  "credential",
  "authorization_request",
  "presentation_definition",
  "vp_token",
  "verification_result",
] as const;

export type KnownStepName = (typeof STEP_NAMES)[number];
export type StepName = KnownStepName | string;

export interface HttpRequestSnapshot {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface HttpResponseSnapshot {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}

/**
 * One recorded exchange. Steps are what the Protocol Inspector renders, so the
 * raw request and response are kept as-is apart from redacted secrets.
 */
export interface Step {
  id: string;
  runId: string;
  name: StepName;
  stage: Stage;
  /** Who made the call, e.g. "playground", "wallet", "inji-certify". */
  from: string;
  /** Who received it. */
  to: string;
  request: HttpRequestSnapshot;
  response?: HttpResponseSnapshot;
  httpStatus?: number;
  ok: boolean;
  durationMs: number;
  /** ISO 8601. */
  timestamp: string;
}

export type RunStatus = "running" | "pass" | "fail";

/** The verifier's own answer, kept separate from whether the run completed. */
export type VerificationOutcome = "VALID" | "INVALID" | "EXPIRED" | "REVOKED";

export interface RunError {
  /** The step name the run died on. */
  step: StepName;
  message: string;
}

/**
 * One end-to-end interoperability attempt.
 * Phase 1 keeps this minimal on purpose; scenario, flow and tamper fields
 * arrive with the phases that need them.
 */
export interface Run {
  id: string;
  /** Adapter ids, not display names. */
  issuer: string;
  wallet: string;
  verifier: string;
  format: CredentialFormat;
  status: RunStatus;
  verificationResult?: VerificationOutcome;
  steps: Step[];
  error?: RunError;
  /** ISO 8601. */
  createdAt: string;
}

/** Body accepted by POST /api/runs. */
export interface CreateRunRequest {
  issuer: string;
  wallet: string;
  verifier: string;
  format: CredentialFormat;
}

/** Run without its steps, for list views. */
export type RunSummary = Omit<Run, "steps"> & { stepCount: number };

/** socket.io events, room name is the run id. */
export const SOCKET_EVENTS = {
  /** Client asks to follow a run. */
  subscribe: "run:subscribe",
  unsubscribe: "run:unsubscribe",
  /** Server pushes a newly recorded step. */
  step: "run:step",
  /** Server pushes the run after its status changed. */
  update: "run:update",
} as const;

export interface RunStepEvent {
  runId: string;
  step: Step;
}

export interface RunUpdateEvent {
  runId: string;
  status: RunStatus;
  verificationResult?: VerificationOutcome;
  error?: RunError;
}
