import type { RecordStep, RecordStepInput, Step } from "@playground/shared";
import { addStep, addStepWhileRunning } from "./store/runStore";
import { emitStep } from "./events";
import { redactBody } from "./http/redact";

/**
 * Save one step and push it to anyone watching the run.
 * This is the only way a step enters the system.
 */
export async function recordStep(runId: string, input: RecordStepInput): Promise<Step> {
  const step = await addStep({
    runId,
    name: input.name,
    stage: input.stage,
    from: input.from,
    to: input.to,
    request: redactBody(input.request) as never,
    response: input.response === undefined ? undefined : (redactBody(input.response) as never),
    httpStatus: input.httpStatus,
    ok: input.ok,
    durationMs: input.durationMs,
    timestamp: new Date().toISOString(),
  });
  emitStep({ runId, step });
  return step;
}

export async function recordStepWhileRunning(
  runId: string,
  input: RecordStepInput,
): Promise<"not-found" | "terminal" | Step> {
  const step = await addStepWhileRunning({
    runId,
    name: input.name,
    stage: input.stage,
    from: input.from,
    to: input.to,
    request: redactBody(input.request) as never,
    response: input.response === undefined ? undefined : (redactBody(input.response) as never),
    httpStatus: input.httpStatus,
    ok: input.ok,
    durationMs: input.durationMs,
    timestamp: new Date().toISOString(),
  });
  if (typeof step === "string") return step;
  emitStep({ runId, step });
  return step;
}

/** Bound recorder handed to adapters inside a RunContext. */
export function recorderFor(runId: string): RecordStep {
  return async (input) => {
    await recordStep(runId, input);
  };
}
