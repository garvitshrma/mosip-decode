# Inji Interop Playground
### A Unified Sandbox for Verifiable Credential Interoperability Testing

**MOSIP Decode 2026 — Problem Statement 02**

**An evidence-first playground for exploring interoperability between digital credential issuers, wallets, and verifiers.**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)

**Project Repository:** https://github.com/Jaswanth-Kumar-2007/mosip-decode

---

## Table of Contents

- [Team](#team)
- [Overview](#overview)
- [Explained Simply](#explained-simply)
- [Quick Demo](#quick-demo)
- [Problem Statement](#problem-statement)
- [Our Solution](#our-solution)
- [Objectives](#objectives)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Application Pages](#application-pages)
- [API Overview](#api-overview)
- [Credential Formats](#credential-formats)
- [Protocol Inspection and Security](#protocol-inspection-and-security)
- [Testing](#testing)
- [Current Implementation Status](#current-implementation-status)
- [Known Limitations](#known-limitations)
- [Future Scope](#future-scope)
- [Documentation](#documentation)
- [Acknowledgements](#acknowledgements)

---

## Team

**Team Leader:** Garvit Sharma

**Team Members:**
- Lakshya Soni
- Akshat Kansal
- Jaswanth Kumar

**Institution:** Indian Institute of Technology (IIT) Bhilai

**Event:** MOSIP Decode 2026

**Problem Statement:** PS 02

---

## Overview

The **Inji Interoperability Playground** is a web-based project developed for MOSIP Decode 2026 to explore interoperability across the digital verifiable credential ecosystem.

The project provides a common interface for exploring issuer, wallet, and verifier workflows. It aims to make protocol interactions easier to understand by organizing the workflows, exposing relevant API operations, and recording HTTP request traces.

The playground is designed around the digital credential lifecycle:

1. An issuer makes a verifiable credential available.
2. A wallet receives or imports a credential.
3. A holder presents a credential to a verifier.
4. A verifier evaluates the submitted presentation.
5. The playground provides visibility into the requests, responses, and outcomes.

The project focuses on interoperability with the [Inji ecosystem](https://github.com/inji), while providing a foundation for exploring compatibility with external credential issuers and verifiers.

**Demo status:** A self-contained **local reference stack** now runs the complete issue → hold → present → verify lifecycle with real Ed25519 signatures, both OpenID4VCI-shaped issuance flows and a server-verified result. It does not need Inji services for the app itself.

The live **Inji Certify / Mimoto / Inji Verify** integration is still not demonstrated in this checkout; those adapters block honestly until their services are configured. The application explicitly distinguishes local-demo evidence, configured services, blocked operations and untested integrations.

---

## Explained Simply

A verifiable credential is like a **digitally signed ID card**.

- The **issuer** is the office that signs the card.
- The **wallet** is the phone that stores the card.
- The **verifier** is the shop or office that checks the signature.
- The **playground** is a glass box around all three: it shows every message, every signature check, and the exact step that failed.

The demo does **not** need a real government database or the MOSIP sandbox. It creates its own test issuer, wallet and verifier inside the app, using real Ed25519 keys. Click **Run end-to-end demo** and a complete credential lifecycle happens in front of you. If a signature or the data is altered, verification reports **INVALID** instead of faking a pass.

What it is **not**: it is not proof that live Inji Certify, Mimoto or Inji Verify have been tested. Those adapters are included, but they clearly report when they are not configured.

---

## Quick Demo

### Docker (one command)

Start Docker Desktop first. Then, from the repository root:

```bash
docker compose up --build
```

Wait for the build to finish and open **http://localhost:5173/playground**. nginx serves the built React app and proxies `/api` and `/socket.io` to the backend. SQLite is stored in the `demo-db` volume, so credentials survive restarts. Stop with `Ctrl+C` or `docker compose down`.

No Node.js install, database, or environment file is needed for this path. The first build takes a few minutes; later starts are much faster.

### Local development

```bash
npm run setup
npm run dev
```

Open **http://localhost:5173/playground**.

### What to click

1. Keep the **Local reference issuer / wallet / verifier** selection.
2. Choose `ldp_vc` or `vc+sd-jwt` and either issuance flow.
3. Click **Run end-to-end demo**.
4. Expand the Protocol Inspector steps to see the offer, token, proof JWT, signed credential, VP and verification result.
5. Open **Wallet** to inspect the persisted signed credential.

Full demo script, test data, API examples and submission checklist: [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md). Pitch deck draft: [`docs/PITCH_DECK.md`](docs/PITCH_DECK.md).

---

## Problem Statement

Verifiable credentials provide a way to issue, hold, present, and verify digitally signed information.

However, integrating different issuers, wallets, and verifiers can be challenging because of differences in protocol versions, supported credential formats, authentication requirements, API contracts, and deployment configurations.

Developers need a way to understand these interactions, inspect protocol requests, identify integration gaps, and determine whether a particular combination of components is compatible.

Without clear visibility into the underlying protocol exchanges, identifying integration failures and understanding their causes can be difficult.

### Our challenge

To develop a playground that helps developers explore the verifiable credential lifecycle and understand interoperability between issuers, wallets, and verifiers.

---

## Our Solution

We are building an **Inji Interoperability Playground** that brings issuer, wallet, verifier, and protocol-inspection workflows into one application.

The frontend provides separate interfaces for different stages of the credential lifecycle. The backend exposes API endpoints, coordinates supported operations, records protocol traces, and persists application data using SQLite and Prisma.

The playground is designed to make integration behavior more transparent by:

- Organizing issuer, wallet, and verifier workflows.
- Exposing issuer metadata and credential-format information where supported.
- Providing credential import and management functionality.
- Recording HTTP request and response metadata for protocol inspection.
- Redacting sensitive values from recorded protocol traces.
- Documenting compatibility gaps and unavailable external services.
- Avoiding fabricated credential issuance or verification results.

Our objective is to provide a foundation for investigating interoperability problems and testing integrations as compatible external services become available.

---

## Objectives

The project aims to:

1. **Simplify interoperability exploration:** Provide a common interface for issuer, wallet, and verifier workflows.
2. **Improve protocol visibility:** Record relevant HTTP request and response information.
3. **Support credential management:** Allow supported credential formats to be imported and stored.
4. **Improve debugging:** Help developers understand where protocol interactions succeed, fail, or become blocked.
5. **Protect sensitive information:** Redact tokens, credentials, and other secrets from protocol traces.
6. **Document compatibility gaps:** Distinguish implemented operations from source-verified, untested, and blocked functionality.
7. **Enable future integrations:** Establish a modular foundation for connecting compatible Inji services and external credential providers.

---

## Key Features

### 1. Issuer Interface

The issuer interface provides a starting point for exploring credential issuance.

Its intended responsibilities include:

- Selecting an issuer configuration.
- Discovering issuer metadata when a compatible issuer URL is configured.
- Inspecting advertised credential configurations.
- Exploring credential-offer creation where the configured issuer supports the required operation.
- Recording relevant protocol interactions.

**Current limitation:** Metadata discovery and portions of the offer-creation path have been implemented and tested without a live issuer. Successful end-to-end credential issuance and cryptographic signing have not been demonstrated.

### 2. Wallet Interface

The wallet interface provides functionality for viewing and managing credentials available to the playground.

Implemented capabilities include:

- Importing supported credential data.
- Validating JSON input.
- Performing basic structural checks for LDP-VC credentials.
- Storing imported credential records in SQLite through Prisma.
- Listing stored credential summaries.
- Deleting stored credential records.

**Current limitation:** Credential import and storage do not establish that a credential is authentic or cryptographically valid. Live wallet offer acceptance and credential presentation remain unverified.

### 3. Verifier Interface

The verifier interface provides a starting point for exploring presentation requests and verification results.

Its intended responsibilities include:

- Configuring the verifier integration.
- Exploring presentation-verification workflows.
- Displaying verification outcomes returned by the backend.
- Distinguishing successful verification from blocked or unsuccessful operations.

The interface is designed to avoid showing a successful verification result unless the required success condition is returned by the API.

**Current limitation:** A complete live presentation and verification workflow has not been demonstrated.

### 4. Playground

The Playground page brings the available interoperability workflows together.

It is intended to help users understand the interactions between issuer, wallet, and verifier components and identify configuration or protocol compatibility issues.

Illustrative issuer profiles are explicitly identified as illustrative rather than being represented as verified, operational services.

### 5. Protocol Inspector

The backend supports protocol tracing and persists trace information for inspection.

The tracing infrastructure is designed to capture information such as:

- HTTP method.
- Request URL.
- Redacted headers and request information.
- HTTP response status.
- Request duration.
- Protocol-step information.

Socket.IO is used to deliver trace updates to the inspection interface, while SQLite provides persistence for application records.

### 6. Credential and Secret Handling

The project includes safeguards intended to reduce the exposure of sensitive information.

These include:

- Redaction of authorization headers and tokens.
- Redaction of sensitive values in nested request and response data.
- Validation of supported credential-format identifiers.
- Rejection of malformed JSON during credential import.
- Explicit handling of unavailable integrations.

These safeguards do not replace complete cryptographic credential verification or a comprehensive security audit.

---

## Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| Frontend | React | User interface |
| Programming language | TypeScript | Type-safe frontend and backend development |
| Frontend tooling | Vite | Development server and production builds |
| Backend | Node.js and Express | API endpoints and application logic |
| Database | SQLite | Local application data persistence |
| ORM | Prisma | Database access and schema management |
| Real-time communication | Socket.IO | Protocol-inspection updates |
| Shared package | TypeScript | Shared types and application contracts |
| Verification SDK | `@injistack/react-inji-verify-sdk` | Integration point for Inji verification UI components |
| Testing | Node.js test runner through `tsx` | Automated regression tests |

The project uses an npm workspace monorepo containing `shared`, `backend`, and `frontend`.

---

## System Architecture

The application follows a frontend-backend architecture with a shared TypeScript package.

```text
                         USER
                          |
                          v
               +----------------------+
               |    React Frontend    |
               |                      |
               |  Home                |
               |  Issuer               |
               |  Wallet               |
               |  Verifier             |
               |  Playground           |
               +----------+-----------+
                          |
                          | HTTP / REST
                          v
               +----------------------+
               |   Express Backend    |
               |                      |
               |  API Routes          |
               |  Issuer Integration  |
               |  Wallet Management   |
               |  Verifier Integration|
               |  Protocol Tracing    |
               +----+------------+----+
                    |            |
                    |            +-------------------+
                    |                                |
                    v                                v
           +----------------+              +----------------+
           | SQLite / Prisma|              | Socket.IO      |
           |                |              | Trace Updates  |
           | Application    |              +-------+--------+
           | Records        |                      |
           +----------------+                      v
                                           +----------------+
                                           | Protocol       |
                                           | Inspector UI   |
                                           +----------------+

                  External Integration Targets
                  ----------------------------

                  Inji Certify
                  Mimoto / Inji Wallet
                  Inji Verify
                  External Issuers / Verifiers
```

**Architecture note:** The diagram represents the intended integration architecture and implemented application components. It does not imply that every external service is currently connected or that the complete credential lifecycle has been successfully executed.

### Architectural principles

- **Modularity:** Frontend, backend, and shared types are maintained in separate workspaces.
- **Configuration-driven integrations:** External service URLs are supplied through environment variables.
- **Protocol visibility:** Relevant requests are routed through tracing infrastructure.
- **Explicit failure handling:** Unavailable or unverified integrations remain blocked instead of returning fabricated success results.
- **Data persistence:** Application records are stored locally using SQLite and Prisma.

---

## Project Structure

The repository uses the following top-level organization:

```text
mosip-decode/
├── backend/
│   ├── prisma/
│   └── src/
│       ├── adapters/
│       ├── http/
│       ├── routes/
│       ├── store/
│       ├── app.ts
│       └── config.ts
│
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       └── pages/
│
├── shared/
│
├── docs/
│   ├── interop-gaps.md
│   └── ...
│
├── PHASE4_REPORT.md
├── PHASE5_REPORT.md
├── CLAUDE.md
├── package.json
├── package-lock.json
└── README.md
```

*This is a structural overview, not an exhaustive file listing. Consult the repository for the current files in each directory.*

### Directory responsibilities

| Directory/File | Responsibility |
|---|---|
| `frontend/` | React user interface and frontend API client |
| `backend/` | Express API, adapters, routes, and application logic |
| `shared/` | Shared TypeScript types and contracts |
| `backend/prisma/` | Prisma schema and database-related configuration |
| `backend/src/adapters/` | External integration adapters |
| `backend/src/http/` | HTTP-related utilities, including trace redaction |
| `backend/src/routes/` | Backend API routes |
| `backend/src/store/` | Application persistence logic |
| `docs/` | Technical documentation and interoperability-gap analysis |
| `PHASE4_REPORT.md` | Readiness and test-coverage audit |
| `PHASE5_REPORT.md` | Deployment-independent regression-test report |
| `CLAUDE.md` | Project-specific development guidance |

---

## Prerequisites

Before setting up the project, install:

- [Node.js](https://nodejs.org/) version 20 or later.
- npm, included with Node.js.
- Git.
- Optional: Docker Desktop with Docker Compose for the one-command demo.

You should also have a compatible code editor and terminal.

External Inji services are not required for basic local development, building, or running the deployment-independent regression tests. They are required for the corresponding live integration workflows.

---

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/Jaswanth-Kumar-2007/mosip-decode.git
```

Navigate into the project:

```bash
cd mosip-decode
```

### 2. Install dependencies and initialize the database

The root `package.json` provides a setup script:

```bash
npm run setup
```

This runs dependency installation and the Prisma database-push command.

Alternatively, perform the steps separately:

```bash
npm install
npm run db:push
```

### 3. Configure environment variables

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

On Windows Command Prompt, use:

```cmd
copy backend\.env.example backend\.env
```

Edit `backend/.env` as required for your environment.

The application can be developed locally without configuring external services, but issuer, wallet, and verifier operations that depend on those services will remain blocked until the required configuration is available.

See [Environment Configuration](#environment-configuration).

---

## Environment Configuration

The project provides an environment-variable template at:

`backend/.env.example`

The following variables are documented in that template.

| Variable | Purpose |
|---|---|
| `PORT` | Backend server port |
| `FRONTEND_ORIGIN` | Frontend origin used by the backend |
| `DATABASE_URL` | SQLite database connection string |
| `CERTIFY_BASE_URL` | Inji Certify issuer base URL |
| `CERTIFY_LOCAL_BASE_URL` | Local Inji Certify base URL for development |
| `MIMOTO_BASE_URL` | Mimoto wallet-backend URL |
| `INJI_WEB_BASE_URL` | Inji Web URL |
| `VERIFY_BASE_URL` | Inji Verify base URL |
| `VERIFY_SERVICE_URL` | Verification SDK service base URL |
| `VERIFY_CLIENT_ID` | Client ID required for the configured verification service |
| `EXTERNAL_ISSUER_BASE_URL` | External issuer integration URL |
| `EXTERNAL_VERIFIER_BASE_URL` | External verifier integration URL |
| `PUBLIC_BASE_URL` | Public HTTPS base URL for the backend when required by mobile-wallet workflows |

The example configuration includes:

```dotenv
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL="file:./prisma/dev.db"

CERTIFY_BASE_URL=
CERTIFY_LOCAL_BASE_URL=http://localhost:8090

MIMOTO_BASE_URL=
INJI_WEB_BASE_URL=

VERIFY_BASE_URL=
VERIFY_SERVICE_URL=
VERIFY_CLIENT_ID=

EXTERNAL_ISSUER_BASE_URL=https://playground.animo.id
EXTERNAL_VERIFIER_BASE_URL=https://playground.animo.id

PUBLIC_BASE_URL=
```

These values are configuration examples, not confirmation that the corresponding services are available.

### Important configuration notes

- Configure only service URLs that you can access and have permission to use.
- The local Certify URL assumes a compatible service is actually running at that address.
- The external issuer and verifier URLs are integration targets, not proof of successful compatibility.
- Some mobile-wallet workflows require the backend to be reachable over HTTPS.
- Verification-service configuration may require a valid client ID.
- Do not commit real client secrets, access tokens, private keys, or other credentials to GitHub.
- Do not treat an HTTP response or structurally valid JSON as proof of cryptographic credential validity.

---

## Running the Application

### Docker (one command)

```bash
docker compose up --build
```

Open `http://localhost:5173/playground`. The compose file starts the backend, builds the frontend, and uses a named volume for SQLite. See [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md) for ports and troubleshooting.

### Start the frontend and backend together

From the repository root:

```bash
npm run dev
```

The root development script starts the backend and frontend using the configured npm workspace scripts.

The default example configuration uses:

- **Frontend:** `http://localhost:5173`
- **Backend:** `http://localhost:4000`

These are local development defaults from the project configuration. Your actual ports may differ if you change the environment variables.

### Start the backend separately

```bash
npm run dev:backend
```

### Start the frontend separately

```bash
npm run dev:frontend
```

### Build all workspaces

```bash
npm run build
```

The build script builds the shared package, backend, and frontend.

### Run TypeScript checks

```bash
npm run typecheck
```

This checks the shared package, backend, and frontend.

---

## Application Pages

The frontend contains five primary pages.

| Route | Page | Purpose |
|---|---|---|
| `/` | Home | Entry point and project overview |
| `/issuer` | Issuer | Explore issuer configuration and credential-issuance operations |
| `/wallet` | Wallet | View and manage credential records |
| `/verifier` | Verifier | Explore presentation-verification workflows |
| `/playground` | Playground | Explore the available interoperability components and workflows |

### Home

Provides an entry point to the playground and its major sections.

### Issuer

Provides the issuer interface and the starting point for issuer metadata discovery and supported credential-offer operations.

### Wallet

Provides access to credential-import and credential-management functionality.

### Verifier

Provides the interface for exploring presentation requests and verification-related operations.

### Playground

Provides a consolidated interface for exploring interoperability scenarios and component configurations.

The availability of a page does not mean every underlying external integration is operational.

---

## API Overview

The backend exposes HTTP API routes for health checks, adapters, workflow runs, credential management, and verifier configuration.

The following endpoints are documented in the implementation.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health-check endpoint |
| `GET` | `/api/adapters` | Retrieve available adapter information |
| `GET` | `/api/runs` | Retrieve workflow runs |
| `POST` | `/api/runs` | Create a workflow run |
| `GET` | `/api/runs/:id/probe` | Probe a workflow run |
| `GET` | `/api/runs/:id/metadata` | Retrieve issuer metadata associated with an issuance run |
| `POST` | `/api/runs/:id/offer` | Initiate the supported credential-offer operation for an issuance run |
| `POST` | `/api/runs/:id/execute` | Run the complete local reference demo and record every step |
| `GET` | `/api/credentials` | Retrieve credential summaries |
| `GET` | `/api/credentials/:id` | Retrieve one stored signed credential |
| `POST` | `/api/runs/:id/credential` | Generate the legacy demo credential record |
| `POST` | `/api/validate` | Structural credential validation |
| `POST` | `/api/runs/:id/credential/delete` | Mark a credential deleted |
| `GET` | `/api/verifier/config` | Retrieve verifier configuration status |

The repository also contains issuance, presentation, verification, and credential-management routes. Their exact behavior depends on the configured services and the implementation status described in the interoperability documentation.

### API behavior

- Unconfigured integrations should return an explicit blocked or error result.
- Invalid inputs should be handled without claiming a successful operation.
- Protocol traces should redact sensitive values.
- Successful metadata discovery should not be confused with successful credential issuance.
- Credential import should not be confused with cryptographic validation.
- The frontend should display verification success only when the backend returns the required success condition.

**For the latest route definitions, request schemas, and response behavior, inspect the backend source and the documentation in `docs/`.**

---

## Credential Formats

The project recognizes the following credential-format identifiers:

| Format | Identifier | Current scope |
|---|---|---|
| JSON-LD Verifiable Credential | `ldp_vc` | Basic structural validation during import |
| Verifiable Credential using SD-JWT | `vc+sd-jwt` | Format recognition and JSON import handling |
| DC-SD-JWT | `dc+sd-jwt` | Format recognition and JSON import handling |

Format recognition and structural validation are not equivalent to full standards compliance or cryptographic verification.

The project does not claim that every supported format has been issued, presented, or verified successfully against a live service.

---

## Protocol Inspection and Security

Protocol visibility is an important design goal of the playground.

The backend's tracing functionality records relevant HTTP interaction information and makes trace updates available through Socket.IO. Trace data can also be persisted for inspection.

### Trace information

Depending on the operation, trace records can include:

- Request method and URL.
- Redacted request headers and relevant payload information.
- HTTP response status.
- Request duration.
- Protocol-step details.

### Secret redaction

The project includes automated tests for redacting sensitive information, including authorization headers, tokens, nested secrets, and pre-authorized-code values.

Sensitive values must not be exposed in public logs, screenshots, or submitted test artefacts.

### Important security limitation

Redaction reduces accidental exposure of secrets, but it does not replace a complete security review.

Similarly, structural validation of a credential does not establish that its signature, issuer, expiry, or revocation status is valid.

---

## Testing

The repository includes deployment-independent regression tests, including the full local demo.

### Available test suites

| Area | Tests | Purpose |
|---|---:|---|
| Redaction | 10 | Sensitive headers, tokens, codes and proofs |
| Inji adapter and tracing | 21 | Certify metadata/offer contracts and redacted HTTP tracing |
| Run lifecycle and verification policy | 22 | Issuance lifecycle, terminal states, verifier transitions, concurrency |
| Local reference demo | 12 | Real signatures, both flows, tamper/expiry/replay negatives |
| **Total** | **65** | **All passing in the checked-out state** |

### Run the tests

```bash
cd backend
npm test
```

Or run only the local demo tests:

```bash
npx tsx --test backend/src/localDemo.test.ts
```

### Additional validation

Run the TypeScript checks:

```bash
npm run typecheck
```

Build the application:

```bash
npm run build
```

### Reported results

Current results:

- 65 of 65 backend tests passing, including 12 local demo tests.
- Successful TypeScript checks across all three workspaces.
- Successful production build across all three workspaces.
- Full local demo exercised through the HTTP API for `ldp_vc`, `vc+sd-jwt` and `dc+sd-jwt`, in both pre-authorized and authorization-code flows.
- Docker one-command stack verified on 27 Oct 2026: images build, the backend is healthy, nginx serves the app, and the full flow passes from the browser and through the same-origin API.

### What these tests do not prove

The regression tests do not demonstrate:

- Live credential issuance against Inji Certify.
- Live wallet offer acceptance through Mimoto/Inji Web/mobile.
- Live presentation against Inji Verify.
- Interoperability between externally deployed services.

The local reference stack is a real cryptographic demo, not a conformance test of the Inji implementations. Those workflows still require the external services and integration testing described in `docs/interop-gaps.md`.

---

## Current Implementation Status

The project now has two clearly separated layers: a working self-contained demo and the still-blocked live Inji integration.

| Component or capability | Status |
|---|---|
| React frontend and application pages | Implemented |
| Express backend and workspace structure | Implemented |
| SQLite and Prisma persistence | Implemented |
| API routing and adapter structure | Implemented |
| Protocol-tracing infrastructure | Implemented |
| Sensitive-value redaction | Implemented and regression-tested |
| Credential import validation | Implemented in the application |
| Credential listing, detail and deletion | Implemented in the application |
| **Local reference stack: issue → hold → present → verify** | **Implemented, 65 tests passing, HTTP demo verified** |
| **Pre-authorized and authorization-code local flows** | **Implemented and tested** |
| **LDP VC and SD-JWT VC local issuance** | **Implemented and tested** |
| **Real Ed25519 issuer/holder signatures and verifier checks** | **Implemented and tested** |
| **Server-side verification result (not submission HTTP 200)** | **Implemented for the local stack** |
| Issuer metadata discovery (Inji) | Implemented; source and structural validation documented |
| Credential-offer creation (Inji) | Implemented for the supported contract; live integration not demonstrated |
| OAuth token exchange (Inji) | Not demonstrated against a live issuer |
| Live Inji credential issuance and signing | Not demonstrated |
| Live Mimoto/Inji Web/mobile wallet | Not demonstrated |
| Live Inji Verify presentation and result retrieval | Not demonstrated |
| Complete interoperability across live Inji services | Not demonstrated |

Implementation and source verification are not equivalent to live deployment testing. The local reference stack is labelled as such in the UI and documentation.

---

## Known Limitations

The following limitations should be considered when evaluating or extending the project.

### 1. External service availability

The complete workflow depends on compatible issuer, wallet, and verifier services.

Without a suitable deployment, the playground cannot demonstrate the complete credential lifecycle.

### 2. Protocol-version compatibility

Different implementations may support different versions of OpenID for Verifiable Credential Issuance (OpenID4VCI) and OpenID for Verifiable Presentations (OpenID4VP).

Compatibility must be established from the actual service configuration and protocol behavior rather than assumed.

### 3. Live Inji credential issuance

The local reference issuer really signs credentials, but the Inji Certify adapter has not completed a live issuance in this checkout. The presence of issuer metadata or a supported offer-creation operation is still not treated as proof of live issuance.

### 4. Wallet interoperability

The local reference wallet stores and presents its own signed credential. This does not establish successful interoperability with Inji Web, Inji Mobile or Mimoto. The external wallet adapters remain blocked until configured.

### 5. Cryptographic verification

The local demo verifies real Ed25519 signatures, holder binding, issuer identity, nonce, audience and expiry. It is not a conformance test: JSON-LD canonicalisation is simplified, SD-JWT disclosures are not implemented, and revocation/trust registries are absent. Live Inji Verify result retrieval is still not demonstrated.

### 6. End-to-end testing

The complete issuer → wallet → verifier flow is demonstrated **inside the local reference stack**, not against a compatible live Inji deployment.

### 7. Deployment configuration

Some operations require valid external service URLs, client configuration, and public HTTPS access.

### Transparency commitment

The playground is designed to distinguish between implemented functionality, source-verified protocol behavior, and operations that remain untested or blocked.

We do not claim successful issuance, presentation, or verification without the necessary evidence.

---

## Future Scope

The following items describe possible next steps rather than completed functionality.

- Complete live integration with a compatible Inji Certify deployment.
- Exercise the actual Inji credential-offer and token-exchange flows.
- Connect Inji Web/Mobile through Mimoto and test offer acceptance.
- Replace the local verifier with Inji Verify and poll `GET /vp-result/{transactionId}` or `POST /v2/vp-results/{transactionId}` for the authoritative result.
- Add a curated Inji ↔ external scenario matrix (Animo/Hovi) instead of a Cartesian product.
- Add full JSON-LD RDF canonicalisation, SD-JWT disclosures, `tx_code`, revocation and trust registries.
- Add Playwright browser tests for the one-click demo and inspector.
- Record the final 2–5 minute video and attach it to the submission.

---

## Documentation

Additional technical documentation is available in the repository.

| Document | Description |
|---|---|
| [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md) | Demo script, test data, API examples, architecture, screenshots and submission checklist |
| [`docs/PITCH_DECK.md`](docs/PITCH_DECK.md) | Slide-by-slide pitch deck draft (7 slides + appendix, speaker notes in plain language) |
| [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md) | Submission checklist, official process and email template (deadline: 2 Nov 2026) |
| [`docs/screenshots/`](docs/screenshots/) | Seven app screenshots for the deck, mockups and video |
| [`docker-compose.yml`](docker-compose.yml) | One-command Docker demo (backend + nginx frontend + SQLite volume) |
| [`docs/interop-gaps.md`](docs/interop-gaps.md) | Current capabilities, protocol compatibility gaps, and integration blockers |
| [`PHASE4_REPORT.md`](PHASE4_REPORT.md) | End-to-end readiness and test-coverage audit |
| [`PHASE5_REPORT.md`](PHASE5_REPORT.md) | Deployment-independent regression tests and results |
| [`CLAUDE.md`](CLAUDE.md) | Project-specific development guidance |
| [`backend/.env.example`](backend/.env.example) | Environment-variable template |

External references:

- [MOSIP](https://github.com/mosip)
- [Inji](https://github.com/inji)
- [Inji documentation](https://docs.inji.io/)
- [OpenID for Verifiable Credential Issuance](https://openid.net/)

---

## Acknowledgements

We thank MOSIP for providing the opportunity to work on a problem involving digital identity, verifiable credentials, and interoperability.

Through MOSIP Decode 2026, our team explored the architecture of credential issuers, wallets, and verifiers and worked on building a playground that makes protocol interactions more observable.

The result is a working local reference demo with real cryptographic signatures, a clear evidence trail, and an honest account of the remaining live Inji integration gaps.

We view this project as a learning experience and a foundation for further work on interoperable digital credential systems.

---

## Repository

**GitHub:** https://github.com/Jaswanth-Kumar-2007/mosip-decode

**Project:** Inji Interoperability Playground

**Event:** MOSIP Decode 2026

**Problem Statement:** PS 02

**Team Leader:** Garvit Sharma

**Team Members:** Lakshya Soni, Akshat Kansal, Jaswanth Kumar

---

*This README describes the current implementation and its documented limitations. Features that depend on unavailable or unverified external services are not represented as completed end-to-end functionality.*
