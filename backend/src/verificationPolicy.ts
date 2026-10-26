import type { RunStatus, VerificationOutcome } from "@playground/shared";

export function validateVerifierStatusTransition(
  current: RunStatus,
  requested: RunStatus,
  outcome: VerificationOutcome | undefined,
): string | undefined {
  if (current !== "running") return "Run already has a terminal result";
  if (requested === "running") return "Verifier status updates must be terminal";
  if (requested === "pass" && outcome !== "VALID") {
    return "A passing verifier run requires a VALID outcome";
  }
  return undefined;
}
