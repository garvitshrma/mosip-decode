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

**Important:** The current implementation is a work in progress. Some application features and protocol-inspection capabilities are implemented, but the complete live credential issuance, wallet presentation, and verification workflow has not yet been demonstrated end to end.

The application explicitly distinguishes configured, blocked, and unverified operations instead of presenting unsuccessful or untested protocol interactions as successful.

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
| `GET` | `/api/credentials` | Retrieve credential summaries |
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

The repository includes deployment-independent regression tests.

### Available test suites

| Test file | Tests | Purpose |
|---|---:|---|
| `backend/src/http/redact.test.ts` | 7 | Tests redaction of sensitive information |
| `backend/src/wallet-import.test.ts` | 5 | Tests credential-format recognition, JSON handling, and structural validation |
| **Total** | **12** | **Deployment-independent regression tests** |

### Run the tests

Run the redaction test suite:

```bash
npx tsx --test backend/src/http/redact.test.ts
```

Run the wallet-import test suite:

```bash
npx tsx --test backend/src/wallet-import.test.ts
```

Run both suites using the project's configured test script, if available:

```bash
npm test
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

The project's Phase 5 report records:

- 7 out of 7 redaction tests passing.
- 5 out of 5 wallet-import tests passing.
- Successful TypeScript checks across all three workspaces.
- Successful builds across all three workspaces.

These are the results recorded in the repository's audit report. Run the commands again against the current checkout to confirm its state.

### What these tests do not prove

The regression tests do not demonstrate:

- Successful live credential issuance.
- Successful wallet offer acceptance.
- Successful credential presentation.
- Successful live verification.
- End-to-end interoperability between deployed services.

Those workflows require appropriate external services and additional integration testing.

---

## Current Implementation Status

The project has progressed beyond an initial interface-only prototype, but the full interoperability lifecycle remains unfinished.

| Component or capability | Status |
|---|---|
| React frontend and application pages | Implemented |
| Express backend and workspace structure | Implemented |
| SQLite and Prisma persistence | Implemented |
| API routing and adapter structure | Implemented |
| Protocol-tracing infrastructure | Implemented |
| Sensitive-value redaction | Implemented and regression-tested |
| Credential import validation | Implemented and regression-tested |
| Credential listing and deletion | Implemented in the application |
| Issuer metadata discovery | Implemented; source and structural validation documented |
| Credential-offer creation | Implemented for the supported contract; live integration not demonstrated |
| OAuth token exchange | Not demonstrated against a live issuer |
| Actual credential issuance and signing | Not demonstrated end to end |
| Live wallet offer acceptance | Not demonstrated |
| Live credential presentation | Not demonstrated |
| End-to-end presentation verification | Not demonstrated |
| Complete interoperability across live services | Not demonstrated |

This status table reflects the project's documented audit findings. Implementation and source verification are not equivalent to live deployment testing.

---

## Known Limitations

The following limitations should be considered when evaluating or extending the project.

### 1. External service availability

The complete workflow depends on compatible issuer, wallet, and verifier services.

Without a suitable deployment, the playground cannot demonstrate the complete credential lifecycle.

### 2. Protocol-version compatibility

Different implementations may support different versions of OpenID for Verifiable Credential Issuance (OpenID4VCI) and OpenID for Verifiable Presentations (OpenID4VP).

Compatibility must be established from the actual service configuration and protocol behavior rather than assumed.

### 3. Credential issuance

The presence of issuer metadata or a supported offer-creation operation does not mean a signed credential has been issued successfully.

### 4. Wallet interoperability

Importing a credential into the playground's local storage does not establish successful interoperability with an external wallet.

### 5. Cryptographic verification

Basic structural checks do not replace cryptographic proof validation. Full verification requires the appropriate service, configuration, trust material, and validation behavior.

### 6. End-to-end testing

The complete issuer → wallet → verifier flow has not yet been demonstrated against a compatible live deployment.

### 7. Deployment configuration

Some operations require valid external service URLs, client configuration, and public HTTPS access.

### Transparency commitment

The playground is designed to distinguish between implemented functionality, source-verified protocol behavior, and operations that remain untested or blocked.

We do not claim successful issuance, presentation, or verification without the necessary evidence.

---

## Future Scope

The following items describe possible next steps rather than completed functionality.

- Complete live integration with a compatible Inji Certify deployment.
- Exercise the actual credential-offer and token-exchange flows.
- Connect a compatible wallet backend and test offer acceptance.
- Implement and validate end-to-end presentation requests.
- Integrate a live verifier and validate its returned verdicts.
- Expand automated tests for API routes and integration boundaries.
- Improve compatibility reporting across different issuer and verifier implementations.
- Document verified request and response examples.
- Improve deployment instructions and configuration validation.
- Record a complete end-to-end demonstration when compatible services are available.

---

## Documentation

Additional technical documentation is available in the repository.

| Document | Description |
|---|---|
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

Although we were unable to complete the entire implementation within the available time, we made considerable efforts to build the application foundation, implement supported functionality, test the available components, and document the remaining integration gaps.

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
