import "dotenv/config";

// Rule 6: no service URL is ever hardcoded, everything comes from env.
function url(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value.replace(/\/+$/, "") : undefined;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  publicBaseUrl: url("PUBLIC_BASE_URL"),
  services: {
    certify: url("CERTIFY_BASE_URL"),
    certifyLocal: url("CERTIFY_LOCAL_BASE_URL"),
    mimoto: url("MIMOTO_BASE_URL"),
    injiWeb: url("INJI_WEB_BASE_URL"),
    verify: url("VERIFY_BASE_URL"),
    externalIssuer: url("EXTERNAL_ISSUER_BASE_URL"),
    externalVerifier: url("EXTERNAL_VERIFIER_BASE_URL"),
  },
  verifier: {
    serviceUrl: url("VERIFY_SERVICE_URL"),
    clientId: url("VERIFY_CLIENT_ID"),
  },
};

export type ServiceName = keyof typeof config.services;
