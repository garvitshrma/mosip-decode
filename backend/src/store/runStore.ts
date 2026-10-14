import { nanoid } from "nanoid";
import type {
  CreateRunRequest,
  Run,
  RunError,
  RunStatus,
  RunSummary,
  Step,
  VerificationOutcome,
} from "@playground/shared";
import { db } from "./prisma";

// Everything that touches the database goes through this file. Swapping Prisma
// for something else means rewriting only what is below.

type RunRow = {
  id: string;
  issuer: string;
  wallet: string;
  verifier: string;
  format: string;
  status: string;
  verificationResult: string | null;
  errorStep: string | null;
  errorMessage: string | null;
  createdAt: Date;
};

type StepRow = {
  id: string;
  runId: string;
  name: string;
  stage: string;
  fromParty: string;
  toParty: string;
  requestJson: string;
  responseJson: string | null;
  httpStatus: number | null;
  ok: boolean;
  durationMs: number;
  timestamp: Date;
};

function toRunError(row: RunRow): RunError | undefined {
  if (!row.errorStep && !row.errorMessage) return undefined;
  return { step: row.errorStep ?? "unknown", message: row.errorMessage ?? "" };
}

function toStep(row: StepRow): Step {
  return {
    id: row.id,
    runId: row.runId,
    name: row.name,
    stage: row.stage as Step["stage"],
    from: row.fromParty,
    to: row.toParty,
    request: JSON.parse(row.requestJson),
    response: row.responseJson ? JSON.parse(row.responseJson) : undefined,
    httpStatus: row.httpStatus ?? undefined,
    ok: row.ok,
    durationMs: row.durationMs,
    timestamp: row.timestamp.toISOString(),
  };
}

function toRun(row: RunRow, steps: StepRow[]): Run {
  return {
    id: row.id,
    issuer: row.issuer,
    wallet: row.wallet,
    verifier: row.verifier,
    format: row.format as Run["format"],
    status: row.status as RunStatus,
    verificationResult: (row.verificationResult as VerificationOutcome) ?? undefined,
    steps: steps.map(toStep),
    error: toRunError(row),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createRun(input: CreateRunRequest): Promise<Run> {
  const row = await db().run.create({
    data: {
      id: nanoid(12),
      issuer: input.issuer,
      wallet: input.wallet,
      verifier: input.verifier,
      format: input.format,
      status: "running",
    },
  });
  return toRun(row, []);
}

export async function getRun(id: string): Promise<Run | null> {
  const row = await db().run.findUnique({
    where: { id },
    include: { steps: { orderBy: { timestamp: "asc" } } },
  });
  if (!row) return null;
  const { steps, ...run } = row;
  return toRun(run, steps);
}

export async function listRuns(limit = 50): Promise<RunSummary[]> {
  const rows = (await db().run.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { _count: { select: { steps: true } } },
  })) as (RunRow & { _count: { steps: number } })[];
  return rows.map((row) => {
    const { _count, ...run } = row;
    const { steps, ...summary } = toRun(run, []);
    return { ...summary, stepCount: _count.steps };
  });
}

/** Persist a step. The id is generated here so callers do not have to. */
export async function addStep(step: Omit<Step, "id">): Promise<Step> {
  const row = await db().step.create({
    data: {
      id: nanoid(12),
      runId: step.runId,
      name: step.name,
      stage: step.stage,
      fromParty: step.from,
      toParty: step.to,
      requestJson: JSON.stringify(step.request),
      responseJson: step.response === undefined ? null : JSON.stringify(step.response),
      httpStatus: step.httpStatus ?? null,
      ok: step.ok,
      durationMs: step.durationMs,
      timestamp: new Date(step.timestamp),
    },
  });
  return toStep(row);
}

export async function updateRun(
  id: string,
  patch: { status?: RunStatus; verificationResult?: VerificationOutcome; error?: RunError }
): Promise<void> {
  await db().run.update({
    where: { id },
    data: {
      status: patch.status,
      verificationResult: patch.verificationResult,
      errorStep: patch.error?.step,
      errorMessage: patch.error?.message,
    },
  });
}
