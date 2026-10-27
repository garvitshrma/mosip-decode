# MOSIP Decode 2026 — PS02 Submission Checklist

Deadline: one day. This page is the short version; the full demo script and API examples are in
[`DEMO_GUIDE.md`](DEMO_GUIDE.md).

## Already done in this checkout

- [x] Working local prototype: issue → hold → present → verify with real Ed25519 signatures.
- [x] Both issuance flows: pre-authorized code and authorization code.
- [x] Three formats: `ldp_vc`, `vc+sd-jwt`, `dc+sd-jwt`.
- [x] Real verifier checks: issuer signature, holder signature, holder binding, type, issuer, nonce, expiry.
- [x] Separate verification-result step; submission success is not treated as verification success.
- [x] Protocol Inspector with every recorded step and redacted secrets.
- [x] Wallet page shows the persisted signed credential.
- [x] QR-ready offer and presentation-request artifacts.
- [x] One-command Docker Compose file (backend + nginx frontend + SQLite volume), verified end to end on 27 Oct 2026.
- [x] Usage/install instructions in the README and demo guide.
- [x] API documentation in the README and demo guide.
- [x] Architecture diagram (Mermaid) in the demo guide.
- [x] Test data, test cases and current results.
- [x] Forum research summary in `docs/FORUM_NOTES.md`, including the newer PS02 threads.

## Commands to run before recording

```bash
# With Docker
docker compose up --build
# open http://localhost:5173/playground

# Without Docker
npm run setup
npm run dev

# Checks
npm run typecheck
npm run build
cd backend && npm test
```

Current state (checked 27 Oct 2026): typecheck passes, production build passes, 65 backend tests pass, the Docker one-command stack builds and runs, and the local flow
passes through the HTTP API and the browser.

## Only the team can do these

- [ ] **Record the video (2–5 min).** Use the script in section 4 of `DEMO_GUIDE.md`.
- [ ] **Finish the pitch deck (5–7 slides).** Problem, solution, live demo, architecture, interop gaps,
      impact, roadmap. Use the screenshots from the running app.
- [ ] **Design mockups/wireframes.** Export 3–4 screens from the app or recreate the flow in Figma.
- [ ] **College/university IDs.** Each student uploads a valid ID.
- [ ] **Push the code.** Commit and push the changes so the Git history is visible. Confirm the repo is
      public or accessible to MOSIP.
- [ ] **Check every link.** Test the repo link, video link, deck link and any Drive folder in an
      incognito window.
- [ ] **Send the email.** To `decode@mosip.io` with:
      team name, problem statement (PS02), and all URLs.

## What to say (and not say)

Say:

- "The local reference stack runs the full lifecycle with real signatures, so the demo is reproducible
  without the Collab sandbox."
- "The Inji Certify / Mimoto / Inji Verify adapters are present but blocked until configured; we do not
  claim live Inji interop."
- "We support both issuance flows and all three demo formats."
- "The verifier result is a separate, server-verified step."

Do **not** say:

- "We tested against Inji Certify/Verify" unless you actually configure and run them.
- "This is OpenID4VP 1.0 / OpenID4VCI 1.0 conformant." It is a simplified demo profile.
- "The QR works with Inji Wallet." The local QR is a protocol artifact; external wallet handoff is
  not connected.

## One-day timeline

| Time | Task |
|---|---|
| Morning | `docker compose up --build`; click through both flows; run tests/build; fix ports. |
| Midday | Record the 2–3 minute video; capture 4–5 screenshots. |
| Afternoon | Finish the deck and design/wireframe slides; paste the architecture diagram and test matrix. |
| Evening | Push the repo, check public links, send the submission email. |

## Demo route (if a judge asks for the fastest path)

1. Open `/playground`.
2. Keep the local reference stack, choose `ldp_vc`, pre-authorized code.
3. Click **Run end-to-end demo**.
4. Point at the pass card, the 9–10 inspector steps, the two QR artifacts and the Wallet page.
5. Change the flow to authorization code and run again to show the extra `authorization` step.
