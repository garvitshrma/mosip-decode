import { AdapterNotImplemented, type WalletAdapter } from "@playground/shared";
import { config } from "../config";
import { plannedNote } from "./common";

// Inji Wallet on a phone, reached through Mimoto 0.22.0. Rule 2: we do not build
// a wallet. The playground shows a QR or deep link and waits for the holder.
export const injiWallet: WalletAdapter = {
  info: {
    id: "inji-wallet",
    label: "Inji Wallet (mobile)",
    role: "wallet",
    vendor: "inji",
    readiness: "planned",
    formats: ["ldp_vc", "vc+sd-jwt", "dc+sd-jwt", "mso_mdoc"],
    note: plannedNote("Mimoto", config.services.mimoto, "Phase 3"),
  },
  async acceptOffer() {
    throw new AdapterNotImplemented("inji-wallet", "accept a credential offer");
  },
  async presentCredential() {
    throw new AdapterNotImplemented("inji-wallet", "present a credential");
  },
};
