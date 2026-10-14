import { useEffect, useState } from "react";
import { Play, AlertTriangle } from "lucide-react";
import type { Run } from "@playground/shared";
import { FlowDiagram } from "../components/playground/FlowDiagram";
import { AdapterSelector, type Selection } from "../components/playground/AdapterSelector";
import { InspectorPanel } from "../components/playground/InspectorPanel";
import { api, type AdapterCatalogue } from "../api/client";
import { useRunSteps } from "../api/useRunSteps";

const STAGES = ["Issue", "Hold", "Present", "Verify"];

export function PlaygroundPage() {
  const [catalogue, setCatalogue] = useState<AdapterCatalogue | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { steps } = useRunSteps(run?.id);

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
        });
      })
      .catch((err: Error) => setError(`Cannot reach the backend: ${err.message}`));
  }, []);

  const startRun = async () => {
    if (!selection) return;
    setBusy(true);
    setError(null);
    try {
      setRun(await api.createRun(selection));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const label = (role: "issuers" | "wallets" | "verifiers", id?: string) =>
    catalogue?.[role].find((adapter) => adapter.id === id)?.label ?? "-";

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
            <div className="step" key={stage}>
              <b>{index + 1}</b>
              <span>{stage}</span>
            </div>
          ))}
        </div>
        <div className="playground-action">
          <h2>{run ? "Run created" : "Start a run"}</h2>
          <p>
            {run
              ? "The combination is recorded. No flow has been executed: the issuance and presentation adapters land in Phase 3, and nothing is simulated in the meantime."
              : "Creating a run records the chosen components and format, and opens a live inspector session for it."}
          </p>
          <button className="primary-btn" onClick={startRun} disabled={busy || !selection}>
            <Play size={18} /> {busy ? "Creating..." : "Create run"}
          </button>
          {run && (
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
            </dl>
          )}
        </div>
      </section>

      <InspectorPanel steps={steps} runId={run?.id} />
    </div>
  );
}
