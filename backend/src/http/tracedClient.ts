import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type { RecordStepInput, Stage, StepName } from "@playground/shared";
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

type TraceRecorder = (runId: string, input: RecordStepInput) => Promise<unknown>;

interface TracedConfig extends InternalAxiosRequestConfig {
  trace?: TraceMeta;
  traceStart?: number;
}

export const HTTP_TIMEOUT_MS = 20_000;
export const METADATA_MAX_RESPONSE_BYTES = 256 * 1024;
export const REQUEST_MAX_BODY_BYTES = 1024 * 1024;

export function createTracedClient(record: TraceRecorder = recordStep): AxiosInstance {
  const client = axios.create({
    timeout: HTTP_TIMEOUT_MS,
    maxContentLength: METADATA_MAX_RESPONSE_BYTES,
    maxBodyLength: REQUEST_MAX_BODY_BYTES,
    maxRedirects: 0,
    // A 4xx from an issuer is a result worth recording, not an exception.
    validateStatus: () => true,
  });

  client.interceptors.request.use((config) => {
    (config as TracedConfig).traceStart = Date.now();
    return config;
  });

  client.interceptors.response.use(
    async (response) => {
      await save(record, response.config as TracedConfig, response);
      return response;
    },
    async (error) => {
      const config = error?.config as TracedConfig | undefined;
      if (config) await save(record, config, undefined, error);
      throw new Error("Traced HTTP request failed");
    },
  );

  return client;
}

const http = createTracedClient();

function classifyNetworkError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  if (code === "ECONNABORTED" || code === "ETIMEDOUT") return "timeout";
  if (code === "ERR_FR_TOO_MANY_REDIRECTS") return "redirect_rejected";
  if (code === "ERR_BAD_RESPONSE") return "invalid_response";
  if (code === "ERR_CANCELED") return "cancelled";
  return "network_error";
}

async function save(
  record: TraceRecorder,
  config: TracedConfig,
  response?: AxiosResponse,
  error?: unknown,
): Promise<void> {
  const trace = config.trace;
  if (!trace) return;

  const durationMs = Date.now() - (config.traceStart ?? Date.now());
  const failure = error ? { errorCode: classifyNetworkError(error) } : undefined;

  try {
    await record(trace.runId, {
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
  } catch {
    throw new Error("Protocol trace persistence failed");
  }
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
  return tracedRequestWith(http, trace, config);
}

export function tracedRequestWith<T = unknown>(
  client: AxiosInstance,
  trace: TraceMeta,
  config: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return client.request<T>({ ...config, trace } as AxiosRequestConfig);
}
