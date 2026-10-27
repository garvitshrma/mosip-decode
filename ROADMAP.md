# Inji Interoperability Playground — Roadmap

MOSIP Decode 2026 · Problem Statement 02 ([PDF](https://www.mosip.io/pdf/02_Interoperability_Playground_for_Verifiable_Credentials.pdf))

**Goal:** one web app where a user picks an **Issuer → Wallet → Verifier**, runs a real
issue → hold → present → verify flow (OpenID4VCI + OpenID4VP), sees every payload,
and gets a pass/fail interoperability report.

## Status

- [x] Vite + React + TS frontend shell (Home / Issuer / Wallet / Verifier / Playground pages)
- [ ] Everything is mocked (`frontend/src/utils/mockApi.ts`); no backend, no Inji services yet

## Target architecture

See `CLAUDE.md` for the rules and `docs/FORUM_NOTES.md` for the mentor guidance this is based on.

```
frontend/  (React, Vite)
  Scenario picker (issuer / wallet / verifier / format / flows) · Run view with QR codes
  · Protocol Inspector · Report · History
        │  REST + socket.io (live steps)
        ▼
backend/  (Node + Express + TypeScript)
  plugins/   issuers: inji-certify (auth code, pre-auth), animo
             wallets: inji-mobile (android/ios), inji-web, external, mock-wallet (optional)
             verifiers: inji-verify, external
  proxy/     wallet traffic to Certify / Verify passes through here and gets logged
  runs       one async function per run, saves steps + result to SQLite
  scenarios  curated list (Inji<->Inji, Inji<->External, External<->Inji)
        │
        ▼
infra/  docker-compose: inji-certify + nginx + postgres, mimoto + inji-web, inji-verify (service + ui);
        Collab eSignet for auth code; ngrok/cloudflare for the phone
```

Key idea: we don't build our own wallet (mentors said so). Real wallets scan QR codes we show.
To still see every exchange, the wallet talks to Certify / Verify **through our backend proxy**,
which logs each request and response for the inspector.

## Phases

### Phase 0 — Learn the real protocols
Findings: [docs/PHASE0_NOTES.md](docs/PHASE0_NOTES.md) · Hands-on: [docs/PHASE0_SANDBOX_WALKTHROUGH.md](docs/PHASE0_SANDBOX_WALKTHROUGH.md)
- [x] Read Certify / Inji Web / Inji Verify docs and source; map every endpoint we need.
- [x] Decide format pair: **`ldp_vc` (Ed25519Signature2020) + SD-JWT VC**.
- [x] Certify supports **pre-authorized code** with its own token endpoint → we run Certify locally for automation (Collab issuers don't have pre-auth enabled).
- [x] Save live Collab metadata to `docs/fixtures/collab/`.
- [x] List first candidate interop gaps (section 7 of the notes).
- [ ] Team does the Collab walkthrough and saves HAR files to `docs/fixtures/har/`.

### Phase 1 — Stand up the stack (Mandatory #1, ~1 week)
Start from `inji-certify/docker-compose/docker-compose-injistack` (v0.14.0) and copy it into `infra/`.
- [ ] Certify + Postgres + certify-nginx up; `/.well-known/openid-credential-issuer` works.
- [ ] Enable Certify as its own auth server (pre-auth) and issue a Farmer VC with curl (steps in notes §3).
- [ ] Add an SD-JWT credential config via `POST /credential-configurations`.
- [ ] Enable verify-service 0.18.2 + add verify-ui; verify the issued VC with `/vc-verification`.
- [ ] Mimoto + Inji Web: get `oidckeystore.p12` sorted (mimoto onboarding docs) and download a VC in Inji Web.
- [ ] ngrok for the `did:web` issuer DID so signatures resolve.

### Phase 2 — Walking skeleton (Mandatory #2, #3, #4)
- [ ] Create `backend/` (Express + TS) with the tracing proxy from day one.
- [ ] Issuer plug-in: Inji Certify (pre-auth offer QR, then auth-code offer). Wallet: Inji Web + Inji Mobile (show QR, wait). Verifier plug-in: Inji Verify (`/vp-request` QR + result).
- [ ] Frontend: replace `mockApi` with backend calls; build the scenario picker.
- [ ] Present & Verify: show Valid / Invalid / Valid-but-Expired.
- [ ] Inji Web wallet plug-in (show credential offer QR / link, poll for completion).

### Phase 3 — Inspector + Report (Mandatory #5, #7)
- [ ] WebSocket stream of trace events; inspector panel with per-step raw JSON (credential offer, token, credential, authorization request, presentation_definition, vp_token, result).
- [ ] Decode JWTs / SD-JWT disclosures inline.
- [ ] Persist runs (SQLite is enough); per-run report + exportable markdown matrix.

### Phase 4 — Second format + mobile (Mandatory #6)
- [ ] SD-JWT VC end-to-end; format + proof type badge on every run.
- [ ] Inji Wallet mobile via QR, using ngrok to reach local services.

### Phase 5 — External stacks + good-to-haves
1. [ ] **Animo playground** as external issuer / wallet / verifier; run the curated External scenarios — highest value (mentors' main point).
2. [ ] Replay & tamper mode (expired, wrong type, bad signature) — easy with the mock wallet.
3. [ ] Live Mermaid sequence diagram driven by trace events.
4. [ ] History dashboard with filters (format, module version, outcome).
5. [ ] mDoc (mock) as third format.
6. [ ] Same-device deep-link flow.

### Phase 6 — Ship (last week, don't skip)
- [ ] One-command `docker compose up` for everything.
- [ ] README: setup, architecture diagram, how to run each flow.
- [ ] `INTEROP_REPORT.md`: tested combinations + outcomes.
- [ ] `docs/interop-gaps.md`: real gaps/bugs found; file them as GitHub issues on inji/inji-*.
- [ ] 3–5 min demo video with inspector visible.

## Suggested team split
- **Infra/Inji person:** Docker Compose, configs, Certify/Mimoto/Verify wiring, ngrok, mobile testing.
- **Backend person:** backend, plug-ins, tracing proxy, run + report storage.
- **Frontend person:** selector, run view, inspector, report/history, Mermaid.

## Repo conventions
- `frontend/`, `backend/`, `infra/`, `docs/` at repo root.
- Types (Run, Step, Scenario) in `backend/src/types.ts`, copied to `frontend/src/types`.
- Commit HAR/JSON samples from real runs under `docs/fixtures/` — useful for tests and for the write-up.
