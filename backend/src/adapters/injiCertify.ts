import { type CredentialOfferRequest, type IssuerAdapter, type RunContext } from "@playground/shared";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { config } from "../config";
import { plannedNote } from "./common";
import { tracedRequest } from "../http/tracedClient";

export interface CredentialIssuerMetadata {
  credential_issuer: string;
  credential_endpoint: string;
  credential_configurations_supported: Record<string, CredentialConfiguration>;
  [key: string]: unknown;
}

export interface CredentialConfiguration {
  format: string;
  [key: string]: unknown;
}

export interface CertifyHttpClient {
  request(trace: {
    runId: string;
    name: "issuer_metadata" | "credential_offer";
    stage: "issuance";
    from: string;
    to: string;
  }, request: AxiosRequestConfig): Promise<Pick<AxiosResponse<unknown>, "status" | "data">>;
}

export interface InjiCertifyOptions {
  baseUrl?: string;
}

export class CredentialOfferOutcomeUnknownError extends Error {
  constructor() {
    super("Inji Certify credential offer outcome is unknown");
  }
}

const metadataPath = "/.well-known/openid-credential-issuer";
const offerPath = "/pre-authorized-data";
const DEFAULT_OFFER_EXPIRY_SECONDS = 600;
const MIN_OFFER_EXPIRY_SECONDS = 60;
const MAX_OFFER_EXPIRY_SECONDS = 86400;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateHttpUrl(value: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Certify metadata has an invalid ${field} URL`);
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) {
    throw new Error(`Certify metadata has an invalid ${field} URL`);
  }
  return value;
}

function parseMetadata(value: unknown): CredentialIssuerMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Certify issuer metadata response is not a JSON object");
  }

  const metadata = value as Record<string, unknown>;
  if (!isNonEmptyString(metadata.credential_issuer) || !isNonEmptyString(metadata.credential_endpoint)) {
    throw new Error("Certify issuer metadata is missing credential_issuer or credential_endpoint");
  }

  validateHttpUrl(metadata.credential_issuer, "credential_issuer");
  validateHttpUrl(metadata.credential_endpoint, "credential_endpoint");
  validateCredentialConfigurations(metadata.credential_configurations_supported);
  return metadata as CredentialIssuerMetadata;
}

function validateCredentialConfigurations(value: unknown): asserts value is Record<string, CredentialConfiguration> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Certify issuer metadata is missing credential_configurations_supported");
  }

  const configurations = value as Record<string, unknown>;
  if (Object.keys(configurations).length === 0) {
    throw new Error("Certify issuer metadata has no credential configurations");
  }

  for (const [id, configuration] of Object.entries(configurations)) {
    if (!id.trim() || !configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
      throw new Error("Certify issuer metadata has an invalid credential configuration");
    }

    const format = (configuration as Record<string, unknown>).format;
    if (!isNonEmptyString(format)) {
      throw new Error(`Certify issuer metadata has an invalid credential configuration: ${id}`);
    }
  }

}

function validateOfferRequest(request: CredentialOfferRequest): {
  credential_configuration_id: string;
  claims: Record<string, unknown>;
  expires_in: number;
  tx_code?: string;
} {
  if (!isNonEmptyString(request.credentialType)) {
    throw new Error("Inji Certify credential offer request is invalid");
  }
  if (!request.claims || typeof request.claims !== "object" || Array.isArray(request.claims)) {
    throw new Error("Inji Certify credential offer request is invalid");
  }

  const expiresIn = request.expiresIn ?? DEFAULT_OFFER_EXPIRY_SECONDS;
  if (!Number.isInteger(expiresIn) || expiresIn < MIN_OFFER_EXPIRY_SECONDS || expiresIn > MAX_OFFER_EXPIRY_SECONDS) {
    throw new Error("Inji Certify credential offer request is invalid");
  }
  if (request.txCode !== undefined && !/^[A-Za-z0-9]{4,8}$/.test(request.txCode)) {
    throw new Error("Inji Certify credential offer request is invalid");
  }

  return {
    credential_configuration_id: request.credentialType.trim(),
    claims: request.claims,
    expires_in: expiresIn,
    ...(request.txCode === undefined ? {} : { tx_code: request.txCode }),
  };
}

function parseOfferResponse(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Inji Certify credential offer response is invalid");
  }
  const offerUri = (value as Record<string, unknown>).credential_offer_uri;
  if (!isNonEmptyString(offerUri) || !offerUri.startsWith("openid-credential-offer://")) {
    throw new Error("Inji Certify credential offer response is invalid");
  }
  return offerUri;
}

function defaultClient(): CertifyHttpClient {
  return {
    request: (trace, request) => tracedRequest(trace, request),
  };
}

export function createInjiCertify(
  client: CertifyHttpClient = defaultClient(),
  options: InjiCertifyOptions = {},
) {
  const baseUrl = options.baseUrl ?? config.services.certify ?? config.services.certifyLocal;
  if (baseUrl) validateHttpUrl(baseUrl, "base");

  return {
    info: {
      id: "inji-certify",
      label: "Inji Certify",
      role: "issuer" as const,
      vendor: "inji" as const,
      readiness: "planned" as const,
      formats: ["ldp_vc", "vc+sd-jwt", "dc+sd-jwt"],
      note: plannedNote("Certify", baseUrl, "Phase 3"),
    },
    async discoverMetadata(ctx: RunContext): Promise<CredentialIssuerMetadata> {
      if (!baseUrl) throw new Error("Inji Certify URL is not configured");

      let response: Pick<AxiosResponse<unknown>, "status" | "data">;
      try {
        response = await client.request(
          {
            runId: ctx.runId,
            name: "issuer_metadata",
            stage: "issuance",
            from: "playground",
            to: "inji-certify",
          },
          { method: "GET", url: `${baseUrl}${metadataPath}` },
        );
      } catch {
        throw new Error("Inji Certify metadata request failed");
      }

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Inji Certify metadata request returned HTTP ${response.status}`);
      }

      return parseMetadata(response.data);
    },
    async createOffer(ctx: RunContext, request?: CredentialOfferRequest) {
      if (!request || request.issuanceFlow !== "pre_authorized_code") {
        throw new Error("Inji Certify credential offer request is invalid");
      }
      const offerRequest = validateOfferRequest(request);
      const metadata = await this.discoverMetadata(ctx);
      const configuration = metadata.credential_configurations_supported[offerRequest.credential_configuration_id];
      if (!configuration) {
        throw new Error("Inji Certify credential configuration is not supported");
      }
      if (configuration.format !== ctx.format) {
        throw new Error("Inji Certify credential configuration format is not supported");
      }

      let response: Pick<AxiosResponse<unknown>, "status" | "data">;
      try {
        response = await client.request(
          {
            runId: ctx.runId,
            name: "credential_offer",
            stage: "issuance",
            from: "playground",
            to: "inji-certify",
          },
          {
            method: "POST",
            url: `${baseUrl}${offerPath}`,
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            data: offerRequest,
          },
        );
      } catch {
        throw new CredentialOfferOutcomeUnknownError();
      }

      if (response.status < 200 || response.status >= 300) {
        if (response.status >= 500) {
          throw new CredentialOfferOutcomeUnknownError();
        }
        throw new Error(`Inji Certify credential offer request returned HTTP ${response.status}`);
      }

      let offerUri: string;
      try {
        offerUri = parseOfferResponse(response.data);
      } catch {
        throw new CredentialOfferOutcomeUnknownError();
      }

      return { offerUri, issuerUrl: metadata.credential_issuer };
    },
  } satisfies IssuerAdapter & {
    discoverMetadata(ctx: RunContext): Promise<CredentialIssuerMetadata>;
  };
}

export const injiCertify = createInjiCertify();
