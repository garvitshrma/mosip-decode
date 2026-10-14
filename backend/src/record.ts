import type { RecordStep, RecordStepInput } from "@playground/shared";
import { addStep } from "./store/runStore";
import { emitStep } from "./events";
import { redactBody } from "./http/redact";

/**
 * Save one step and push it to anyone watching the run.
 * This is the only way a step enters the system.
 */
export async function recordStep(runId: string, input: RecordStepInput): Promise<void> {
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
}

/** Bound recorder handed to adapters inside a RunContext. */
export function recorderFor(runId: string): RecordStep {
  return (input) => recordStep(runId, input);
}
