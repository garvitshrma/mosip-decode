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
