import { CheckCircle2, Clipboard, KeyRound, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { CredentialFormat } from "@playground/shared";
import { api } from "../../api/client";

const ISSUER_ID = "inji-certify";
const WALLET_ID = "inji-wallet";
const VERIFIER_ID = "inji-verify";
const SUPPORTED_FORMATS = new Set<CredentialFormat>(["ldp_vc", "vc+sd-jwt", "dc+sd-jwt", "mso_mdoc"]);

type Metadata = Awaited<ReturnType<typeof api.getIssuerMetadata>>;

type OfferStatus = "idle" | "creating" | "created" | "uncertain" | "failed";

export function IssuerPanel() {
  const [runId, setRunId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<CredentialFormat>("dc+sd-jwt");
  const [selectedId, setSelectedId] = useState("");
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [loadingOffer, setLoadingOffer] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offer, setOffer] = useState<{ offerUri: string; issuerUrl: string } | null>(null);
  const [offerStatus, setOfferStatus] = useState<OfferStatus>("idle");
  const [copied, setCopied] = useState(false);

  // The backend classifies some remote outcomes as uncertain (for example the
  // issuer did not confirm whether the offer was created). Those must never be
  // retried automatically.
  const isUncertainOutcome = (message: string) =>
    message.includes("requires reconciliation") || message.includes("already in progress");

  // Keep the selected configuration consistent with the chosen format.
  useEffect(() => {
    setSelectedId("");
    if (metadata) {
      const match = metadata.configurations.find(
        (configuration) =>
          configuration.format === selectedFormat && SUPPORTED_FORMATS.has(configuration.format as CredentialFormat)
      );
      if (match) setSelectedId(match.id);
    }
  }, [selectedFormat, metadata]);

  const selectedConfiguration = metadata?.configurations.find((configuration) => configuration.id === selectedId);
  const canCreateOffer = Boolean(
    runId &&
    selectedConfiguration &&
    SUPPORTED_FORMATS.has(selectedConfiguration.format as CredentialFormat) &&
    !loadingOffer &&
    offerStatus !== "creating" &&
    offerStatus !== "uncertain"
  );

  const startIssuance = async () => {
    if (loadingMetadata || loadingOffer) return;

    setLoadingMetadata(true);
    setMetadataError(null);
    setOffer(null);
    setOfferStatus("idle");
    setOfferError(null);
    try {
      const activeRunId =
        runId ??
        (await api.createRun({
          issuer: ISSUER_ID,
          wallet: WALLET_ID,
          verifier: VERIFIER_ID,
          format: selectedFormat,
          kind: "issuance",
        })).id;
      setRunId(activeRunId);

      const discovered = await api.getIssuerMetadata(activeRunId);
      setMetadata(discovered);
    } catch (reason: unknown) {
      setMetadataError("Metadata discovery failed. Check the issuer configuration or try again.");
    } finally {
      setLoadingMetadata(false);
    }
  };

  const copyOfferUri = async () => {
    if (!offer?.offerUri) return;
    try {
      await navigator.clipboard.writeText(offer.offerUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access may be blocked; the URI remains visible to copy manually.
    }
  };

  const createOffer = async () => {
    if (!runId || !selectedConfiguration || !canCreateOffer) return;

    setLoadingOffer(true);
    setOfferError(null);
    setOfferStatus("creating");
    try {
      const createdOffer = await api.createOffer(runId, {
        credentialType: selectedConfiguration.id,
        issuanceFlow: "pre_authorized_code",
        claims: {},
      });
      setOffer(createdOffer);
      setOfferStatus("created");
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : "";
      const uncertain = isUncertainOutcome(message);
      setOfferError(
        uncertain
          ? "The issuer did not confirm whether the offer was created. Reconciliation is required before retrying."
          : "Credential offer creation failed. No credential was issued.",
      );
      setOfferStatus(uncertain ? "uncertain" : "failed");
    } finally {
      setLoadingOffer(false);
    }
  };

  const isOfferCreated = offerStatus === "created" && !!offer;

  return (
    <section className="product-panel issuer-panel">
      <div className="panel-copy">
        <span className="eyebrow">ISSUER · OPENID4VCI</span>
        <h1>Create a credential offer.</h1>
        <p>
          Select a credential configuration advertised by Inji Certify, then create
          an offer. Creating an offer is not credential issuance: token exchange and
          credential issuance are not implemented yet.
        </p>
      </div>

      <div className="selector-panel" style={{ marginBottom: "24px" }}>
        <div className="selector-head">
          <span>Issuer metadata</span>
        </div>

        {!runId && !loadingMetadata && (
          <>
            <p className="muted small">
              Start an issuance attempt to discover the issuer's advertised configurations.
            </p>
            <label>
              <span className="muted small">Credential format</span>
              <select
                value={selectedFormat}
                onChange={(event) => setSelectedFormat(event.target.value as CredentialFormat)}
              >
                {Array.from(SUPPORTED_FORMATS).map((format) => (
                  <option key={format} value={format}>{format}</option>
                ))}
              </select>
            </label>
            <button className="primary-btn" onClick={startIssuance}>
              <KeyRound size={16} /> Start issuance
            </button>
          </>
        )}

        {loadingMetadata && (
          <p className="muted small"><LoaderCircle size={16} className="spin" /> Loading advertised configurations...</p>
        )}

        {!loadingMetadata && metadata && (
          <>
            <p className="muted small">Issuer: {metadata.issuer}</p>
            <p className="muted small">Credential endpoint: {metadata.credentialEndpoint}</p>
            {metadata.configurations.length === 0 ? (
              <p className="muted small">The issuer advertised no credential configurations.</p>
            ) : (
              <label>
                <span className="muted small">Credential configuration</span>
                <select
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                  disabled={loadingOffer}
                >
                  {metadata.configurations.map((configuration) => (
                    <option
                      key={configuration.id}
                      value={configuration.id}
                      disabled={
                        configuration.format !== selectedFormat ||
                        !SUPPORTED_FORMATS.has(configuration.format as CredentialFormat)
                      }
                    >
                      {configuration.id} ({configuration.format})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {metadata.configurations.length > 0 &&
              !metadata.configurations.some(
                (configuration) =>
                  configuration.format === selectedFormat && SUPPORTED_FORMATS.has(configuration.format as CredentialFormat)
              ) && (
                <p className="muted small">
                  The issuer advertised no supported configuration for the selected format.
                </p>
              )}
            {selectedConfiguration && !SUPPORTED_FORMATS.has(selectedConfiguration.format as CredentialFormat) && (
              <p className="muted small">This advertised format is not supported by the current playground.</p>
            )}
          </>
        )}

        {!loadingMetadata && !metadata && !metadataError && (
          <p className="muted small">No issuer metadata is available.</p>
        )}

        {!loadingMetadata && runId && !metadata && metadataError && (
          <>
            <p role="alert" className="muted small" style={{ color: "#c53030" }}>
              {metadataError}
            </p>
            <button className="secondary-btn" onClick={startIssuance}>
              Retry metadata discovery
            </button>
          </>
        )}
      </div>

      <div className="selector-panel" style={{ marginTop: "24px" }}>
        <div className="selector-head"><span>Credential offer</span></div>

        <button className="primary-btn" onClick={createOffer} disabled={!canCreateOffer}>
          {loadingOffer ? (
            <>
              <LoaderCircle size={16} className="spin" /> Creating offer...
            </>
          ) : (
            <>
              <KeyRound size={16} /> Create offer
            </>
          )}
        </button>

        {offerStatus === "uncertain" && offerError && (
          <>
            <div className="banner error" role="alert">
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                The issuer did not confirm whether this offer was created.
              </span>
            </div>
            <p className="muted small">{offerError}</p>
            <p className="muted small">
              This outcome is uncertain and is <strong>not retried</strong>. Confirm the remote issuer outcome before
              attempting reconciliation.
            </p>
          </>
        )}

        {offerStatus === "failed" && offerError && (
          <>
            <p role="alert" className="muted small" style={{ color: "#c53030" }}>
              Offer creation failed: {offerError}
            </p>
          </>
        )}

        {isOfferCreated && (
          <div className="success-note">
            <CheckCircle2 size={18} />
            <div>
              <strong>Credential offer created.</strong>
              <p className="muted small">Issuer: {offer.issuerUrl}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <code style={{ flex: 1, fontSize: 12 }}>{offer.offerUri}</code>
                <button
                  className="secondary-btn"
                  onClick={copyOfferUri}
                  disabled={copied}
                  style={{ fontSize: 12, padding: "6px 10px" }}
                >
                  {copied ? "Copied" : <Clipboard size={14} />}
                </button>
              </div>
              <p className="muted small" style={{ marginTop: 8 }}>
                Credential issuance has <strong>not</strong> been completed. The offer URI must be handed to a
                compatible wallet, which then completes authorization, token exchange, and credential request. None of
                those steps are implemented yet.
              </p>
            </div>
          </div>
        )}

        {!isOfferCreated && !offerError && !loadingMetadata && metadata && (
          <p className="muted small">
            The offer URI will appear here after the issuer accepts the request. Only an offer URI is shown — this does
            not mean the wallet has received the credential.
          </p>
        )}
      </div>
    </section>
  );
}
