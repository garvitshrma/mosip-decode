import { CreditCard, QrCode, LoaderCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "../../api/client";

type WalletCredential = {
  id: string;
  type: string;
  format: string;
  status: string;
  demo: boolean;
  issuer?: string;
};

export function WalletPanel() {
  const [credentials, setCredentials] = useState<WalletCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadCredentials() {
      try {
        const stored = await api.listCredentials();
        if (active) setCredentials(stored);
      } catch (reason: unknown) {
        if (!active) return;
        setLoadError("Unable to load credentials from the playground.");
        setCredentials([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadCredentials();
    return () => {
      active = false;
    };
  }, []);

  const deleteCredential = async (id: string) => {
    setDeleteError(null);
    try {
      const result = await api.deleteCredential(id);
      if (result.success === true) {
        setCredentials((c) => c.filter((x) => x.id !== id));
      } else {
        setDeleteError("The credential could not be deleted.");
      }
    } catch (reason: unknown) {
      setDeleteError(reason instanceof Error && reason.message.includes("not found")
        ? "Credential not found."
        : "The credential could not be deleted.");
    }
  };

  const viewDetails = (cred: WalletCredential) => {
    const lines = [
      `Credential ID: ${cred.id}`,
      `Type: ${cred.type}`,
      `Format: ${cred.format}`,
      `Issuer: ${cred.issuer || "Unknown"}`,
      `Status: ${cred.status}`,
      `Demo: ${cred.demo ? "Yes (simulated)" : "No"}`,
    ];
    window.alert(lines.join("\n"));
  };

  const demoLabel = (demo: boolean) => (demo ? <span className="demo-tag">DEMO</span> : null);

  return (
    <section className="product-panel wallet-panel">
      <div className="panel-copy">
        <span className="eyebrow">WALLET · INJI WEB</span>
        <h1>Hold and present your credentials.</h1>
        <p>
          A holder-facing experience for securely storing credentials and presenting
          them to relying parties. Real wallet handoff (offer acceptance and
          credential receipt) is not yet implemented against a live wallet service.
        </p>

        {loading && (
          <p className="muted small"><LoaderCircle size={14} className="spin" /> Loading credentials...</p>
        )}
        {!loading && loadError && (
          <p role="alert" className="muted small" style={{ color: "#c53030" }}>
            {loadError}
          </p>
        )}
      </div>

      <div className="credentials-list">
        <h3>Saved Credentials</h3>
        {loading && <p className="muted small">Loading credentials...</p>}
        {!loading && credentials.length === 0 && !loadError && (
          <p className="muted small">No credentials are recorded in the playground.</p>
        )}
        {!loading && credentials.length > 0 && (
          <div className="credentials-grid">
            {credentials.map((cred) => (
              <div key={cred.id} className="credential-card">
                <div className="credential-header">
                  <span className="credential-issuer">{cred.issuer || "Unknown"}</span>
                  <span className="credential-format">{cred.format}</span>
                  {demoLabel(cred.demo)}
                </div>
                <div className="credential-body">
                  <p><strong>Type:</strong> {cred.type}</p>
                  <p><strong>Status:</strong> {cred.status}</p>
                  <p><strong>Source:</strong> {cred.demo ? "Simulated demo record" : "Playground record; wallet receipt unconfirmed"}</p>
                </div>
                <div className="credential-actions">
                  <button className="secondary-btn small" onClick={() => viewDetails(cred)}>
                    View
                  </button>
                  <button className="secondary-btn small destructive" onClick={() => deleteCredential(cred.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && deleteError && (
          <p role="alert" className="muted small" style={{ color: "#c53030", marginTop: 10 }}>
            {deleteError}
          </p>
        )}
      </div>

      <div className="wallet-actions">
        <h3>Wallet actions</h3>
        <p className="muted small">
          Offer acceptance, credential receipt, and presentation are handled by a
          compatible Inji wallet (mobile or web). The playground does not currently
          confirm that an external wallet received or stored a credential.
        </p>
        <div className="button-row">
          <button className="primary-btn" onClick={() => {}} disabled>
            <CreditCard size={18} /> Accept offer (not connected)
          </button>
          <button className="secondary-btn" onClick={() => {}} disabled>
            <QrCode size={18} /> Present by QR (not connected)
          </button>
        </div>
      </div>
    </section>
  );
}
