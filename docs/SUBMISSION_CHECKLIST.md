# MOSIP Decode 2026 — PS02 Submission Checklist

> **Official deadline: 2 November 2026** (extended; announced by Team MOSIP on 27 Oct 2026).
> State of this checkout: checked 27 Oct 2026. Full demo script and API examples are in
> [`DEMO_GUIDE.md`](DEMO_GUIDE.md); the slide-by-slide deck draft is in [`PITCH_DECK.md`](PITCH_DECK.md).

## The official submission process (from the guidelines PDF)

1. **Source code** → put it in a private/public repository of your choice (this GitHub repo).
2. **Other deliverables** (deck, video, screenshots, college IDs, ...) → put them in a cloud folder,
   e.g. Google Drive.
3. **Submit** → email **decode@mosip.io** with: **Team Name**, **Problem Statement Addressed**
   (PS02), and **URLs**.
4. **Ensure all links and files are accessible to MOSIP** (public links, or share with the provided
   address). Test every link in an incognito window.

MOSIP also notes that all work will be published to topic-specific public repositories on MOSIP's
GitHub — so keep the claims in the docs and deck honest.

## Already done in this checkout

- [x] Working local prototype: issue → hold → present → verify with real Ed25519 signatures.
- [x] Both issuance flows: pre-authorized code and authorization code.
- [x] Three formats: `ldp_vc`, `vc+sd-jwt`, `dc+sd-jwt`.
- [x] Real verifier checks: issuer signature, holder signature, holder binding, type, issuer, nonce, expiry.
- [x] Separate verification-result step; submission success is not treated as verification success.
- [x] Protocol Inspector with every recorded step and redacted secrets.
- [x] Wallet page shows the persisted signed credential.
- [x] QR-ready offer and presentation-request artifacts.
- [x] One-command Docker Compose file (backend + nginx frontend + SQLite volume), verified end to end
      through nginx on 27 Oct 2026.
- [x] Pitch deck draft: 7 slides + appendix, with speaker notes ([`PITCH_DECK.md`](PITCH_DECK.md)).
- [x] Seven app screenshots captured from the running Docker demo
      ([`docs/screenshots/`](screenshots/)) — they also serve as the design-mockup deliverable.
- [x] Usage/install instructions in the README and demo guide.
- [x] API documentation in the README and demo guide.
- [x] Architecture diagram (Mermaid) in the demo guide and deck.
- [x] Test data, test cases and current results.
- [x] Research updated: official guidelines, deadline extension, and all four PS02 forum threads
      ([`FORUM_NOTES.md`](FORUM_NOTES.md)).

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

Current state (checked 27 Oct 2026): typecheck passes, production build passes, 65 backend tests
pass, the Docker one-command stack builds and runs, and the local flow passes through the HTTP API
and the browser.

## Only the team can do these

- [ ] **Record the video (2–5 min).** Use the script in section 4 of `DEMO_GUIDE.md`; the screenshots
      in `docs/screenshots/` show the exact views to capture.
- [ ] **Style and export the deck.** Copy `PITCH_DECK.md` into Google Slides / Canva / PowerPoint
      (7 slides — matches the "5–7 slide pitch" format). Add team names on slide 1.
- [ ] **Push the branch and open the PR.**
      ```bash
      cd mosip-decode
      git push -u origin feat/ps02-working-prototype
      # then open the compare link offered by GitHub (or your team's PR flow)
      ```
      Then confirm the repository is public or accessible to MOSIP.
- [ ] **College/university IDs.** Each student uploads a valid ID.
- [ ] **Put the non-code deliverables in one cloud folder** (Google Drive or similar): deck, video,
      screenshots, college IDs.
- [ ] **Check every link.** Test the repo link, video link, deck link and folder in an incognito
      window.
- [ ] **Send the email.** Template below, to `decode@mosip.io`.

## Submission email template

```text
To: decode@mosip.io
Subject: MOSIP Decode 2026 — Team <team name> — PS02 submission

Dear Team MOSIP Decode,

Please find our submission for PS02 (Inji Interop Playground — A Unified Sandbox for
Verifiable Credential Interoperability Testing).

Team Name: <team name>
Problem Statement Addressed: PS02

URLs:
- Source code (GitHub repository): <repo URL>  (branch: feat/ps02-working-prototype)
- Working prototype: instructions in the repository README (one command: docker compose up --build)
- Pitch deck: <Google Drive link>
- Video demo (2–5 min): <Drive / YouTube link>
- Other materials (screenshots, college IDs): <Google Drive folder link>

All links are public / shared with the required permissions.

Regards,
<team name> — <members>
```

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

## Suggested plan (deadline: 2 Nov 2026)

| When | Task |
|---|---|
| Today | `docker compose up --build`; click through both flows; run tests/build. |
| Today | Record the 2–3 minute video (script in `DEMO_GUIDE.md` section 4). |
| Next | Style the deck from `PITCH_DECK.md`; add the team name and screenshots. |
| Next | Push the branch, open the PR, make the repo accessible. |
| Before email | Check every link in incognito; upload deck/video/IDs to one Drive folder. |
| Last step | Email `decode@mosip.io` with Team Name, PS02 and all URLs. |

## Demo route (if a judge asks for the fastest path)

1. Open `/playground`.
2. Keep the local reference stack, choose `ldp_vc`, pre-authorized code.
3. Click **Run end-to-end demo**.
4. Point at the pass card, the 9–10 inspector steps, the two QR artifacts and the Wallet page.
5. Change the flow to authorization code and run again to show the extra `authorization` step.
