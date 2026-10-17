import type {
  AdapterInfo,
  CreateRunRequest,
  Credential,
  CredentialFormat,
  Run,
  RunSummary,
  VerificationResult,
  RunError,
  RunStatus,
  Step,
  VerificationEvidence,
  VerificationItemOutcome,
  VerificationOutcome,
} from "@playground/shared";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export interface AdapterCatalogue {
  issuers: AdapterInfo[];
  wallets: AdapterInfo[];
  verifiers: AdapterInfo[];
  formats: { id: CredentialFormat; label: string }[];
}

export interface VerifierConfig {
  serviceUrl: string;
  clientId: string;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}/api${path}`);
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as unknown as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as unknown as T;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}/api${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as unknown as T;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

export const api = {
  baseUrl: BASE_URL,
  health: () => get<{ ok: boolean; phase: number }>("/health"),
  adapters: () => get<AdapterCatalogue>("/adapters"),
  createRun: (body: CreateRunRequest) => post<Run>("/runs", body),
  listCredentials: () => get<Array<{
    id: string;
    runId: string;
    type: string;
    format: string;
    status: string;
    demo: boolean;
    issuer?: string;
  }>>("/credentials"),
  createOffer: (runId: string, body: {
    credentialType: string;
    issuanceFlow: "pre_authorized_code";
    claims: Record<string, unknown>;
  }) => post<{ offerUri: string; issuerUrl: string }>(`/runs/${runId}/offer`, body),
  getIssuerMetadata: (runId: string) => get<{
    issuer: string;
    credentialEndpoint: string;
    configurations: Array<{ id: string; format: string }>;
  }>(`/runs/${runId}/metadata`),
  listRuns: () => get<RunSummary[]>("/runs"),
  getRun: (id: string) => get<Run>(`/runs/${id}`),
  getCredential: (runId: string) => post<{ credential: { id: string; type: string; format: string; status: string; demo: boolean } }>(`/runs/${runId}/credential`, {}),
  validate: (body: { credentialJson: string; format: string }) => post<VerificationResult>("/validate", body),
  verifierConfig: () => get<VerifierConfig>("/verifier/config"),
  recordVerifierStep: (runId: string, body: {
    name: string;
    method: string;
    outcome?: VerificationOutcome;
    errorCode?: string;
    durationMs?: number;
    evidence: VerificationEvidence;
    itemOutcomes?: VerificationItemOutcome[];
  }) => post<Step>(`/runs/${runId}/steps`, body),
  updateRunStatus: (runId: string, body: {
    status: RunStatus;
    verificationResult?: VerificationOutcome;
    evidence: VerificationEvidence;
    error?: RunError;
  }) => patch<{ ok: boolean }>(`/runs/${runId}/status`, body),
  deleteCredential: (credentialId: string) => post<{
    success: boolean;
    message: string;
  }>(`/runs/${credentialId}/credential/delete`, {}),
};
