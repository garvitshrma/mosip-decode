# Forum notes: official PS2 guidance

What MOSIP mentors have said about problem statement #2. **This overrides our own assumptions.**
Summarised faithfully, not quoted verbatim. Follow the links for the exact wording.

---

## Thread: Clarification on Interoperability Test Scenarios

Source: https://community.mosip.io/t/clarification-on-interoperability-test-scenarios-for-inji-interoperability-playground/2922

- **Post 1** - Yashaswini_K_P, 5 Oct 2026. Asked whether teams should define specific combinations of
  Inji components, configurations and formats to test against each other, or just demonstrate the
  scenarios listed in the PS. Asked how to know which combinations are expected without testing all of
  them, and for an example test scenario structure.
- **Post 2** - mrudula, 6 Oct 2026. Team MOSIP acknowledged, said they would respond.
- **Post 3** - sanchi-singh24, 7 Oct 2026, on behalf of Inji. The substantive answer, below.

### Overall goal

A **configurable** interoperability playground that reflects the Inji ecosystem and also demonstrates
interoperability with other credential stacks. The process must be visible: protocol steps, success or
failure at each stage, the overall result, and where a failure occurred.

### Issuer section

- The user selects **issuer**, **credential type**, and **issuance configuration**.
- The user selects the **issuance flow**: Authorization Code or Pre-Authorized Code.
- Reference for which issuers and credential types exist: the **issuers list on Inji Web (Collab)**.
- Output is a credential offer / QR code that Inji Mobile Wallet or another compatible wallet can scan.
- The architecture must allow more issuers to be added beyond Inji Certify.

### Wallet section

- Reference Inji Mobile Wallet (Android and iOS) and Inji Web Wallet.
- **Do not implement another wallet inside the playground.** Show which wallet is in use and how the
  flow continues from there.

### Verify section

- Support the OpenID4VP presentation flow through Inji Verify.
- The user **selects and configures the requested credentials** and **customises the presentation
  request**. Reference: Inji Verify's `config.json`, v1.0.0-alpha.1.
- Reference for supported credentials: Inji Verify's "Request Verifiable Credentials" flow.
- Output is a presentation request / QR code for the wallet to scan.

### Scenarios and test matrix

- The aim is **not** to test every possible combination. Use a curated set of representative scenarios.
- Baseline: Inji Certify -> Inji Wallet -> Inji Verify.
- Start with Inji <-> Inji, Inji <-> External, and External <-> Inji, then expand as more external
  stacks are onboarded.
- Named examples: External Issuer -> Inji Wallet -> Inji Verify; Inji Certify -> External Wallet ->
  Inji Verify; External -> External -> Inji Verify; Inji Certify -> Inji Wallet -> External Verifier.
- Worked example given: External Issuer -> Inji Mobile Wallet -> Inji Verify, using SD-JWT VC over
  OpenID4VCI and OpenID4VP.

### External stack: Animo playground

- https://playground.animo.id
- Implements **OpenID4VC 1.0** and **OpenID4VP 1.0**, **SD-JWT VC** and **mDOC**.
- Implements most of the High Assurance Interoperability Profile; full support still pending.
- Note the version gap: Inji is on OpenID4VCI draft 13 and OpenID4VP draft 21-23. Animo is on 1.0.
  That mismatch is an expected finding and goes in `interop-gaps.md`, it does not get hidden.

### Protocol steps the playground must make visible

- **Issuance:** credential offer -> authorization -> token request/response -> credential
  request/response -> credential issued.
- **Presentation:** presentation request -> **credential selection** -> presentation -> verification.

Note that credential selection happens inside the wallet and is a user action, not an HTTP exchange.
The step model has to be able to record non-HTTP steps.

### What each run must report

Components involved, credential format, **protocol and version**, result per step, overall result, and
where it failed.

### Extensibility

New issuers, wallets, verifiers, credential formats, protocols and test scenarios must be addable
without redesigning the core.

### Reference playgrounds suggested by the mentor

- https://playground.hovi.id
- https://vcplayground.org
- https://playground.animo.id

---

## What this changed in our plan

Recorded 11 Oct 2026, after reading the thread.

1. `credentialType` is a selection dimension we had missed, and it is **per issuer**, discovered from
   the Inji Web issuers list rather than hardcoded.
2. `issuanceFlow` (auth code vs pre-auth) is explicitly required, not optional.
3. Customising the **presentation request** is a required feature, not a nice-to-have. It was in no
   phase of our plan.
4. **Protocol version** is a reported field per run, and is the headline interop signal against Animo.
5. Steps are not all HTTP. Credential selection and QR scanning are user actions.

---

## Thread: Inji Wallet integration and verification result retrieval

Source: https://community.mosip.io/t/clarification-on-inji-wallet-integration-and-verification-result-retrieval-for-the-interoperability-playground/2930

**Post 1** - Yashaswini_K_P, 10 Oct 2026. **No mentor reply as of 11 Oct 2026.** Four open issues,
raised by another team, all of which apply to us. Our own answers are in `PHASE0_NOTES.md`, verified
against source; they are our findings, not mentor guidance.

1. **Certify -> Inji Web issuance.** They could not find a frontend entry point in Inji Web for
   accepting an externally generated credential offer. Confirmed by us: Inji Web has no such entry
   point at all. Externally generated offers go to a mobile wallet.
2. **Inji Web -> Verify presentation.** They asked for a reference for launching Inji Web with a
   playground-generated request, and for the verifier trust configuration. Found by us:
   `/user/authorize` plus Mimoto's `/wallets/{walletId}/presentations` and `/trusted-verifiers`.
3. **Retrieving the verification result.** They correctly refuse to report PASS on a created request
   or an HTTP 200. Answer found by us: `GET /vp-result/{transactionId}` or
   `POST /v2/vp-results/{transactionId}`. The status long poll is delivery status, not a verdict.
4. **Local vs Collab.** Docker-internal hostnames and localhost are not reachable from a phone.
   Public https tunnel required for anything a wallet has to resolve.

---

## Thread: Wallet integration and verification result retrieval (answered 13 Oct 2026)

Source: https://community.mosip.io/t/clarification-on-inji-wallet-integration-and-verification-result-retrieval-for-the-interoperability-playground/2930

The Inji team's reply adds four concrete requirements:

1. **Support both issuance flows.** Inji Mobile supports authorization code and pre-authorized code; **Inji Web should use authorization code** because credential-offer flow is mobile-only.
2. **Presentation:** generate the request from the Verify section and provide a way to launch the wallet. A **DID-based request** is acceptable and does **not** require pre-registering the verifier.
3. **Never treat submission HTTP 200 as verification success.** Fetch the verdict separately from Inji Verify's result API (the reply points to `VPResultController.java`, `v1.0.0-alpha.1`: `GET /vp-result/{transactionId}` and `POST /v2/vp-results/{transactionId}`).
4. **Start locally with Docker Compose**, then try Collab. Use ngrok/cloudflared for anything a phone must resolve. The team points to `inji-mock-services` (`develop`) as a reference, and pins Certify/Verify/Mobile/Web to `v1.0.0-alpha.1`.

## Thread: PS02 Web login and sandbox pre-authorized issuance (17 Oct 2026)

Source: https://community.mosip.io/t/ps02-inji-web-login-and-sandbox-pre-authorized-issuance-configuration/2933

Open as of this writing. The visible MOSIP reply only acknowledges the question; there is **no confirmed** answer for the stored-wallet Google OAuth client, a test IdP alternative, or whether public Mock Certify configurations support pre-authorized issuance. Do not assume those are configured.

## Thread: Queries regarding PS2 (24 Oct 2026)

Source: https://community.mosip.io/t/queries-regarding-ps2/2945

Open as of this writing. No MOSIP reply is visible. The five questions: (1) is a stable-0.x local bundle acceptable, or must the local bundle itself run `v1.0.0-alpha.1`; (2) DCQL claim paths for W3C credentials in Inji Verify 1.0 — `["credentialSubject","email"]` vs the shorter `["email"]`; (3) which `client_id` and redirect the alpha Inji Wallet uses for an authorization-code offer from outside Mimoto's issuer list; (4) Collab test data — extra demo UINs, a possible Land Registry key rotation, and the Mock issuer DID arrangement; (5) where to report security problems privately. None of these change the prototype plan; they remain open questions.

## Official announcement: deadline extended (27 Oct 2026)

Source: https://community.mosip.io/t/mosip-decode-2026-submission-deadline-extended-to-2-november-2026/2947

Team MOSIP extended the submission deadline to **2 November 2026** and asked teams to upload all
required materials as per the Submission Guidelines. This is logistics, not a technical requirement
change. Support address: `decode@mosip.io`.

## Latest check (27 Oct 2026)

- No new official technical guidance after the 13 Oct 2026 reply in topic 2930. That topic was auto-closed on 23 Oct 2026.
- Topic 2933 (Inji Web login and sandbox pre-authorized issuance) has only an acknowledgement from Mrudula dated 21 Oct 2026; the questions remain unanswered.
- Topic 2945 ("Queries regarding PS2", 24 Oct 2026) still has no reply. Nothing in it changes the prototype plan; its answers are already implemented or recorded as open gaps.
- A nearby unlabeled topic (2943, "Local Inji Web credential download fails with RESIDENT-APP-028") reports a local Compose/eSignet/Mimoto download failure with no official reply; it is not PS02 guidance.
- Conclusion: the 7 Oct and 13 Oct replies are still the latest technical requirement set, and the local reference stack covers the requirements they describe. The only new official notice is the 27 Oct deadline extension (covered above).

## What we changed in the prototype because of these threads

- The local demo supports **both** authorization-code and pre-authorized-code flows.
- The verifier records a **separate `verification_result` step** after the VP submission; HTTP 200 alone never sets PASS.
- The verifier identity and VP proof are **DID-based** (`did:jwk`) and bind the request nonce.
- The Playground exposes issuer, wallet, verifier, format and flow choices, and a curated local stack rather than a full Cartesian product.
- The Wallet page shows the persisted signed credential; the Protocol Inspector shows every issuance and presentation exchange.

Still to do for live Inji interop: wire real Certify/Mimoto/Verify deployments, add the QR/wallet handoff for Inji Mobile, add Inji Web authorization-code flow, and build the curated Inji ↔ external scenario matrix (Animo/Hovi).
