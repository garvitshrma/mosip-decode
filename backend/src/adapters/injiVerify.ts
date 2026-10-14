import { AdapterNotImplemented, type VerifierAdapter } from "@playground/shared";
import { config } from "../config";
import { plannedNote } from "./common";

// Inji Verify 0.18.2, OpenID4VP draft 23.
export const injiVerify: VerifierAdapter = {
  info: {
    id: "inji-verify",
    label: "Inji Verify",
    role: "verifier",
    vendor: "inji",
    readiness: "planned",
    formats: ["ldp_vc", "vc+sd-jwt", "dc+sd-jwt"],
    note: plannedNote("Inji Verify", config.services.verify, "Phase 3"),
  },
  async createRequest() {
    throw new AdapterNotImplemented("inji-verify", "create a presentation request");
  },
  async getResult() {
    throw new AdapterNotImplemented("inji-verify", "read a verification result");
  },
};
