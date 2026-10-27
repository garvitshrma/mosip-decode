# Phase 0 — Try the real flow on Collab

Goal: everyone on the team sees the real issue → hold → present → verify flow once,
and we save the network traffic so we know exactly what our playground has to show.

Time: about 1 hour. Use Chrome on a laptop (and a phone for part C).

## Before you start

- Open Chrome DevTools (F12) → **Network** tab → tick **Preserve log**.
- After each part, right click in the Network list → **Save all as HAR with content**.
- Save the files in `docs/fixtures/har/` with names like `a-issue-insurance.har`.
- HAR files can contain tokens and personal data. These are sandbox test accounts so it's ok,
  but don't use your real details anywhere.

## A. Issue a credential (Inji Web)

1. Go to https://injiweb.collab.mosip.net
2. Pick **StayProtected Insurance** (easiest, no registration).
3. On the eSignet login page enter:
   Policy Number `12345`, Name `insuranceCredentials`, DOB `2000-01-01`.
4. Download the credential and open it. Note the format (JSON-LD), the issuer and the proof type.
5. Save HAR → `a-issue-insurance.har`

What to look for in the Network tab:
- `.well-known/openid-credential-issuer` (issuer metadata)
- the `authorize` redirect to eSignet and the `token` call
- the `credential` request and its response (that's the VC)

## B. Verify by QR / upload (Inji Verify)

1. Go to https://injiverify.collab.mosip.net
2. Upload the QR / PDF you downloaded in part A.
3. Note the result screen (valid / expired / invalid).
4. Save HAR → `b-verify-upload.har` (look for `vc-verification`).

## C. Present over OpenID4VP (cross-device)

Needs the Inji mobile wallet: https://docs.inji.io/inji-wallet/inji-mobile/functional-overview/sandbox-details

1. Install Inji Wallet on a phone and download the same insurance credential.
2. On the laptop, open Inji Verify → **VP Verification** → select the credential type → **Generate QR**.
3. Scan the QR with the phone and share.
4. Save HAR from the laptop → `c-vp-cross-device.har`
   (look for `vp-request`, `vp-request/.../status`, `vp-result`).

## D. Write down what you saw

Add a few lines per part to the bottom of this file:
- what worked, what was confusing
- any errors
- anything that looks like an interop problem (format names, unsupported proof types, QR too big)

## Notes from the team

<!-- add notes here -->
