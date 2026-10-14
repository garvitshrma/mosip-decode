import { useState } from "react";
import { Terminal, ChevronRight } from "lucide-react";
import type { Step } from "@playground/shared";

// Mandatory #5. Phase 1 renders the shell and the empty state; the steps that
// fill it arrive once the adapters run real flows.
export function InspectorPanel({ steps, runId }: { steps: Step[]; runId?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="inspector-panel">
      <div className="inspector-head">
        <Terminal size={18} />
        <h2>Protocol inspector</h2>
        {runId && <code className="run-id">run {runId}</code>}
      </div>

      {steps.length === 0 ? (
        <div className="inspector-empty">
          <p>No protocol exchanges recorded yet.</p>
          <small>
            Every HTTP call the backend makes is captured here with headers and bodies, secrets redacted.
          </small>
        </div>
      ) : (
        <ol className="step-list">
          {steps.map((step) => (
            <li key={step.id} className={step.ok ? "ok" : "failed"}>
              <button className="step-row" onClick={() => setOpenId(openId === step.id ? null : step.id)}>
                <ChevronRight size={15} className={openId === step.id ? "rotated" : ""} />
                <span className="step-name">{step.name}</span>
                <span className="step-route">
                  {step.from} to {step.to}
                </span>
                <span className="step-stage">{step.stage}</span>
                {step.httpStatus !== undefined && <span className="step-status">{step.httpStatus}</span>}
                <span className="step-duration">{step.durationMs} ms</span>
              </button>
              {openId === step.id && (
                <div className="step-detail">
                  <h4>Request</h4>
                  <pre>{JSON.stringify(step.request, null, 2)}</pre>
                  <h4>Response</h4>
                  <pre>{step.response ? JSON.stringify(step.response, null, 2) : "no response recorded"}</pre>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
