# Phase 0 notes: verified Inji endpoints

Rule 7 says never invent an Inji endpoint. Everything below was read from source at the commit named,
with the file path given. If something is not in this file, it has not been verified yet.

Verified 11 Oct 2026.

---

## Inji Verify

Repo `github.com/inji/inji-verify`, shallow clone at commit `b9f1e9d` (default branch, last commit
2026-07-28). Package root `verify-service/src/main/java/io/inji/verify`.

### Constants

`shared/Constants.java`

| Constant | Value |
| --- | --- |
| `VP_REQUEST_URI` | `/vp-request` |
| `RESPONSE_SUBMISSION_URI_ROOT` | `/vp-submission` |
| `RESPONSE_SUBMISSION_URI` | `/direct-post` |
| `VP_DEFINITION_URI` | `/vp-definition/` |
| `RESPONSE_TYPE` | `vp_token` |
| `RESPONSE_MODE` | `direct_post` |
| `COOKIE_NAME` | `transaction_id` |
| `DEFAULT_EXPIRY` | 300 seconds |

Supported VP formats (same file): `ldp_vp` with `Ed25519Signature2018`, `Ed25519Signature2020`,
`RsaSignature2018`. `sd-jwt` with `RS256`, `ES256`, `ES256K`, `EdDSA`.

### Endpoints

`controller/VPRequestController.java`

- `POST /vp-request` - create a presentation request.
  Body `VPRequestCreateDto`: `clientId` (required, not blank), `transactionId`,
  `presentationDefinitionId`, `nonce`, `presentationDefinition`, `acceptVPWithoutHolderProof`,
  `responseCodeValidationRequired`.
  One of `presentationDefinitionId` or `presentationDefinition` must be set, otherwise 400
  `BOTH_ID_AND_PD_CANNOT_BE_NULL`.
  Returns 201 `VPRequestResponseDto`: `transactionId`, `requestId`, `authorizationDetails`,
  `expiresAt`, `requestUri`.
- `POST /vp-session-request` - same, but also sets the `transaction_id` cookie (base64 of the
  transaction id, httpOnly, max age `inji.verify.cookie-duration-in-minute`, default 5).
- `GET /vp-request/{requestId}` - produces `application/oauth-authz-req+jwt`, the signed request
  object. 404 `NO_AUTH_REQUEST` if unknown.
- `GET /vp-request/{requestId}/status` - **long poll**. Spring `DeferredResult`, timeout
  `inji.vp-request.long-polling-timeout`, env `INJI_VP_REQUEST_LONG_POLLING_TIMEOUT`, default 55000 ms.
  Returns `VPRequestStatusDto { status }` where status is `ACTIVE`, `VP_SUBMITTED` or `EXPIRED`
  (`enums/VPRequestStatus.java`).

`controller/VPSubmissionController.java`

- `POST /vp-submission/direct-post` - where the wallet posts. Consumes
  `application/x-www-form-urlencoded`.

`controller/VPResultController.java`

- `GET /vp-result/{transactionId}` - returns `VPTokenResultDto`:
  `transactionId`, `vpResultStatus` (`SUCCESS` or `FAILED`, `enums/VPResultStatus.java`), `vcResults`.
  If no request ids exist for the transaction it falls back to
  `vcSubmissionService.getVcWithVerification(transactionId)`, which returns a **different shape**, or
  404 `INVALID_TRANSACTION_ID`.
- `POST /v2/vp-results/{transactionId}` - returns `VPVerificationResultDto`:
  `transactionId`, `allChecksSuccessful` (boolean), `credentialResults`.
- `POST /vp-session-results` - cookie-based variant, requires the `transaction_id` cookie, clears it
  afterwards. 401 `VP_SESSION_INVALID` without it.

`controller/VPDefinitionController.java`

- `GET /vp-definition/{id}`

`controller/VCVerificationController.java`

- `POST /vc-verification`, `POST /v2/vc-verification` - verify a single VC, no presentation involved.

`controller/DidWebController.java`

- `GET /did.json`

### The result-vs-status distinction

Three different things return success and only the last one is a verdict:

1. `POST /vp-request` returning **201** means a request was created.
2. `GET /vp-request/{requestId}/status` returning **VP_SUBMITTED** means a wallet delivered something.
3. `GET /vp-result/{transactionId}` returning **`vpResultStatus: SUCCESS`**, or
   `POST /v2/vp-results/{transactionId}` returning **`allChecksSuccessful: true`**, is the verdict.

The playground must take pass/fail from (3) only.

### Known gotchas

- `services/impl/VerifiablePresentationRequestServiceImpl.java` keeps long-poll listeners in a plain
  in-process `HashMap<String, DeferredResult<...>>`. With more than one replica behind a load
  balancer the status long poll will miss notifications. Single instance for the demo.
- `result.onTimeout(...)` re-reads current status, so a timed-out poll returns a real status rather
  than erroring. Re-poll in a loop.
- `acceptVPWithoutHolderProof` and `responseCodeValidationRequired` on the create call are the levers
  for negative-path testing (Phase 5 tamper mode).

---

## Inji Web and Mimoto

Repo `github.com/inji/inji-web`, shallow clone of the default branch. App root `inji-web/`.

### Routes

`src/utils/constants.ts`, wired in `src/Router.tsx`

`/`, `/issuers`, `/issuers/{id}`, `/redirect`, `/faq`,
`/user`, `/user/passcode`, `/user/home`, `/user/issuers`, `/user/issuers/{id}`,
`/user/credentials`, `/user/profile`, `/user/faq`, `/user/reset-passcode`, `/user/authorize`.

### There is no credential-offer entry point

A case-insensitive search of `inji-web/src` for `credential_offer`, `credential-offer`,
`credentialOffer`, `pre-authorized` and `preAuthorized` returns **zero matches**. Inji Web cannot be
handed an externally generated OpenID4VCI credential offer. Its issuance path is issuer selection
followed by an authorization-code flow through Mimoto, returning via `/redirect`.

Consequence: a playground-generated credential offer goes to a **mobile** wallet by QR or
`openid-credential-offer://` deep link. Inji Web is only usable as the holder for its own
issuer-selection flow.

### Presentation into Inji Web: `/user/authorize`

`src/pages/VPAuthorizationPage.tsx` and `src/utils/api.ts`.

The page takes the OpenID4VP authorization request **as its own query string**. It reads
`window.location.search`, prefixes it with `OPENID4VP_AUTHORIZE_PREFIX` (`openid4vp://authorize`,
`src/utils/constants.ts:70`) and posts the result to Mimoto:

- `POST {mimotoHost}/wallets/{walletId}/presentations`
  body `{ authorizationRequestUrl: "openid4vp://authorize" + <query string> }`
  returns `{ presentationId, verifier }` where `verifier` has a `trusted` flag.

So the same-device launch URL is:

```
https://<inji-web-host>/user/authorize?<everything you would put after openid4vp://authorize>
```

Follow-on calls, all requiring the session cookie (`credentials: "include"`) and a `walletId` in
local storage, so the user must be signed in:

- `POST {mimotoHost}/wallets/{walletId}/trusted-verifiers` - trust an unknown verifier.
- `GET {mimotoHost}/wallets/{walletId}/presentations/{presentationId}/credentials` - the credential
  selection step.
- `PATCH {mimotoHost}/wallets/{walletId}/presentations/{presentationId}` - submit the presentation.
- `PATCH {mimotoHost}/wallets/{walletId}/presentations/{presentationId}` with
  `{ errorCode: "access_denied", errorMessage: ... }` - reject.

If `verifier.trusted` is false the UI shows a trust prompt first. A playground verifier with a new
`clientId` will always hit that prompt on first use. That is a user step, not a bug.

---

## Still unverified

Do not write code against these until they are checked and added here.

- Inji Certify endpoints. The pre-auth paths quoted on the forum
  (`/v1/certify/pre-authorized-data`, `/credential-offer-data/{offer_id}`, `/oauth/token`) have
  **not** been checked against `inji/inji-certify` source.
- Mimoto's issuers list API, which is the source of the issuer and credential-type dropdowns.
- Inji Verify `config.json` v1.0.0-alpha.1, the reference for customising presentation requests.
- Animo playground's actual endpoints.
