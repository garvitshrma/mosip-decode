import { Router } from "express";
import { config, type ServiceName } from "../config";
import { getRun } from "../store/runStore";
import { tracedRequest } from "../http/tracedClient";
import { route } from "./async";

export const probeRoutes = Router();

// Smallest real use of the traced client: fetch a configured service's OpenID
// metadata and record it as a Step, so tracing and the inspector are exercised
// by genuine traffic in Phase 1. It issues nothing and invents no results.
const METADATA_PATHS: Partial<Record<ServiceName, string>> = {
  certify: "/.well-known/openid-credential-issuer",
  certifyLocal: "/.well-known/openid-credential-issuer",
  externalIssuer: "/.well-known/openid-credential-issuer",
  verify: "/.well-known/openid-configuration",
  externalVerifier: "/.well-known/openid-configuration",
};

probeRoutes.post(
  "/runs/:id/probe",
  route(async (req, res) => {
    const run = await getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: `No run with id ${req.params.id}` });
      return;
    }

    const target = String(req.query.target ?? "") as ServiceName;
    const path = METADATA_PATHS[target];
    const baseUrl = config.services[target];

    if (!path) {
      res.status(400).json({
        error: `Cannot probe "${target}". Known targets: ${Object.keys(METADATA_PATHS).join(", ")}`,
      });
      return;
    }
    if (!baseUrl) {
      res.status(400).json({ error: `${target} has no URL in .env, so there is nothing to probe.` });
      return;
    }

    try {
      const response = await tracedRequest(
        {
          runId: run.id,
          name: "issuer_metadata",
          stage: "issuance",
          from: "playground",
          to: target,
        },
        { method: "GET", url: `${baseUrl}${path}` }
      );
      res.json({ probed: target, httpStatus: response.status });
    } catch (error) {
      res.status(502).json({ error: `Probe of ${target} failed: ${(error as Error).message}` });
    }
  })
);
