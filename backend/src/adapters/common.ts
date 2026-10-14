// Phase 1 declares adapters without implementing their flows. Rule 5 says
// nothing is faked, so every adapter reports honestly why it cannot run yet.

export function plannedNote(service: string, baseUrl: string | undefined, phase: string): string {
  const configured = baseUrl ? `${service} URL is set` : `${service} URL is missing from .env`;
  return `${configured}. Live flow lands in ${phase}.`;
}
