import type { VerificationOutcome } from "./types";

export type VerificationItemOutcome = VerificationOutcome | "UNKNOWN";

export interface VerificationSummary {
  outcome: VerificationOutcome | null;
  itemOutcomes: VerificationItemOutcome[];
}

export function canAcceptAttemptCallback(
  current: { id: string; finished: boolean } | null,
  callbackId: string,
): boolean {
  return current !== null && current.id === callbackId && !current.finished;
}

function fromStatus(status: unknown): VerificationItemOutcome {
  if (status === "SUCCESS") return "VALID";
  if (status === "EXPIRED") return "EXPIRED";
  if (status === "REVOKED") return "REVOKED";
  if (status === "INVALID" || status === "FAILED") return "INVALID";
  return "UNKNOWN";
}

function collect(value: unknown): VerificationItemOutcome[] {
  if (Array.isArray(value)) return value.flatMap(collect);
  if (!value || typeof value !== "object") return ["UNKNOWN"];

  const result = value as {
    verificationResponse?: unknown;
    verificationStatus?: unknown;
    vpResultStatus?: unknown;
    vcStatus?: unknown;
    vcResults?: unknown;
    allChecksSuccessful?: unknown;
  };
  if (result.verificationResponse !== undefined) return collect(result.verificationResponse);
  if (Array.isArray(result.vcResults)) return result.vcResults.flatMap(collect);
  if (result.verificationStatus !== undefined) return [fromStatus(result.verificationStatus)];
  if (result.vpResultStatus !== undefined) return [fromStatus(result.vpResultStatus)];
  if (result.vcStatus !== undefined) return [fromStatus(result.vcStatus)];
  if (typeof result.allChecksSuccessful === "boolean") {
    return [result.allChecksSuccessful ? "VALID" : "INVALID"];
  }
  return ["UNKNOWN"];
}

export function summarizeVerificationResult(value: unknown): VerificationSummary {
  const itemOutcomes = collect(value);
  if (itemOutcomes.includes("REVOKED")) return { outcome: "REVOKED", itemOutcomes };
  if (itemOutcomes.includes("EXPIRED")) return { outcome: "EXPIRED", itemOutcomes };
  if (itemOutcomes.includes("INVALID")) return { outcome: "INVALID", itemOutcomes };
  if (itemOutcomes.length > 0 && itemOutcomes.every((item) => item === "VALID")) {
    return { outcome: "VALID", itemOutcomes };
  }
  return { outcome: null, itemOutcomes };
}
