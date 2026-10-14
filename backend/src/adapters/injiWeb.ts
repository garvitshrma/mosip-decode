import { AdapterNotImplemented, type WalletAdapter } from "@playground/shared";
import { config } from "../config";
import { plannedNote } from "./common";

// Inji Web 0.17.0, the browser-based holder. Same-device flow via deep link.
export const injiWeb: WalletAdapter = {
  info: {
    id: "inji-web",
    label: "Inji Web",
    role: "wallet",
    vendor: "inji",
    readiness: "planned",
    formats: ["ldp_vc", "vc+sd-jwt", "dc+sd-jwt"],
    note: plannedNote("Inji Web", config.services.injiWeb, "Phase 3"),
  },
  async acceptOffer() {
    throw new AdapterNotImplemented("inji-web", "accept a credential offer");
  },
  async presentCredential() {
    throw new AdapterNotImplemented("inji-web", "present a credential");
  },
};
