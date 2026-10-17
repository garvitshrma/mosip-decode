// Secrets must never reach the inspector or the database.

const SECRET_HEADERS = ["authorization", "cookie", "set-cookie", "proxy-authorization", "x-api-key"];

// Always secret, whatever shape they arrive in.
const SECRET_FIELDS = [
  "access_token",
  "refresh_token",
  "id_token",
  "client_secret",
  "pre-authorized_code",
  "claims",
  "private_key",
  "jwt",
];

// Secret only as a scalar. In OpenID4VCI "tx_code" and "proof" are objects that
// describe a requirement (length, input_mode, proof_type) and those fields are
// interop-relevant, so the object is kept and only a bare value is hidden.
const SCALAR_SECRET_FIELDS = ["code", "tx_code", "proof"];
const MAX_REDACTION_DEPTH = 6;

function isScalar(value: unknown): boolean {
  return value === null || typeof value !== "object";
}

export const REDACTED = "[redacted]";
const UNAVAILABLE = "[unavailable]";

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
export function redactBody(body: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (body === null || body === undefined) return body;
  if (depth > MAX_REDACTION_DEPTH) return UNAVAILABLE;

  if (typeof body === "string") {
    // Form-encoded bodies arrive as strings, including single-field bodies.
    if (body.includes("=")) return redactFormString(body);
    if (body.trimStart().startsWith("{") || body.trimStart().startsWith("[")) {
      try {
        return redactBody(JSON.parse(body), depth + 1, seen);
      } catch {
        return UNAVAILABLE;
      }
    }
    return body;
  }

  if (typeof body === "object") {
    if (seen.has(body)) return UNAVAILABLE;
    seen.add(body);
    if (Array.isArray(body)) return body.map((item) => redactBody(item, depth + 1, seen));

    const out: Record<string, unknown> = {};
    try {
      for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
        const normalizedKey = key.toLowerCase();
        if (SECRET_FIELDS.includes(normalizedKey)) {
          out[key] = REDACTED;
        } else if (SCALAR_SECRET_FIELDS.includes(normalizedKey) && isScalar(value)) {
          out[key] = REDACTED;
        } else {
          out[key] = redactBody(value, depth + 1, seen);
        }
      }
    } catch {
      return UNAVAILABLE;
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
      const decodedKey = decodeFormComponent(key);
      const normalizedKey = decodedKey?.toLowerCase();
      const secret = normalizedKey !== undefined
        && (SECRET_FIELDS.includes(normalizedKey) || SCALAR_SECRET_FIELDS.includes(normalizedKey));
      return secret || decodedKey === undefined ? `${key}=${REDACTED}` : [key, ...rest].join("=");
    })
    .join("&");
}

function decodeFormComponent(value: string): string | undefined {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return undefined;
  }
}
