import express from "express";
import cors from "cors";
import { config } from "./config";
import { adapterRoutes } from "./routes/adapters";
import { runRoutes } from "./routes/runs";
import { probeRoutes } from "./routes/probe";

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.frontendOrigin }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, phase: 1 });
  });

  app.get("/api/verifier/config", (_req, res) => {
    const { serviceUrl, clientId } = config.verifier;
    if (!serviceUrl || !clientId) {
      res.status(503).json({
        error:
          "Verifier is not configured. Set VERIFY_SERVICE_URL and VERIFY_CLIENT_ID in the backend environment.",
      });
      return;
    }
    res.json({ serviceUrl, clientId });
  });

  app.use("/api", adapterRoutes);
  app.use("/api", runRoutes);
  app.use("/api", probeRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Async route errors land here instead of killing the process.
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({ error: error.message });
  });

  return app;
}
