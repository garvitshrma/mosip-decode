import type { Credential, VerificationResult } from "@playground/shared";

export function verifyCredential(): VerificationResult {
  return { valid: true, message: "OK", structural: true };
}
