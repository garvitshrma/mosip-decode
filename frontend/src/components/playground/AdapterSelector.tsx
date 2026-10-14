import { Building2, WalletCards, ShieldCheck, FileCode2 } from "lucide-react";
import type { AdapterInfo, CredentialFormat } from "@playground/shared";
import type { AdapterCatalogue } from "../../api/client";

export interface Selection {
  issuer: string;
  wallet: string;
  verifier: string;
  format: CredentialFormat;
}

function Column({
  icon,
  role,
  options,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  role: string;
  options: AdapterInfo[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selected = options.find((option) => option.id === value);

  return (
    <div className="selector-column">
      <div className="selector-head">
        {icon}
        <span>{role}</span>
      </div>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {selected && (
        <div className="selector-meta">
          <span className={`vendor-tag ${selected.vendor}`}>{selected.vendor}</span>
          <span className={`readiness-tag ${selected.readiness}`}>{selected.readiness}</span>
        </div>
      )}
      {selected?.note && <p className="selector-note">{selected.note}</p>}
    </div>
  );
}

export function AdapterSelector({
  catalogue,
  selection,
  onChange,
}: {
  catalogue: AdapterCatalogue;
  selection: Selection;
  onChange: (next: Selection) => void;
}) {
  // Formats are narrowed to what all three chosen components claim to support,
  // so an impossible combination cannot be selected by accident.
  const chosen = [
    catalogue.issuers.find((a) => a.id === selection.issuer),
    catalogue.wallets.find((a) => a.id === selection.wallet),
    catalogue.verifiers.find((a) => a.id === selection.verifier),
  ];

  const supported = catalogue.formats.filter((format) =>
    chosen.every((adapter) => !adapter || adapter.formats.includes(format.id))
  );

  return (
    <section className="selector-panel">
      <div className="selector-grid">
        <Column
          icon={<Building2 size={18} />}
          role="Issuer"
          options={catalogue.issuers}
          value={selection.issuer}
          onChange={(issuer) => onChange({ ...selection, issuer })}
        />
        <Column
          icon={<WalletCards size={18} />}
          role="Wallet"
          options={catalogue.wallets}
          value={selection.wallet}
          onChange={(wallet) => onChange({ ...selection, wallet })}
        />
        <Column
          icon={<ShieldCheck size={18} />}
          role="Verifier"
          options={catalogue.verifiers}
          value={selection.verifier}
          onChange={(verifier) => onChange({ ...selection, verifier })}
        />
      </div>

      <div className="selector-column format-column">
        <div className="selector-head">
          <FileCode2 size={18} />
          <span>Credential format</span>
        </div>
        <select
          value={selection.format}
          onChange={(event) => onChange({ ...selection, format: event.target.value as CredentialFormat })}
        >
          {supported.map((format) => (
            <option key={format.id} value={format.id}>
              {format.label}
            </option>
          ))}
        </select>
        {supported.length === 0 && (
          <p className="selector-note warn">
            The three components above share no common format. That is itself an interoperability gap.
          </p>
        )}
      </div>
    </section>
  );
}
