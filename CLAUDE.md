# Inji Interoperability Playground (mosip-decode)

Hackathon project, MOSIP Decode 2026, Inji problem statement #02: "Inji Interoperability Playground for Verifiable Credentials".

Read before working:
- `ROADMAP.md`: phases and what's done
- `docs/FORUM_NOTES.md`: what the MOSIP mentors said (official PS2 clarification). **This overrides our own assumptions.**
- `docs/PHASE0_NOTES.md`: real Inji endpoints, versions, ports, flows (checked against source)

## Goal

User picks a **test scenario**: Issuer + Wallet + Verifier + credential format + issuance flow + presentation flow.
The playground runs/guides the issue → hold → present → verify flow, shows every raw protocol exchange in a
Protocol Inspector, and produces a report: components used, format, protocol + version, result per stage,
overall pass/fail, and **where** it failed.

Main point (per mentors): prove interoperability **beyond** Inji, not only Inji ↔ Inji.
Curated scenarios, not every combination:
- Inji Certify → Inji Wallet → Inji Verify (baseline)
- External Issuer → Inji Wallet → Inji Verify
- Inji Certify → External Wallet → Inji Verify
- External Issuer → External Wallet → Inji Verify
- Inji Certify → Inji Wallet → External Verifier (where relevant)

External stack to start with: Animo playground (https://playground.animo.id).

## Current state

- `frontend/`: React 18 + TS + Vite + react-router-dom v7 + lucide-react, plain CSS in `src/styles.css`.
- Routes (`src/utils/navigation.ts`, wired in `src/main.tsx` inside `PageShell`): `/` Home, `/issuer`, `/wallet`,
  `/verifier`, `/playground`.
- Panels in `src/components/{issuer,wallet,verifier,playground,common}/`. `src/utils/mockApi.ts` just flips a status
  string. No backend, no protocol, no crypto. Header shows "● Simulated engine" pill.
- **Keep existing pages, routes, look & feel and components. Extend them, don't rewrite them.**
- Phase 0 (research) done; see `ROADMAP.md`.

## Standards and what Inji actually supports

- OpenID4VCI draft 13: **both** Authorization Code (via eSignet) and Pre-Authorized Code (Certify's own token endpoint).
- OpenID4VP draft 21–23 (Inji Verify: draft 23), cross-device (QR) first, same-device (deep link) later.
- Formats: W3C VC JSON-LD (`ldp_vc`, Ed25519Signature2020) and SD-JWT VC mandatory; `mso_mdoc` optional.
  SD-JWT shows up as both `vc+sd-jwt` and `dc+sd-jwt` (Collab Certify uses `dc+sd-jwt`). Accept both.
- External stacks may use OpenID4VCI / OpenID4VP **1.0**. Version differences are expected gaps; record them, don't hide them.
- Inji repos moved to the **`inji/*`** GitHub org (inji/inji-certify, inji/inji-verify, inji/mimoto, inji/inji-web).
  `mosip/inji-config` and `mosip/esignet` stay under mosip.
- Pinned versions: Certify 0.14.0, Mimoto 0.22.0, Inji Web 0.17.0, Inji Verify 0.18.2.

## Where things run

- **Collab sandbox** issuers only support Authorization Code (no pre-auth). Use Collab for auth-code scenarios and as reference.
- **Local Certify** (Docker) for Pre-Authorized Code scenarios.
- Local Mimoto + Certify + nginx when a wallet must reach a local issuer (Collab Mimoto doesn't list mock Certify).
- Mobile wallet needs https: expose local services with ngrok / cloudflare tunnel.

## Structure

- `frontend/`: existing app. Add only what we need, when we need it (e.g. qrcode.react, mermaid, a JSON viewer).
  Replace `mockApi.ts` with `src/api/client.ts` calling the backend.
- `backend/`: Node + Express + TypeScript. socket.io for live inspector updates, SQLite (`better-sqlite3`, plain SQL)
  for runs. Add crypto libs (jose, @sd-jwt/*) only when a feature needs them.
- `backend/src/types.ts`: Run, Step, Scenario types. Frontend keeps a copy in `src/types/`. No separate workspace
  package unless it becomes painful.
- `infra/`: docker-compose.yml, .env.example.
- `docs/`: notes, `interop-gaps.md`, interop matrix/report.

## Architecture rules

1. **Plug-ins for each role.** Each issuer / wallet / verifier is one small file exporting a plain object with a few
   functions (e.g. `createOffer`, `createRequest`, `getResult`). A simple list in `backend/src/plugins/index.ts`,
   exposed at `GET /api/plugins`. Adding a new one = adding a file + one line.
   - Issuers: Inji Certify (auth code + pre-auth), external (Animo)
   - Wallets: Inji Mobile Android / iOS, Inji Web (guide the user: show QR / link, then wait), external wallet
   - Verifiers: Inji Verify, external
2. **Real wallets first.** Mentors: we don't need to build our own wallet. Wallet steps are "show QR → user scans →
   we detect the result". A backend mock wallet is optional (for automated runs / tamper mode) and must be real
   (real keys, proof JWT with c_nonce, signed VP), never status flipping.
3. **Tracing proxy.** We can't see inside a phone wallet, so wallet ↔ issuer and wallet ↔ verifier traffic goes through
   the backend as a reverse proxy (e.g. `/proxy/certify/*`, `/proxy/verify/*`). The proxy, plus the one axios client
   used for our own calls, records method / url / headers (secrets redacted) / body / status / duration as a `Step`,
   pushes it over socket.io (room = runId) and saves it.
4. **Scenarios are data.** A scenario = { issuer, wallet, verifier, format, issuanceFlow, presentationFlow,
   expectedResult }. Keep the curated list in one JSON/TS file; the UI lets the user pick one or build a custom one.
5. **Nothing faked.** If something can't run for real yet, the UI says so. No pretend success.
6. **All service URLs from env.** Never hardcode. `.env.example` lists Collab and local defaults.
7. **Never invent Inji API endpoints.** Before writing an Inji plug-in, read the real code in github.com/inji/*
   or docs.inji.io and cite the file/endpoint in a comment. `docs/PHASE0_NOTES.md` has the ones already verified.
   If unsure: add a TODO and ask.

## Data model (`backend/src/types.ts`)

```ts
Run  { id, scenarioId?, issuer, wallet, verifier, format, issuanceFlow, presentationFlow, tamper?,
       expectedResult, status: "running" | "pass" | "fail",
       verificationResult?: "VALID" | "INVALID" | "EXPIRED" | "REVOKED",
       steps: Step[], error?: { step, message }, createdAt }

Step { name: "credential_offer" | "issuer_metadata" | "authorization" | "token" | "credential_request" | "credential"
           | "authorization_request" | "presentation_definition" | "vp_token" | "verification_result",
       stage: "issuance" | "presentation", from, to, request, response, httpStatus?, ok, durationMs, timestamp }
```

## Code style

- Simple, readable code a student team would write and can explain: small files, plain function names,
  few abstractions, no clever patterns, no huge comment blocks, no emoji in code.
- Prefer a plain async function with clear steps over classes / state machines / generic frameworks.
- Only add a dependency when it saves real work.

## Working style

- One phase at a time. Don't start the next phase until asked.
- Explain what you're doing and why, in short plain steps, while working.
- End of each phase: typecheck, build, tests where they make sense; confirm the app starts; summarise
  what works / what is mocked / known gaps; commit with a clear message.
- Keep `docs/interop-gaps.md` updated with every spec mismatch or Inji bug:
  component, version, expected vs actual, repro.
- Check the MOSIP forum (and Wednesday AMA notes) for new mentor guidance; add it to `docs/FORUM_NOTES.md`.
