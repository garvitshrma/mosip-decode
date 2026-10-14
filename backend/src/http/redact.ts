// Secrets must never reach the inspector or the database.

const SECRET_HEADERS = ["authorization", "cookie", "set-cookie", "proxy-authorization", "x-api-key"];

// Always secret, whatever shape they arrive in.
const SECRET_FIELDS = [
  "access_token",
  "refresh_token",
  "id_token",
  "client_secret",
  "pre-authorized_code",
  "private_key",
  "jwt",
];

// Secret only as a scalar. In OpenID4VCI "tx_code" and "proof" are objects that
// describe a requirement (length, input_mode, proof_type) and those fields are
// interop-relevant, so the object is kept and only a bare value is hidden.
const SCALAR_SECRET_FIELDS = ["code", "tx_code", "proof"];

function isScalar(value: unknown): boolean {
  return value === null || typeof value !== "object";
}

export const REDACTED = "[redacted]";

export function redactHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== "object") return out;
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    out[key] = SECRET_HEADERS.includes(key.toLowerCase()) ? REDACTED : String(value);
  }
  return out;
}

/**
 * Replace known secret values but keep the shape, so the inspector still shows
 * that a token was present and where it sat in the payload.
 */
export function redactBody(body: unknown, depth = 0): unknown {
  if (depth > 6 || body === null || body === undefined) return body;

  if (typeof body === "string") {
    // Form-encoded bodies arrive as strings.
    if (body.includes("=") && body.includes("&")) return redactFormString(body);
    return body;
  }

  if (Array.isArray(body)) return body.map((item) => redactBody(item, depth + 1));

  if (typeof body === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (SECRET_FIELDS.includes(key)) {
        out[key] = REDACTED;
      } else if (SCALAR_SECRET_FIELDS.includes(key) && isScalar(value)) {
        out[key] = REDACTED;
      } else {
        out[key] = redactBody(value, depth + 1);
      }
    }
    return out;
  }

  return body;
}

function redactFormString(body: string): string {
  return body
    .split("&")
    .map((pair) => {
      const [key, ...rest] = pair.split("=");
      const secret = SECRET_FIELDS.includes(key) || SCALAR_SECRET_FIELDS.includes(key);
      return secret ? `${key}=${REDACTED}` : [key, ...rest].join("=");
    })
    .join("&");
}
