import axios, { type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import type { Stage, StepName } from "@playground/shared";
import { recordStep } from "../record";
import { redactBody, redactHeaders } from "./redact";

/**
 * Every outbound HTTP call the backend makes goes through this one instance.
 * If a call carries trace metadata it is recorded as a Step automatically, so
 * no adapter has to remember to log anything.
 */
export interface TraceMeta {
  runId: string;
  name: StepName;
  stage: Stage;
  from: string;
  to: string;
}

interface TracedConfig extends InternalAxiosRequestConfig {
  trace?: TraceMeta;
  traceStart?: number;
}

export const http = axios.create({
  timeout: 20000,
  // A 4xx from an issuer is a result worth recording, not an exception.
  validateStatus: () => true,
});

http.interceptors.request.use((config) => {
  (config as TracedConfig).traceStart = Date.now();
  return config;
});

http.interceptors.response.use(
  async (response) => {
    await save(response.config as TracedConfig, response);
    return response;
  },
  async (error) => {
    const config = error?.config as TracedConfig | undefined;
    if (config) await save(config, undefined, error);
    throw error;
  }
);

async function save(config: TracedConfig, response?: AxiosResponse, error?: unknown): Promise<void> {
  const trace = config.trace;
  if (!trace) return;

  const durationMs = Date.now() - (config.traceStart ?? Date.now());
  const failure = error ? { error: String((error as Error)?.message ?? error) } : undefined;

  await recordStep(trace.runId, {
    name: trace.name,
    stage: trace.stage,
    from: trace.from,
    to: trace.to,
    request: {
      method: (config.method ?? "get").toUpperCase(),
      url: fullUrl(config),
      headers: redactHeaders(config.headers),
      body: redactBody(config.data),
    },
    response: response
      ? {
          status: response.status,
          headers: redactHeaders(response.headers),
          body: redactBody(response.data),
        }
      : failure,
    httpStatus: response?.status,
    ok: Boolean(response && response.status < 400),
    durationMs,
  });
}

function fullUrl(config: AxiosRequestConfig): string {
  const base = config.baseURL ?? "";
  const path = config.url ?? "";
  return base && !path.startsWith("http") ? `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}` : path;
}

/** Make a traced request. `trace` is passed straight through to the interceptor. */
export function tracedRequest<T = unknown>(
  trace: TraceMeta,
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  return http.request<T>({ ...config, trace } as AxiosRequestConfig);
}
