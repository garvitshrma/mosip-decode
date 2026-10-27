import type { AdapterInfo, IssuerAdapter, VerifierAdapter, WalletAdapter } from "@playground/shared";
import { injiCertify } from "./injiCertify";
import { externalIssuer } from "./externalIssuer";
import { injiWallet } from "./injiWallet";
import { injiWeb } from "./injiWeb";
import { externalWallet } from "./externalWallet";
import { injiVerify } from "./injiVerify";
import { externalVerifier } from "./externalVerifier";
import { localDemoAdapterInfos } from "./localDemo";

// Adding an adapter is one new file plus one line in the right list below.

export const issuers: IssuerAdapter[] = [injiCertify, externalIssuer];
export const wallets: WalletAdapter[] = [injiWallet, injiWeb, externalWallet];
export const verifiers: VerifierAdapter[] = [injiVerify, externalVerifier];

export { isLocalDemoSelection, supportsLocalDemoFormat } from "./localDemo";

export interface AdapterCatalogue {
  issuers: AdapterInfo[];
  wallets: AdapterInfo[];
  verifiers: AdapterInfo[];
}

export function catalogue(): AdapterCatalogue {
  // The local reference stack comes first so the one-click demo works without
  // configuring any external Inji service. The real Inji adapters stay below it.
  return {
    issuers: [...localDemoAdapterInfos.issuers, ...issuers.map((a) => a.info)],
    wallets: [...localDemoAdapterInfos.wallets, ...wallets.map((a) => a.info)],
    verifiers: [...localDemoAdapterInfos.verifiers, ...verifiers.map((a) => a.info)],
  };
}

export function findIssuer(id: string): IssuerAdapter | undefined {
  return issuers.find((a) => a.info.id === id);
}

export function findWallet(id: string): WalletAdapter | undefined {
  return wallets.find((a) => a.info.id === id);
}

export function findVerifier(id: string): VerifierAdapter | undefined {
  return verifiers.find((a) => a.info.id === id);
}
