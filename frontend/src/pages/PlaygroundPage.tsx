import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Play, ShieldCheck, WalletCards, XCircle } from "lucide-react";
import type { Run } from "@playground/shared";
import { FlowDiagram } from "../components/playground/FlowDiagram";
import { AdapterSelector, type Selection } from "../components/playground/AdapterSelector";
import { InspectorPanel } from "../components/playground/InspectorPanel";
import { ProtocolArtifacts } from "../components/playground/ProtocolArtifacts";
import { api, type AdapterCatalogue } from "../api/client";
import { useRunSteps } from "../api/useRunSteps";
import { routes } from "../utils/navigation";

const STAGES = ["Issue", "Hold", "Present", "Verify"];

function isLocalDemo(selection: Selection | null): boolean {
  return (
    selection?.issuer === "local-issuer" &&
    selection?.wallet === "local-wallet" &&
    selection?.verifier === "local-verifier"
  );
}

export function PlaygroundPage() {
  const [catalogue, setCatalogue] = useState<AdapterCatalogue | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { steps: liveSteps } = useRunSteps(run?.id);
  // The socket can miss the first steps while the run is still starting. Once
  // execution returns, prefer the complete step list from the run response.
  const steps = run && run.steps.length > liveSteps.length ? run.steps : liveSteps;
  const local = isLocalDemo(selection);

  useEffect(() => {
    api
      .adapters()
      .then((data) => {
        setCatalogue(data);
        setSelection({
          issuer: data.issuers[0]?.id ?? "",
          wallet: data.wallets[0]?.id ?? "",
          verifier: data.verifiers[0]?.id ?? "",
          format: data.formats[0]?.id ?? "ldp_vc",
          flow: "pre_authorized_code",
        });
      })
      .catch((err: Error) => setError(`Cannot reach the backend: ${err.message}`));
  }, []);

  const startRun = async () => {
    if (!selection) return;
    setBusy(true);
    setError(null);
    setRun(null);
    let created: Run | undefined;
    try {
      created = await api.createRun(selection);
      setRun(created);
      if (isLocalDemo(selection)) {
        setRun(await api.executeRun(created.id));
      }
    } catch (err) {
      setError((err as Error).message);
      if (created) {
        // Keep the inspector usable and show the terminal state when execution failed.
        setRun(await api.getRun(created.id).catch(() => created ?? null));
      }
    } finally {
      setBusy(false);
    }
  };

  const label = (role: "issuers" | "wallets" | "verifiers", id?: string) =>
    catalogue?.[role].find((adapter) => adapter.id === id)?.label ?? "-";

  const stageState = (index: number): string => {
    if (!run) return index === 0 ? "active" : "";
    if (run.status === "pass") return "done";
    if (run.status === "fail") return index < 3 ? "done" : "active";
    return index === 0 ? "done" : index === 1 ? "active" : "";
  };

  return (
    <div className="page-container">
      <div className="page-heading">
        <span>INTEROPERABILITY DEMO</span>
        <h1>Playground</h1>
        <p>Pick an issuer, a wallet and a verifier, then run the credential lifecycle across them.</p>
      </div>

      <FlowDiagram
        issuer={label("issuers", selection?.issuer)}
        wallet={label("wallets", selection?.wallet)}
        verifier={label("verifiers", selection?.verifier)}
        format={selection?.format}
      />

      {catalogue && selection && (
        <AdapterSelector catalogue={catalogue} selection={selection} onChange={setSelection} />
      )}

      {error && (
        <div className="banner error">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      <section className="playground-panel">
        <div className="steps">
          {STAGES.map((stage, index) => (
            <div className={`step ${stageState(index)}`} key={stage}>
              <b>{index + 1}</b>
              <span>{stage}</span>
            </div>
          ))}
        </div>
        <div className="playground-action">
          <h2>
            {run
              ? run.status === "running"
                ? "Running the full flow..."
                : run.status === "pass"
                  ? "Interoperability pass"
                  : "Interoperability fail"
              : "Start a run"}
          </h2>
          <p>
            {local
              ? "The local reference stack runs a real OpenID4VCI-style issuance and OpenID4VP-style presentation in-process. Credentials and presentations are signed with Ed25519 keys and every signature is verified before the run passes."
              : "The selected Inji or external adapters need their services configured. Use the local reference stack for the one-click demo; the external adapters remain available for configured deployments."}
          </p>
          <button className="primary-btn" onClick={startRun} disabled={busy || !selection}>
            <Play size={18} />
            {busy
              ? local
                ? "Running end-to-end demo..."
                : "Creating..."
              : local
                ? "Run end-to-end demo"
                : "Create run"}
          </button>

          {run && (
            <>
              <dl className="run-facts">
                <div>
                  <dt>Run</dt>
                  <dd>
                    <code>{run.id}</code>
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{run.status}</dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>{run.format}</dd>
                </div>
                <div>
                  <dt>Flow</dt>
                  <dd>{run.flow ?? "pre_authorized_code"}</dd>
                </div>
                {run.verificationResult && (
                  <div>
                    <dt>Verifier result</dt>
                    <dd>{run.verificationResult}</dd>
                  </div>
                )}
                <div>
                  <dt>Evidence</dt>
                  <dd>{run.verificationEvidence ?? "recorded steps"}</dd>
                </div>
              </dl>

              {run.status === "pass" && (
                <div className="success-note">
                  <ShieldCheck size={18} /> End-to-end flow passed with a server-verified presentation.
                </div>
              )}
              {run.status === "fail" && (
                <div className="error-note">
                  <XCircle size={18} /> The flow completed but verification did not pass.
                </div>
              )}

              {run.credential && (
                <div className="credential-preview" style={{ marginTop: 22 }}>
                  <span>ISSUED CREDENTIAL</span>
                  <h3>{run.credential.type}</h3>
                  <p>{run.credential.format} · {run.credential.status}</p>
                  <div className="credential-line">
                    <span>Credential ID</span>
                    <code>{run.credential.id}</code>
                  </div>
                  <div className="credential-line">
                    <span>Signature checked</span>
                    <span>{run.status === "pass" ? "issuer + holder" : "not verified"}</span>
                  </div>
                  <div className="button-row">
                    <Link className="secondary-btn" to={routes.wallet}>
                      <WalletCards size={16} /> Open wallet
                    </Link>
                  </div>
                </div>
              )}

              {!run.credential && run.status === "running" && (
                <p className="muted small" style={{ marginTop: 18 }}>
                  The inspector below updates as each protocol step is recorded.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {steps.length > 0 && <ProtocolArtifacts steps={steps} />}

      <InspectorPanel steps={steps} runId={run?.id} />
    </div>
  );
}
