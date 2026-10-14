import { AdapterNotImplemented, type WalletAdapter } from "@playground/shared";

// Any standards-compliant third-party wallet the holder already has installed.
// Nothing to configure: we hand it an offer URI and it either works or it does not.
export const externalWallet: WalletAdapter = {
  info: {
    id: "external-wallet",
    label: "External wallet",
    role: "wallet",
    vendor: "external",
    readiness: "planned",
    formats: ["vc+sd-jwt", "mso_mdoc"],
    note: "Nothing to configure: the holder uses their own wallet app. Live flow lands in Phase 3.",
  },
  async acceptOffer() {
    throw new AdapterNotImplemented("external-wallet", "accept a credential offer");
  },
  async presentCredential() {
    throw new AdapterNotImplemented("external-wallet", "present a credential");
  },
};
