# Inji Interoperability Playground (mosip-decode)

Hackathon project, MOSIP Inji problem statement #02: "Inji Interoperability Playground for Verifiable Credentials".

## Goal

User picks an Issuer, a Wallet and a Verifier implementation (3-column selector) plus a credential format, runs a live
issue → hold → present → verify flow, sees every raw protocol exchange in a Protocol Inspector, and gets a pass/fail
interoperability report per run.

## Current state (as of first commit)

- Only `frontend/`: React 18 + TS + Vite + react-router-dom v7 + lucide-react, plain CSS in `src/styles.css`.
- Routes (`src/utils/navigation.ts`, wired in `src/main.tsx` inside `PageShell`): `/` Home, `/issuer`, `/wallet`,
  `/verifier`, `/playground`.
- Panels in `src/components/{issuer,wallet,verifier,playground,common}/`. `src/utils/mockApi.ts` just flips a status
  string. No backend, no protocol, no crypto. Header shows "● Simulated engine" pill.
- **Keep existing pages, routes, look & feel and components. Extend them, don't rewrite them.**

## Standards

- OpenID4VCI draft 13, pre-authorized code flow.
- OpenID4VP draft 21–23, cross-device (QR) first, same-device later.
- Formats: W3C VC JSON-LD (`ldp_vc`, Ed25519Signature2020) and SD-JWT VC (`vc+sd-jwt`) mandatory; `mso_mdoc` optional.
- Inji modules: Inji Certify (issuer), Mimoto + Inji Web / Inji Wallet (holder), Inji Verify (verifier).

## Target structure (npm workspaces at repo root)

- `frontend/` existing app (keep folder name). Add socket.io-client, mermaid, react-json-view-lite, jose (decode only),
  qrcode.react, @mosip/react-inji-verify-sdk. Replace `mockApi.ts` with `src/api/client.ts` calling the backend.
- `backend/` Node 20 + Express + TS, socket.io, axios, zod, Prisma + SQLite, jose, @sd-jwt/core,
  @sd-jwt/crypto-nodejs, @digitalbazaar/vc + Ed25519Signature2020 suite. Tests: Vitest.
- `shared/` shared TS types, zod schemas, adapter interfaces. Used by frontend and backend.
- `infra/` docker-compose.yml, .env.example.
- `docs/` architecture, interop-matrix, interop-gaps.

## Architecture rules

1. **Adapters.** `IssuerAdapter` / `WalletAdapter` / `VerifierAdapter` interfaces live in `shared/`.
   - Issuers: `InjiCertifyAdapter`, `MockIssuerAdapter`
   - Wallets: `MockWalletAdapter`, `InjiWebAdapter`, `InjiMobileAdapter` (QR + manual confirm)
   - Verifiers: `InjiVerifyAdapter`, `MockVerifierAdapter`
   - Registry exposed at `GET /api/adapters`.
2. **RunEngine** (backend) is a state machine calling the adapters in order; emits a `Step` after every protocol exchange.
3. **One traced axios client** for ALL outbound HTTP. Interceptors record method/url/headers (secrets redacted)/body/
   status/duration → `Step` pushed over socket.io (room = runId) and persisted.
4. **Nothing faked.** MockWallet is a real OID4VCI + OID4VP client in the backend: did:jwk holder key, proof JWT with
   c_nonce, VP signed with nonce + audience, SD-JWT key binding. Mock issuer/verifier are real minimal implementations
   with real signatures. No status-string flipping.
5. **All service URLs from env** (MOSIP Collab sandbox by default). Never hardcode.
6. **Never invent Inji API endpoints.** Before writing an Inji adapter, read the real code in github.com/mosip/
   inji-certify, inji-verify, mimoto, inji-web, inji-config (`mimoto-issuers-config.json`) or docs.inji.io, and cite
   the file/endpoint in a comment. If unsure: add a TODO and ask.

## Data model (`shared/`)

```ts
Run  { id, issuer, wallet, verifier, format, proofType, tamper?, expectedOutcome,
       status: "running" | "pass" | "fail",
       verificationResult?: "VALID" | "INVALID" | "EXPIRED",
       steps: Step[], error?: { step, message }, createdAt }

Step { name: "credential_offer" | "issuer_metadata" | "token" | "credential_request" | "credential"
           | "authorization_request" | "presentation_definition" | "vp_token" | "verification_result",
       from, to, request, response, httpStatus?, durationMs, timestamp }
```

## Working style

- One phase at a time. Don't start the next phase until asked.
- End of each phase: typecheck, build, tests; confirm `npm run dev` at the root starts frontend + backend; summarise
  what works / what is mocked / known gaps; commit with a clear message.
- Keep `docs/interop-gaps.md` updated with every spec mismatch or Inji bug:
  component, version, expected vs actual, repro.
