# Interoperability Gaps and Current Capabilities

**Phase 3C — Document interoperability gaps and current capabilities**


## Current Implementation Status

This project (mosip-decode) is an **Inji Interoperability Playground** for verifiable credentials. The playground is **configuration-driven**: the user selects an issuer, wallet, and verifier from a curated list, and the API routes the corresponding adapter functions. **No credential issuance, presentation, or verification has been demonstrated end-to-end against a live deployment.**

The current state is: **all adapters report `readiness: "planned"`** and **block** until explicitly configured via environment variables. The only verified capability is **issuer metadata discovery** at `GET /.well-known/openid-credential-issuer` when a `CERTIFY_BASE_URL` or `CERTIFY_LOCAL_BASE_URL` is set.

The Wallet page reads an explicit safe credential-summary collection from
`GET /api/credentials`; it no longer infers wallet contents from the newest
run. Existing workflow credentials are simulated records and are labeled
`DEMO`. No external wallet receipt or storage confirmation is claimed.

---

## Verified Inji Certify v0.14.0 Endpoint Sequence (from Source Audit)

The following endpoint paths were verified against `github.com/inji/inji-certify` at tag `v0.14.0` (commit `e54539a`). **Source verification ≠ live testing.**

Phase 2A adds a deployment-independent HTTP boundary for the metadata path.
Its conservative validator accepts only a JSON object containing the standard
`credential_issuer` and `credential_endpoint` string members plus a non-empty
`credential_configurations_supported` object whose entries have a non-empty
`format`. Phase 2B-1 adds fixture coverage for those structural configuration
contracts and the documented `POST /pre-authorized-data` request/response
shape through the traced transport seam. Phase 2B-2 implements the
pre-authorized offer operation against that contract, and Phase 2C exposes it
through the issuance-only `POST /api/runs/:id/offer` lifecycle operation.
Phase 2E exposes validated issuer selection metadata through
`GET /api/runs/:id/metadata`; the same issuance run is used for metadata
discovery and subsequent offer creation. Phase 2F creates that issuance run
only after the user explicitly starts an issuance attempt; visiting or
refreshing the Issuer page no longer allocates a running run. Metadata and
offer operations require that the shared run still exists, is an issuance
run, and remains running. Phase 2H normalizes offer request identity before
coordinating concurrent requests: identical normalized requests share one
in-flight operation, while conflicting requests receive a generic conflict
response. The selected credential format is chosen before run creation and
must match the selected issuer metadata configuration before an offer is sent.
The route is covered by isolated lifecycle tests and does not confirm a deployed
Certify
`CredentialIssuerMetadataDTO`; remaining metadata fields and their
deployment-specific values require a live or deployment-provided fixture
contract. Phase 2I now creates a durable `OfferOperation` before the remote
offer request. It records only the hashed normalized request identity,
configuration ID, format, status, and safe offer URLs. `pending`, `succeeded`,
`failed`, and `unknown` distinguish local progress from a potentially
remote-created offer. A definite protocol failure may be retried; an
`unknown` or restart-recovered `pending` operation is blocked with a generic
reconciliation-required response and is never automatically retried. No
reconciliation endpoint or remote idempotency guarantee has been verified yet.

The repository references OpenID4VCI draft 13 for Inji, but does not include
authoritative draft-13 metadata requirements or clause-level evidence. Required
metadata fields therefore remain an open verification item before credential
type selection and offer creation. The adapter validates absolute HTTP(S)
issuer and credential endpoint URLs without user-info or fragments. Whether
cross-origin credential endpoints are supported must be resolved before any
metadata-controlled URL is used for a subsequent network request.

Trace persistence failures are surfaced as the generic
`Protocol trace persistence failed` error, while unexpected transport
exceptions are surfaced as `Traced HTTP request failed`; neither raw error
messages nor exception values are recorded or returned.

Protocol callers should use `tracedRequest()` (or the test-only injectable
factory) rather than issuing requests directly through Axios. The production
Axios instance is private to this module so new callers cannot bypass the
tracing wrapper through the exported API.

| Step | Endpoint | Method | Path | Verification Level |
|---|---|---|---|---|
| 1 | **Issuer Metadata** | GET | `/.well-known/openid-credential-issuer` | ✅ Source-verified (controller `WellKnownController.java:28`) |
| 2 | **Pre-Authorized Data** | POST | `/pre-authorized-data` | ✅ Source-verified (`PreAuthorizedCodeController.java:16`) |
| 3 | **Credential Offer Retrieval** | GET | `/credential-offer-data/{offer_id}` | ✅ Source-verified (`PreAuthorizedCodeController.java:23`) |
| 4 | **OAuth Token Exchange** | POST | `/oauth/token` | ✅ Source-verified (`OAuthController.java:73`) |
|  | — Grant type: `authorization_code` | — | — | ✅ Source-verified (`iarService.processTokenRequest()`) |
| | — Grant type: `pre-authorized_code` | — | — | ✅ Source-verified (`preAuthorizedCodeService.exchangePreAuthorizedCode()`) |
| 5 | **Credential Issuance** | POST | `/issuance/credential` | ✅ Source-verified (`VCIssuanceController.java:21`) — requires access token |

**Evidence levels distinguished:**

- **Source-verified**: Endpoint path and DTOs exist in the `.java` source at v0.14.0 tag. No test execution or live deployment.
- **Structurally validated**: Metadata configuration entries and the mocked
  pre-authorized-data request/response shape are covered by fixture tests; this
  does not verify a live deployment.
- **Live-tested**: Not applicable — no running Inji Certify instance is configured in this project.
- **Blocked / not implemented**: Token exchange, credential issuance, and wallet handoff remain blocked; offer creation requires a configured base URL and supported metadata configuration.

---

## What Has Been Verified vs Tested vs Blocked

| Category | Status | Evidence |
|---|---|---|
| **Metadata discovery** (`GET /.well-known/openid-credential-issuer`) | ✅ Source-verified + structurally validated | Controller path confirmed; adapter tests validate issuer/endpoint URLs and non-empty credential configuration entries; no live deployment contacted |
| **Pre-authorized code offer** (`POST /pre-authorized-data`) | ✅ Implemented + fixture-tested | Adapter validates input and metadata support, posts the audited DTO through the traced boundary, validates `credential_offer_uri`, and keeps secrets out of recorded steps; no live deployment contacted |
| **Issuance lifecycle start** (`POST /api/runs/:id/offer`) | ✅ Implemented + isolated-tested | Requires an issuance run and durable offer operation; returns the offer only after safe local persistence, distinguishes definite failure from uncertain outcome, prevents unsafe retries, and leaves the run `running`; no credential is persisted |
| **Issuer metadata selection** (`GET /api/runs/:id/metadata`) | ✅ Implemented + mocked-tested | Returns only issuer URL, credential endpoint, and configuration ID/format pairs from validated metadata; claims and other protocol details are not exposed |
| **Credential offer retrieval** (`GET /credential-offer-data/{offer_id}`) | ✅ Source-verified | Path confirmed from `PreAuthorizedCodeController` |
| **OAuth token exchange** (`POST /oauth/token`) | ✅ Source-verified | Two grant types confirmed; `/oauth/token` (not `/oauth2/token`) |
| **Credential issuance** (`POST /issuance/credential`) | ✅ Source-verified | Requires bearer access token; DTOs confirmed |
| **End-to-end flow** | ❌ Blocked | No running Inji Certify v0.14.0 instance; Collab sandbox lacks pre-auth support |
| **Version compatibility** | ⚠️ Gap documented | Inji Certify on OpenID4VCI draft 13 / OpenID4VP draft 21-23; Animo on 1.0 |

### Remote offer outcome uncertainty

The playground cannot prove that no remote offer was created when the
`POST /pre-authorized-data` response is lost, malformed, or followed by a
trace-persistence failure. Phase 2I records this uncertainty durably and
blocks automatic retry, including after a process restart. It does not claim
remote idempotency because no such Certify contract has been verified. A
deployment-specific reconciliation path is still required before an
`unknown` operation can safely be retried or resumed.

Offer responses with HTTP 5xx status are also classified as `unknown`,
because a server-side failure response does not prove that the issuer
performed no remote side effect. HTTP 4xx responses remain definite request
failures; this classification does not imply remote idempotency.

---

## Collab Authorization-Code vs Pre-Authorized-Code Limitation

- **Collab sandbox issuers** (MOSIP community deployment) support **Authorization Code flow only**, as documented in `docs/FORUM_NOTES.md:50`.
- **Pre-authorized Code flow** is supported by Inji Certify v0.14.0 source (`/pre-authorized-data`, `/oauth/token` with `grant_type=pre-authorized_code`), but **cannot be tested against Collab**.
- **Workaround**: Use Animo playground as external issuer (`EXTERNAL_ISSUER_BASE_URL=https://playground.animo.id`), but a **version/profile gap exists** (Inji on draft 13/23, Animo on 1.0). Record in `interop-gaps.md`, do not hide.

---

## Animo Version/Profile Compatibility Gap

| Aspect | Inji Certify (this project) | Animo Playground (external) | Gap |
|---|---|---|---|
| **OpenID4VCI version** | Draft 13 | 1.0 | ❌ Major version mismatch |
| **OpenID4VP version** | Draft 21-23 | 1.0 | ❌ Major version mismatch |
| **SD-JWT support** | `vc+sd-jwt`, `dc+sd-jwt` | Not verified | ⚠️ Unknown |
| **mDoc/mDL support** | ❌ Not in v0.14.0 | ✅ Supported | ❌ Feature gap |
| **Impact** | Cannot claim interop with Animo without version gap admission | | Record in `interop-gaps.md`; do not fabricate compatibility |

---

## Mimoto and Mobile-Wallet Integration Requirements

| Requirement | Status | Notes |
|---|---|---|
| **Mimoto 0.22.0** (wallet backend) | ⚠️ Configured but not running | `MIMOTO_BASE_URL` env var; see `config.ts` |
| **Inji Wallet (mobile Android/iOS)** | ❌ Not integrable without deployment | Rule 2 (CLAUDE.md): "Do not build a wallet. Show QR → user scans → we detect result" |
| **Inji Web Wallet** | ⚠️ Configured (`INJI_WEB_BASE_URL`) | No entry point for externally generated credential offers (confirmed by source search: zero matches for `credential_offer` in `inji-web/src`) |
| **Public HTTPS required** | ❌ Not available locally | Mobile wallet must reach backend via `https://` URL; requires ngrok/cloudflared tunnel |
| **Deep link / QR code** | ✅ UI supported | `openid-credential-offer://` scheme not supported by Inji Web; mobile wallets only |

**Key constraint**: Offer creation now has an evidence-backed adapter contract and issuance lifecycle entry point, but no token exchange, credential issuance, wallet handoff, or live end-to-end result is claimed. No fake QR codes or placeholder credentials are generated.

---

## Unknown Client-Authentication Requirements

The OAuth token endpoint (`POST /oauth/token`) may require client authentication that has **not been verified** in this project. Possible requirements include:

- `client_id` + `client_secret` (HTTP Basic auth)
- `client_assertion` (JWT bearer)
- `mtls` (mutual TLS)

**Source evidence**: `OAuthController.java:73` shows `@RequestParam Map<String, String> params` — the exact authentication mechanism depends on the authorization server configuration, which is not set in this project (`EXTERNAL_ISSUER_BASE_URL` is configured but no token exchange has been executed).

**Required to declare end-to-end issuance successful**: Token exchange must execute against a running instance with observed request/response, including any `Authorization:` header or `client_assertion` parameter.

---

## Exact Blockers Preventing Real Issuance

| Blocker | Impact | Status |
|---|---|---|
| **No running Inji Certify v0.14.0 instance** | Cannot execute any issuance step beyond metadata discovery | 🔴 Critical |
| **Collab sandbox lacks pre-auth support** | Pre-auth flow cannot be tested against Collab | 🟡 Workaround: Animo with version gap |
| **Version gap Inji (draft 13/23) vs Animo (1.0)** | Cannot claim protocol-level interop | 🟡 Documented in gaps table |
| **No Mimoto instance running** | Wallet `acceptOffer`/`presentCredential` cannot be exercised | 🔴 Critical |
| **No public HTTPS tunnel** | Mobile wallet cannot reach backend services | 🟡 Requires ngrok/cloudflared |
| **Client authentication at `/oauth/token`** | Token exchange may fail without correct auth scheme | 🟡 Unknown; must be observed live |
| **`tx_code` requirement for pre-auth flow** | Pre-auth token exchange needs transaction code from offer generation | 🟡 Source shows it's required; must be obtained from `POST /pre-authorized-data` response |

---

## Evidence Required to Declare End-to-End Issuance Successful

The following must be observed and recorded (via the backend tracing proxy + Protocol Inspector) before any interop claim can be made:

1. **Metadata discovery**: `GET /.well-known/openid-credential-issuer` returns `200` with valid `CredentialIssuerMetadataDTO`; record method, URL, status, duration as a `Step`.
2. **Pre-authorized offer**: `POST /pre-authorized-data` returns `200` with `credential_offer_uri`; record request/response (redacted).
3. **Offer retrieval**: `GET /credential-offer-data/{offer_id}` returns `200` with `CredentialOfferResponse`; record step.
4. **Token exchange**: `POST /oauth/token` with `grant_type=pre-authorized_code` + `pre-authorized_code` + `tx_code` returns `200` with `OAuthTokenResponse` containing `access_token` and `c_nonce`; record headers (secrets redacted), status, duration.
5. **Credential issuance**: `POST /issuance/credential` with `Authorization: Bearer <access_token>` + `CredentialRequest` body returns `200` with `CredentialResponse` (signed VC); record step.
6. **Presentation flow**: OpenID4VP presentation request → wallet scans QR → presents VP → `POST /vp-request` → long poll → `GET /vp-result/{transactionId}` → verdict (`SUCCESS` or `FAILED`).
7. **All steps traced**: Each step pushed over socket.io to the Protocol Inspector room, saved to SQLite, and displayed with method/URL/headers-redacted/status/duration.

A status of **"Live-tested"** requires steps 1-6 to have been executed against a running deployment and the results recorded in a run.

---

## Status Table: Implemented / Source-Verified / Structurally Validated / Live-Tested / Blocked

| Feature | Implemented | Source-Verified | Structurally Validated | Live-Tested | Blocked / Not Implemented |
|---|---|---|---|---|---|
| **Metadata discovery** (`GET /.well-known/openid-credential-issuer`) | | ✅ | | | |
| **Pre-authorized data** (`POST /pre-authorized-data`) | | ✅ | | | |
| **Credential offer retrieval** (`GET /credential-offer-data/{offer_id}`) | | ✅ | | | |
| **OAuth token exchange** (`POST /oauth/token`) | | ✅ | | | |
| **— authorization_code grant** | | ✅ | | | |
| **— pre-authorized_code grant** | | ✅ | | | |
| **Credential issuance** (`POST /issuance/credential`) | | ✅ | | | |
| **OpenID4VP presentation request** | | | | | ❌ |
| **Wallet accept offer** | | | | | ❌ |
| **Wallet present credential** | | | | | ❌ |
| **Verifier receive presentation** | | | | | ❌ |
| **End-to-end issuance flow** | | | | | ❌ |
| **End-to-end presentation flow** | | | | | ❌ |

✅ = Source-verified (endpoint path and DTOs confirmed from v0.14.0 Java source)
🟡 = Structurally plausible but not tested
❌ = Blocked/not implemented (no running deployment)

---

## Evidence Table: What Would Constitute "Live-Tested"

| Step | Required Observation | Recording Method |
|---|---|---|
| 1. Metadata discovery | `200` response from `GET /.well-known/openid-credential-issuer` | Step: `name: "issuer_metadata"`, `stage: "issuance"`, `httpStatus: 200` |
| 2. Pre-auth offer | `200` from `POST /pre-authorized-data` + `credential_offer_uri` in response | Step: `name: "pre_authorized_offer"`, `response: { credential_offer_uri }` (redacted) |
| 3. Offer retrieval | `200` from `GET /credential-offer-data/{offer_id}` | Step: `name: "credential_offer"`, `response: { ... }` (redacted) |
| 4. Token exchange | `200` from `POST /oauth/token` + `access_token` + `c_nonce` in response | Step: `name: "token_exchange"`, `httpAuth: "Bearer"` (redacted) |
| 5. Credential issuance | `200` from `POST /issuance/credential` + VC in response | Step: `name: "credential_issuance"`, `authorization: "Bearer <token>"` (redacted) |
| 6. Presentation request | `201` from `POST /vp-request` + `requestId` + `requestUri` | Step: `name: "presentation_request"`, `stage: "presentation"` |
| 7. Verification verdict | `vpResultStatus: "SUCCESS"` from `GET /vp-result/{transactionId}` or `allChecksSuccessful: true` from `POST /v2/vp-results/{transactionId}` | Step: `name: "verification_result"`, `verificationResult: "VALID"` |

---

## Summary

This document records **what has been verified from source** (Inji Certify v0.14.0 Java controller paths) and **what remains blocked** (no live deployment, no end-to-end flow). The project correctly:

- Blocks credential-offer creation when issuer is unconfigured, the request is invalid, or metadata does not advertise the requested configuration.
- A successful offer leaves the issuance run in `running`; adapter, network, and trace-persistence failures return generic errors and do not produce a successful status.
- Metadata discovery is tied to the issuance run so the existing traced HTTP boundary records the exchange; the frontend reuses that run when requesting an offer.
- Reports discovery separately from issuance
- Does not fabricate successful responses or pretend interop
- Keeps all service URLs from environment variables only
- Maintains honest UI status ("blocked because its v0.14.0 contract is not verified")

**To achieve live-tested status**: Deploy a running Inji Certify v0.14.0 instance, configure `CERTIFY_BASE_URL` or `CERTIFY_LOCAL_BASE_URL`, and execute the 7-step traced protocol flow, recording all steps via the backend tracing proxy.