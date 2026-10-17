import { Info, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  OpenID4VPVerification,
  QRCodeVerification,
} from "@injistack/react-inji-verify-sdk";
import { api, type VerifierConfig } from "../../api/client";
import {
  summarizeVerificationResult,
  canAcceptAttemptCallback,
  type CreateRunRequest,
  type Run,
  type VerificationItemOutcome,
  type VerificationOutcome,
} from "@playground/shared";

type TabState = "upload" | "scan" | "vp" | "ble";
type VerificationStatus = "idle" | "processing" | "success" | "invalid" | "expired" | "revoked" | "error";
type VerificationMethod = "qr-upload" | "qr-scan" | "openid4vp";

function newAttemptId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function resultStatus(value: unknown): VerificationStatus {
  const outcome = summarizeVerificationResult(value).outcome;
  if (outcome === "VALID") return "success";
  if (outcome === "INVALID") return "invalid";
  if (outcome === "EXPIRED") return "expired";
  if (outcome === "REVOKED") return "revoked";
  return "error";
}

function StatusMessage({ status }: { status: VerificationStatus }) {
  if (status === "success") {
    return <p className="success-note"><ShieldCheck size={18} /> Verification passed</p>;
  }
  if (status === "invalid" || status === "expired" || status === "revoked" || status === "error") {
    const label = status === "error" ? "Verification failed" : `Credential ${status.toLowerCase()}`;
    return <p className="error-note"><XCircle size={18} /> {label}</p>;
  }
  if (status === "processing") {
    return <p className="muted small"><Loader2 size={15} className="spin" /> Processing verification...</p>;
  }
  return null;
}

function VerificationError({ message }: { message: string | null }) {
  return message ? <p className="error-note"><Info size={16} /> {message}</p> : null;
}

function UploadTab({
  config,
  onStatus,
  onError,
  onStart,
}: {
  config: VerifierConfig | null;
  onStatus: (attemptId: string, status: VerificationStatus, result?: unknown) => void;
  onError: (attemptId: string, error: unknown) => void;
  onStart: (attemptId: string) => void;
}) {
  const [attemptId, setAttemptId] = useState(newAttemptId);
  const [started, setStarted] = useState(false);
  const start = () => {
    const next = started ? newAttemptId() : attemptId;
    setAttemptId(next);
    setStarted(true);
    onStart(next);
  };
  if (!config) return null;
  return (
    <div>
      <h3 className="selector-head">Upload QR Code</h3>
      <p className="selector-note">
        Upload a QR code image or PDF. Supported formats: PNG, JPEG, JPG, and PDF.
        Files must be between 10 KB and 5 MB.
      </p>
      <div className="sdk-action">
        <QRCodeVerification
          verifyServiceUrl={config.serviceUrl}
          clientId={config.clientId}
          isEnableScan={false}
          summariseResults
          onVCProcessed={(result) => onStatus(attemptId, resultStatus(result), result)}
          onError={(reason) => onError(attemptId, reason)}
          triggerElement={<button className="primary-btn" type="button" onClick={start}>Choose QR file</button>}
        />
      </div>
    </div>
  );
}

function ScanTab({
  config,
  onStatus,
  onError,
  onStart,
}: {
  config: VerifierConfig | null;
  onStatus: (attemptId: string, status: VerificationStatus, result?: unknown) => void;
  onError: (attemptId: string, error: unknown) => void;
  onStart: (attemptId: string) => void;
}) {
  const [attemptId, setAttemptId] = useState(newAttemptId);
  const [started, setStarted] = useState(false);
  const start = () => {
    const next = started ? newAttemptId() : attemptId;
    setAttemptId(next);
    setStarted(true);
    onStart(next);
  };
  if (!config) return null;
  return (
    <div>
      <h3 className="selector-head">Scan QR Code</h3>
      <p className="selector-note">
        Allow camera access when prompted. The SDK stops the scanner when it is
        closed or when verification completes.
      </p>
      <div className="sdk-action">
        <QRCodeVerification
          verifyServiceUrl={config.serviceUrl}
          clientId={config.clientId}
          isEnableUpload={false}
          summariseResults
          onVCProcessed={(result) => onStatus(attemptId, resultStatus(result), result)}
          onError={(reason) => onError(attemptId, reason)}
          triggerElement={<button className="primary-btn" type="button" onClick={start}>Start camera</button>}
        />
      </div>
    </div>
  );
}

function VpVerificationTab({
  config,
  onStatus,
  onError,
  onExpired,
  onStart,
}: {
  config: VerifierConfig | null;
  onStatus: (attemptId: string, status: VerificationStatus, result?: unknown) => void;
  onError: (attemptId: string, error: unknown) => void;
  onExpired: (attemptId: string) => void;
  onStart: (attemptId: string) => void;
}) {
  const [attemptId, setAttemptId] = useState(newAttemptId);
  const [started, setStarted] = useState(false);
  const start = () => {
    const next = started ? newAttemptId() : attemptId;
    setAttemptId(next);
    setStarted(true);
    onStart(next);
  };
  if (!config) return null;
  return (
    <div>
      <h3 className="selector-head">VP Verification</h3>
      <p className="selector-note">
        Generate a real OpenID4VP request and scan it with a compatible wallet.
        The result is reported by the configured verification service.
      </p>
      <div className="sdk-action">
        <OpenID4VPVerification
          verifyServiceUrl={config.serviceUrl}
          clientId={config.clientId}
          dcqlQuery={{ credentials: [{ id: "credential", format: "ldp_vc", meta: {} }] }}
          isSameDeviceFlowEnabled={false}
          summariseResults
          onVPProcessed={(result) => onStatus(attemptId, resultStatus(result), result)}
          onQrCodeExpired={() => onExpired(attemptId)}
          onError={(reason) => onError(attemptId, reason)}
          triggerElement={<button className="primary-btn" type="button" onClick={start}>Create verification request</button>}
        />
      </div>
    </div>
  );
}

function BleTab() {
  return (
    <div>
      <h3 className="selector-head">BLE</h3>
      <p className="selector-note">BLE verification is not available in the configured Inji Verify SDK.</p>
      <div className="selector-panel"><p className="muted small"><strong>Status:</strong> Coming soon</p></div>
    </div>
  );
}

function ProgressIndicator({ step }: { step: "upload" | "verify" | "result" }) {
  const labels = ["Upload or scan", "Verify credential", "View result"];
  const completed = step === "upload" ? 0 : step === "verify" ? 1 : 2;
  return (
    <div className="steps" aria-label="Verification progress">
      {labels.map((label, index) => (
        <div key={label} className={`step ${index <= completed ? "done" : ""} ${index === completed ? "active" : ""}`}>
          <b>{index + 1}</b><span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function VerifierPanel() {
  const [tab, setTab] = useState<TabState>("upload");
  const [config, setConfig] = useState<VerifierConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<VerificationStatus>("idle");
  const attemptRef = useRef<{
    id: string;
    method: "qr-upload" | "qr-scan" | "openid4vp";
    promise: Promise<Run>;
    finished: boolean;
  } | null>(null);

  useEffect(() => {
    api.verifierConfig()
      .then(setConfig)
      .catch(() => setConfigError("Verifier configuration could not be loaded."));
    return () => {
      if (attemptRef.current) attemptRef.current.finished = true;
    };
  }, []);

  const startAttempt = (method: VerificationMethod, id: string) => {
    if (attemptRef.current && !attemptRef.current.finished) return;
    setStatus("processing");
    setError(null);
    setPersistenceWarning(null);
    const input: CreateRunRequest = {
      issuer: "inji-certify",
      wallet: "inji-wallet",
      verifier: "inji-verify",
      format: "ldp_vc",
      kind: "verification",
    };
    const promise = api.createRun(input)
      .then(async (run) => {
        if (attemptRef.current?.id !== id || attemptRef.current.finished) return run;
        setRunId(run.id);
        try {
          await api.recordVerifierStep(run.id, {
            name: "verifier_started",
            method,
            evidence: "client-reported",
          });
        } catch {
          setPersistenceWarning("Verification is running, but the run-inspector could not save the start event.");
        }
        return run;
      })
      .catch((reason: unknown) => {
        if (attemptRef.current?.id === id && !attemptRef.current.finished) {
          setPersistenceWarning("Verification is running, but the run-inspector could not create a run.");
        }
        throw reason;
      });
      attemptRef.current = { id, method, promise, finished: false };
  };

  const finishAttempt = async (
      id: string,
      method: "qr-upload" | "qr-scan" | "openid4vp",
    nextStatus: VerificationStatus,
    outcome?: VerificationOutcome,
    errorCode?: string,
    itemOutcomes?: VerificationItemOutcome[],
  ) => {
    setStatus(nextStatus);
    const attempt = attemptRef.current;
    if (!canAcceptAttemptCallback(attempt, id) || !attempt || attempt.method !== method) return;
    attempt.finished = true;
    let run: Run;
    try {
      run = await attempt.promise;
    } catch {
      setPersistenceWarning("Verification completed, but the run-inspector could not create a run.");
      return;
    }
    try {
      await api.recordVerifierStep(run.id, {
        name: outcome ? "verification_result" : "verification_error",
        method,
        outcome,
        errorCode,
        evidence: "client-reported",
        itemOutcomes,
      });
    } catch {
      setPersistenceWarning("Verification completed, but the run-inspector could not save the final result event.");
    }
    try {
      await api.updateRunStatus(run.id, {
        status: outcome === "VALID" ? "pass" : "fail",
        verificationResult: outcome,
        evidence: "client-reported",
        error: outcome ? undefined : { step: "verification_result", message: "Verifier workflow failed" },
      });
    } catch {
      setPersistenceWarning("Verification completed, but the run-inspector could not save the final run status.");
    }
  };

  const handleError = (id: string, reason: unknown) => {
    const attempt = attemptRef.current;
    if (!attempt || !canAcceptAttemptCallback(attempt, id)) return;
    const errorCode = reason && typeof reason === "object" && "errorCode" in reason && typeof reason.errorCode === "string"
      ? reason.errorCode
      : "SDK_ERROR";
    setStatus("error");
    setError("The verification service could not complete this attempt.");
    void finishAttempt(id, attempt.method, "error", undefined, errorCode);
  };

  const handleStatus = (id: string, next: VerificationStatus, result?: unknown) => {
    const attempt = attemptRef.current;
    if (!attempt || !canAcceptAttemptCallback(attempt, id)) return;
    setError(null);
    setStatus(next);
    if (result !== undefined) {
      const summary = summarizeVerificationResult(result);
      const outcome = summary.outcome;
      if (outcome) void finishAttempt(id, attempt.method, next, outcome, undefined, summary.itemOutcomes);
      else void finishAttempt(id, attempt.method, "error", undefined, "INVALID_SDK_RESULT");
    }
  };

  const step = status === "success" || status === "invalid" || status === "expired" || status === "revoked" || status === "error"
    ? "result"
    : status === "processing" ? "verify" : "upload";

  return (
    <section className="product-panel verifier-panel">
      <div className="panel-copy">
        <span className="eyebrow">VERIFIER · INJI VERIFY</span>
        <h1>Verify credentials with ease!</h1>
        <p>Request and verify presentations from a wallet using the OpenID4VP relying-party flow.</p>
        <ProgressIndicator step={step} />
      </div>
      <div>
        <div className="verifier-tabs" role="tablist" aria-label="Verification method">
          {(["upload", "scan", "vp", "ble"] as const).map((value) => (
            <button key={value} type="button" className={tab === value ? "active" : ""} onClick={() => {
              setTab(value);
              setStatus("idle");
              setError(null);
              setPersistenceWarning(null);
              setRunId(null);
              attemptRef.current = null;
            }} role="tab" aria-selected={tab === value}>
              {value === "upload" ? "Upload QR Code" : value === "scan" ? "Scan QR Code" : value === "vp" ? "VP Verification" : "BLE"}
            </button>
          ))}
        </div>
        {configError && (
          <div className="banner error" role="alert">
            <Info size={18} />
            <div>
              <strong>Verifier is not configured.</strong>
              <p className="muted small" style={{ marginTop: 6 }}>
                The backend verifier integration has not been set up. Set
                <code>VERIFY_SERVICE_URL</code> and <code>VERIFY_CLIENT_ID</code> in the backend environment, then
                refresh. No verification will run until both are configured.
              </p>
            </div>
          </div>
        )}
        {!configError && config && (
          <>
            {tab === "upload" && <UploadTab config={config} onStatus={handleStatus} onError={handleError} onStart={(id) => startAttempt("qr-upload", id)} />}
            {tab === "scan" && <ScanTab config={config} onStatus={handleStatus} onError={handleError} onStart={(id) => startAttempt("qr-scan", id)} />}
            {tab === "vp" && <VpVerificationTab config={config} onStatus={handleStatus} onError={handleError} onStart={(id) => startAttempt("openid4vp", id)} onExpired={(id) => {
              const attempt = attemptRef.current;
              if (!attempt || !canAcceptAttemptCallback(attempt, id)) return;
              setStatus("expired");
              setError("The verification QR code expired. Create a new request to retry.");
              void finishAttempt(id, attempt.method, "expired", "EXPIRED", "QR_EXPIRED");
            }} />}
            {tab === "ble" && <BleTab />}
            <StatusMessage status={status} />
            <VerificationError message={error} />
            {runId && <p className="muted small">Run ID: <code>{runId}</code></p>}
            {persistenceWarning && <p className="error-note"><Info size={16} /> {persistenceWarning}</p>}
          </>
        )}
        {!configError && !config && <p className="muted small">Loading verifier configuration...</p>}
      </div>
      <footer className="verifier-footer">
        MOSIP Interoperability Playground · Inji Verify · Real service results only
      </footer>
    </section>
  );
}
