import { AdapterNotImplemented, type VerifierAdapter } from "@playground/shared";
import { config } from "../config";
import { plannedNote } from "./common";

// Non-Inji verifier. External stacks may speak OpenID4VP 1.0 instead of draft 23;
// that difference is an expected interop gap and gets recorded, not hidden.
export const externalVerifier: VerifierAdapter = {
  info: {
    id: "external-verifier",
    label: "External verifier (Animo)",
    role: "verifier",
    vendor: "external",
    readiness: "planned",
    formats: ["vc+sd-jwt", "mso_mdoc"],
    note: plannedNote("External verifier", config.services.externalVerifier, "Phase 3"),
  },
  async createRequest() {
    throw new AdapterNotImplemented("external-verifier", "create a presentation request");
  },
  async getResult() {
    throw new AdapterNotImplemented("external-verifier", "read a verification result");
  },
};
