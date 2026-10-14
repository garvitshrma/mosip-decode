import { AdapterNotImplemented, type IssuerAdapter } from "@playground/shared";
import { config } from "../config";
import { plannedNote } from "./common";

// Non-Inji issuer, used to prove interop beyond Inji. Animo playground to start.
export const externalIssuer: IssuerAdapter = {
  info: {
    id: "external-issuer",
    label: "External issuer (Animo)",
    role: "issuer",
    vendor: "external",
    readiness: "planned",
    formats: ["vc+sd-jwt", "mso_mdoc"],
    note: plannedNote("External issuer", config.services.externalIssuer, "Phase 3"),
  },
  async createOffer() {
    throw new AdapterNotImplemented("external-issuer", "create a credential offer");
  },
};
