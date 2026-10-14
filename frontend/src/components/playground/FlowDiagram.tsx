import { ArrowRight, Building2, WalletCards, ShieldCheck } from "lucide-react";

// Names come from the selected adapters now instead of being hardcoded.
export function FlowDiagram({
  issuer = "Issuer",
  wallet = "Wallet",
  verifier = "Verifier",
  format,
}: {
  issuer?: string;
  wallet?: string;
  verifier?: string;
  format?: string;
}) {
  return (
    <div className="flow-grid">
      <div className="flow-node">
        <Building2 />
        <span>Issuer</span>
        <small>{issuer}</small>
      </div>
      <ArrowRight className="flow-arrow" />
      <div className="flow-node">
        <WalletCards />
        <span>Wallet</span>
        <small>{wallet}</small>
      </div>
      <ArrowRight className="flow-arrow" />
      <div className="flow-node">
        <ShieldCheck />
        <span>Verifier</span>
        <small>{verifier}</small>
      </div>
      {format && <div className="flow-format">Format: {format}</div>}
    </div>
  );
}
