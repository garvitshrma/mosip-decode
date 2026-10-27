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

  const viewDetails = async (cred: WalletCredential) => {
    let credentialJson = "(credential body unavailable)";
    try {
      const stored = await api.getStoredCredential(cred.id);
      credentialJson = stored.credentialJson ?? credentialJson;
    } catch {
      // Keep the summary visible even if the body cannot be loaded.
    }
    const lines = [
      `Credential ID: ${cred.id}`,
      `Type: ${cred.type}`,
      `Format: ${cred.format}`,
      `Issuer: ${cred.issuer || "Unknown"}`,
      `Status: ${cred.status}`,
      `Source: ${cred.demo ? "Simulated demo record" : "Signed local demo credential"}`,
      "",
      credentialJson,
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
          The local reference wallet stores the credential issued by the Playground demo
          and presents it to the local verifier. Inji Web and mobile wallet handoff
          remain external integrations and are not claimed here.
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
                  <p><strong>Source:</strong> {cred.demo ? "Simulated demo record" : "Signed credential from a completed local demo run"}</p>
                </div>
                <div className="credential-actions">
                  <button className="secondary-btn small" onClick={() => void viewDetails(cred)}>
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
          This page lists the credentials stored by the local demo. To issue and present a
          fresh credential, run the end-to-end demo in the Playground. External Inji wallet
          handoff is not configured in this environment.
        </p>
        <div className="button-row">
          <button className="primary-btn" onClick={() => window.location.assign("/playground")}>
            <CreditCard size={18} /> Run the demo
          </button>
          <button className="secondary-btn" onClick={() => window.location.reload()}>
            <QrCode size={18} /> Refresh wallet
          </button>
        </div>
      </div>
    </section>
  );
}
