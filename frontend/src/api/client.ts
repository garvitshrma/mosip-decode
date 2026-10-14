import type {
  AdapterInfo,
  CreateRunRequest,
  CredentialFormat,
  Run,
  RunSummary,
} from "@playground/shared";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export interface AdapterCatalogue {
  issuers: AdapterInfo[];
  wallets: AdapterInfo[];
  verifiers: AdapterInfo[];
  formats: { id: CredentialFormat; label: string }[];
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}/api${path}`);
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<T>;
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
  listRuns: () => get<RunSummary[]>("/runs"),
  getRun: (id: string) => get<Run>(`/runs/${id}`),
};
