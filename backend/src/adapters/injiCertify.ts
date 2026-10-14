import { AdapterNotImplemented, type IssuerAdapter } from "@playground/shared";
import { config } from "../config";
import { plannedNote } from "./common";

// Inji Certify 0.14.0. Endpoints are deliberately not written yet: rule 7 says
// read the real source in github.com/inji/inji-certify first and cite it.
export const injiCertify: IssuerAdapter = {
  info: {
    id: "inji-certify",
    label: "Inji Certify",
    role: "issuer",
    vendor: "inji",
    readiness: "planned",
    formats: ["ldp_vc", "vc+sd-jwt", "dc+sd-jwt"],
    note: plannedNote("Certify", config.services.certify ?? config.services.certifyLocal, "Phase 3"),
  },
  async createOffer() {
    throw new AdapterNotImplemented("inji-certify", "create a credential offer");
  },
};
