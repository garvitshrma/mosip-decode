import { Router } from "express";
import { CREDENTIAL_FORMATS, type CreateRunRequest, type CredentialFormat } from "@playground/shared";
import { findIssuer, findVerifier, findWallet } from "../adapters";
import { createRun, getRun, listRuns } from "../store/runStore";
import { route } from "./async";

export const runRoutes = Router();

const formatIds = CREDENTIAL_FORMATS.map((f) => f.id);

function validate(body: Partial<CreateRunRequest>): string | undefined {
  if (!body.issuer || !findIssuer(body.issuer)) return `Unknown issuer: ${body.issuer}`;
  if (!body.wallet || !findWallet(body.wallet)) return `Unknown wallet: ${body.wallet}`;
  if (!body.verifier || !findVerifier(body.verifier)) return `Unknown verifier: ${body.verifier}`;
  if (!body.format || !formatIds.includes(body.format as CredentialFormat)) {
    return `Unknown format: ${body.format}`;
  }
  return undefined;
}

// Phase 1 records the chosen combination and stops there. No flow is executed
// and no result is invented: the adapters that run it land in Phase 3.
runRoutes.post(
  "/runs",
  route(async (req, res) => {
    const body = req.body as Partial<CreateRunRequest>;
    const problem = validate(body);
    if (problem) {
      res.status(400).json({ error: problem });
      return;
    }

    const run = await createRun(body as CreateRunRequest);
    res.status(201).json(run);
  })
);

runRoutes.get(
  "/runs",
  route(async (_req, res) => {
    res.json(await listRuns());
  })
);

runRoutes.get(
  "/runs/:id",
  route(async (req, res) => {
    const run = await getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: `No run with id ${req.params.id}` });
      return;
    }
    res.json(run);
  })
);
