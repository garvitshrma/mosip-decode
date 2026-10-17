import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import type { IssuerAdapter, RecordStep, Run } from "@playground/shared";
import {
  ConcurrentOfferConflictError,
  OfferRecoveryRequiredError,
  createIssuanceOffer,
  createDurableIssuanceOffer,
  discoverIssuanceMetadata,
} from "./routes/runs";
import { getOfferOperation } from "./store/runStore";

const databaseDirectory = await mkdtemp(path.join(tmpdir(), "mosip-verifier-routes-"));
process.env.DATABASE_URL = `file:${path.join(databaseDirectory, "test.db")}`;

const { createApp } = await import("./app");
const { db } = await import("./store/prisma");

await db().$executeRawUnsafe(`CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issuer" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'workflow',
    "status" TEXT NOT NULL,
    "verificationResult" TEXT,
    "verificationEvidence" TEXT,
    "errorStep" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
await db().$executeRawUnsafe(`CREATE TABLE "Step" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "fromParty" TEXT NOT NULL,
    "toParty" TEXT NOT NULL,
    "requestJson" TEXT NOT NULL,
    "responseJson" TEXT,
    "httpStatus" INTEGER,
    "ok" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    CONSTRAINT "Step_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
await db().$executeRawUnsafe(`CREATE TABLE "Credential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL UNIQUE,
    "format" TEXT NOT NULL,
    "credentialJson" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Credential_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
await db().$executeRawUnsafe(`CREATE TABLE "OfferOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL UNIQUE,
    "requestFingerprint" TEXT NOT NULL,
    "credentialConfigurationId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "offerUri" TEXT,
    "issuerUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OfferOperation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);

const server = createApp().listen(0);
const address = server.address();
if (!address || typeof address === "string") throw new Error("Test server did not bind");
const baseUrl = `http://127.0.0.1:${address.port}/api`;

async function request(pathname: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

async function createRun(kind: "workflow" | "verification" | "issuance" = "verification") {
  const response = await request("/runs", {
    method: "POST",
    body: JSON.stringify({
      issuer: "inji-certify",
      wallet: "inji-wallet",
      verifier: "inji-verify",
      format: "ldp_vc",
      kind,
    }),
  });
  assert.equal(response.status, 201);
  return response.json() as Promise<{ id: string }>;
}

function stepBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "verifier_started",
    method: "qr-upload",
    evidence: "client-reported",
    ...overrides,
  };
}

after(async () => {
  await db().$disconnect();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await rm(databaseDirectory, { recursive: true, force: true });
});

test("invalid status payload returns 400", async () => {
  const run = await createRun();
  const response = await request(`/runs/${run.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "complete", evidence: "client-reported" }),
  });
  assert.equal(response.status, 400);
});

test("unknown run kinds are rejected", async () => {
  const response = await request("/runs", {
    method: "POST",
    body: JSON.stringify({
      issuer: "inji-certify",
      wallet: "inji-wallet",
      verifier: "inji-verify",
      format: "ldp_vc",
      kind: "unknown",
    }),
  });
  assert.equal(response.status, 400);
});

test("issuance runs do not create demo credentials", async () => {
  const run = await createRun("issuance");
  const persisted = await (await request(`/runs/${run.id}`)).json() as {
    kind: string;
    status: string;
  };
  assert.equal(persisted.kind, "issuance");
  assert.equal(persisted.status, "running");
  const credentialResponse = await request(`/runs/${run.id}/credential`, { method: "POST", body: "{}" });
  assert.equal(credentialResponse.status, 409);
  assert.equal(await db().credential.findUnique({ where: { runId: run.id } }), null);
});

test("credential listing is explicit and does not return credential bodies", async () => {
  const response = await request("/credentials");
  assert.equal(response.status, 200);
  const credentials = await response.json() as Array<Record<string, unknown>>;
  for (const credential of credentials) {
    assert.equal("credentialJson" in credential, false);
    assert.equal("claims" in credential, false);
  }
});

test("metadata and offers require existing issuance runs", async () => {
  const missingMetadata = await request("/runs/missing-run/metadata");
  assert.equal(missingMetadata.status, 404);

  const missingOffer = await request("/runs/missing-run/offer", {
    method: "POST",
    body: JSON.stringify(issuanceRequest()),
  });
  assert.equal(missingOffer.status, 404);

  const verificationRun = await createRun("verification");
  const invalidMetadataKind = await request(`/runs/${verificationRun.id}/metadata`);
  assert.equal(invalidMetadataKind.status, 409);

  const invalidOfferKind = await request(`/runs/${verificationRun.id}/offer`, {
    method: "POST",
    body: JSON.stringify(issuanceRequest()),
  });
  assert.equal(invalidOfferKind.status, 409);
});

test("terminal issuance runs cannot start metadata or offer operations", async () => {
  const run = await createRun("issuance");
  await db().run.update({ where: { id: run.id }, data: { status: "fail" } });

  const metadata = await request(`/runs/${run.id}/metadata`);
  assert.equal(metadata.status, 409);

  const offer = await request(`/runs/${run.id}/offer`, {
    method: "POST",
    body: JSON.stringify(issuanceRequest()),
  });
  assert.equal(offer.status, 409);
});

function issuanceRun(steps: Run["steps"] = []): Run {
  return {
    id: "issuance-lifecycle-test",
    issuer: "inji-certify",
    wallet: "inji-wallet",
    verifier: "inji-verify",
    format: "dc+sd-jwt",
    kind: "issuance",
    status: "running",
    steps,
    createdAt: new Date().toISOString(),
  };
}

function issuanceRequest() {
  return {
    credentialType: "identity_sd_jwt",
    issuanceFlow: "pre_authorized_code" as const,
    claims: {},
  };
}

test("issuance lifecycle returns an offer without completing the run", async () => {
  const run = issuanceRun();
  const recorded: unknown[] = [];
  const adapter: IssuerAdapter = {
    info: {
      id: "test-issuer",
      label: "Test issuer",
      role: "issuer",
      vendor: "external",
      readiness: "ready",
      formats: ["dc+sd-jwt"],
    },
    async createOffer(ctx) {
      await ctx.record({
        name: "credential_offer",
        stage: "issuance",
        from: "playground",
        to: "test-issuer",
        request: { method: "POST" },
        response: { created: true },
        ok: true,
        durationMs: 1,
      });

      test("issuance metadata exposes only validated configuration IDs and formats", async () => {
        const run = issuanceRun();
        const adapter: IssuerAdapter & {
          discoverMetadata: (ctx: { runId: string; format: Run["format"]; record: RecordStep }) => Promise<{
            credential_issuer: string;
            credential_endpoint: string;
            credential_configurations_supported: Record<string, { format: string; claims: { secret: string } }>;
          }>;
        } = {
          info: {
            id: "test-issuer-metadata",
            label: "Test issuer",
            role: "issuer",
            vendor: "external",
            readiness: "ready",
            formats: ["dc+sd-jwt"],
          },
          async createOffer() {
            return { offerUri: "openid-credential-offer://test", issuerUrl: "https://issuer.test" };
          },
          async discoverMetadata() {
            return {
              credential_issuer: "https://issuer.test",
              credential_endpoint: "https://issuer.test/issuance/credential",
              credential_configurations_supported: {
                "identity-config-v1": { format: "dc+sd-jwt", claims: { secret: "not returned" } },
              },
            };
          },
        };

        const metadata = await discoverIssuanceMetadata(run, adapter);
        assert.deepEqual(metadata, {
          issuer: "https://issuer.test",
          credentialEndpoint: "https://issuer.test/issuance/credential",
          configurations: [{ id: "identity-config-v1", format: "dc+sd-jwt" }],
        });
        assert.equal(JSON.stringify(metadata).includes("not returned"), false);
      });
      return {
        offerUri: "openid-credential-offer://test",
        issuerUrl: "https://issuer.test",
      };
    },
  };

  const offer = await createIssuanceOffer(run, issuanceRequest(), adapter, async (input) => {
    recorded.push(input);
  });

  assert.equal(offer.offerUri, "openid-credential-offer://test");
  assert.equal(run.status, "running");
  assert.equal(recorded.length, 1);
});

test("concurrent repeated offer requests share one adapter operation", async () => {
  const run = issuanceRun();
  let calls = 0;
  const adapter: IssuerAdapter = {
    info: {
      id: "test-issuer-repeat",
      label: "Test issuer",
      role: "issuer",
      vendor: "external",
      readiness: "ready",
      formats: ["dc+sd-jwt"],
    },
    async createOffer() {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { offerUri: "openid-credential-offer://same", issuerUrl: "https://issuer.test" };
    },
  };

  const [first, second] = await Promise.all([
    createIssuanceOffer(run, issuanceRequest(), adapter, async () => undefined),
    createIssuanceOffer(run, issuanceRequest(), adapter, async () => undefined),
  ]);

  assert.equal(calls, 1);
  assert.deepEqual(first, second);
});

test("conflicting concurrent offer requests are rejected without exposing inputs", async () => {
  const run = issuanceRun();
  let release: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const adapter: IssuerAdapter = {
    info: {
      id: "test-issuer-conflict",
      label: "Test issuer",
      role: "issuer",
      vendor: "external",
      readiness: "ready",
      formats: ["dc+sd-jwt"],
    },
    async createOffer() {
      await waiting;
      return { offerUri: "openid-credential-offer://same", issuerUrl: "https://issuer.test" };
    },
  };

  const first = createIssuanceOffer(run, {
    ...issuanceRequest(),
    credentialType: "configuration-a",
    claims: { secret: "claim-sentinel" },
  }, adapter, async () => undefined);
  await new Promise((resolve) => setTimeout(resolve, 0));

  await assert.rejects(
    createIssuanceOffer(run, {
      ...issuanceRequest(),
      credentialType: "configuration-b",
      txCode: "TX99",
    }, adapter, async () => undefined),
    (error: Error) => error instanceof ConcurrentOfferConflictError
      && !error.message.includes("claim-sentinel")
      && !error.message.includes("TX99"),
  );

  release?.();
  await first;
});

test("uncertain offer outcomes are persisted and cannot be retried automatically", async () => {
  const run = { ...issuanceRun(), id: "uncertain-offer-run" };
  await db().run.create({
    data: {
      id: run.id,
      issuer: run.issuer,
      wallet: run.wallet,
      verifier: run.verifier,
      format: run.format,
      kind: run.kind,
      status: run.status,
    },
  });
  let calls = 0;
  const adapter: IssuerAdapter = {
    info: {
      id: "test-issuer-unknown",
      label: "Test issuer",
      role: "issuer",
      vendor: "external",
      readiness: "ready",
      formats: ["dc+sd-jwt"],
    },
    async createOffer() {
      calls += 1;
      const { CredentialOfferOutcomeUnknownError } = await import("./adapters/injiCertify");
      throw new CredentialOfferOutcomeUnknownError();
    },
  };

  await assert.rejects(
    createDurableIssuanceOffer(run, {
      ...issuanceRequest(),
      claims: { secret: "claim-sentinel" },
      txCode: "TX12",
    }, adapter),
    (error: Error) => error instanceof OfferRecoveryRequiredError
      && !error.message.includes("claim-sentinel")
      && !error.message.includes("TX12"),
  );
  const operation = await getOfferOperation(run.id);
  assert.equal(operation?.status, "unknown");
  assert.equal(JSON.stringify(operation).includes("claim-sentinel"), false);
  assert.equal(JSON.stringify(operation).includes("TX12"), false);

  await assert.rejects(
    createDurableIssuanceOffer(run, {
      ...issuanceRequest(),
      claims: { secret: "claim-sentinel" },
      txCode: "TX12",
    }, adapter),
    (error: Error) => error instanceof OfferRecoveryRequiredError,
  );
  assert.equal(calls, 1);
});

test("issuance lifecycle preserves adapter and persistence failures", async () => {
  const run = issuanceRun();
  const adapter: IssuerAdapter = {
    info: {
      id: "test-issuer-failure",
      label: "Test issuer",
      role: "issuer",
      vendor: "external",
      readiness: "ready",
      formats: ["dc+sd-jwt"],
    },
    async createOffer(ctx) {
      await ctx.record({
        name: "credential_offer",
        stage: "issuance",
        from: "playground",
        to: "test-issuer",
        request: {},
        ok: false,
        durationMs: 1,
      });
      throw new Error("adapter-secret-sentinel");
    },
  };

  await assert.rejects(
    createIssuanceOffer(run, issuanceRequest(), adapter, async () => {
      throw new Error("persistence-secret-sentinel");
    }),
    (error: Error) => error.message === "Credential offer creation failed"
      && !error.message.includes("persistence-secret-sentinel")
      && !error.message.includes("adapter-secret-sentinel"),
  );
  assert.equal(run.status, "running");
});

test("workflow runs retain demo credential behavior", async () => {
  const run = await createRun("workflow");
  assert.ok(await db().credential.findUnique({ where: { runId: run.id } }));
  const credentialResponse = await request(`/runs/${run.id}/credential`, { method: "POST", body: "{}" });
  assert.equal(credentialResponse.status, 200);
});

test("verification runs do not create or expose demo credentials", async () => {
  const run = await createRun("verification");
  assert.equal(await db().credential.findUnique({ where: { runId: run.id } }), null);
  const credentialResponse = await request(`/runs/${run.id}/credential`, { method: "POST", body: "{}" });
  assert.equal(credentialResponse.status, 409);
});

test("non-client-reported evidence is rejected", async () => {
  const run = await createRun();
  const response = await request(`/runs/${run.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "fail", evidence: "server-verified" }),
  });
  assert.equal(response.status, 400);
});

test("workflow runs cannot receive verifier steps", async () => {
  const run = await createRun("workflow");
  const response = await request(`/runs/${run.id}/steps`, {
    method: "POST",
    body: JSON.stringify(stepBody()),
  });
  assert.equal(response.status, 409);
});

test("terminal runs reject later steps and terminal overwrites", async () => {
  const run = await createRun();
  const terminal = await request(`/runs/${run.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "fail",
      verificationResult: "INVALID",
      evidence: "client-reported",
      error: { step: "verification_result", message: "ignored" },
    }),
  });
  assert.equal(terminal.status, 200);

  const step = await request(`/runs/${run.id}/steps`, {
    method: "POST",
    body: JSON.stringify(stepBody()),
  });
  assert.equal(step.status, 409);

  const overwrite = await request(`/runs/${run.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "pass",
      verificationResult: "VALID",
      evidence: "client-reported",
    }),
  });
  assert.equal(overwrite.status, 400);

  const persisted = await (await request(`/runs/${run.id}`)).json() as {
    status: string;
    verificationResult?: string;
    steps: unknown[];
  };
  assert.equal(persisted.status, "fail");
  assert.equal(persisted.verificationResult, "INVALID");
  assert.equal(persisted.steps.length, 0);
});

test("concurrent step recording and terminalization remain consistent", async () => {
  const run = await createRun();
  const stepRequest = request(`/runs/${run.id}/steps`, {
    method: "POST",
    body: JSON.stringify(stepBody()),
  });
  const statusRequest = request(`/runs/${run.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "pass",
      verificationResult: "VALID",
      evidence: "client-reported",
    }),
  });
  const [step, status] = await Promise.all([stepRequest, statusRequest]);
  assert.ok([201, 409].includes(step.status));
  assert.equal(status.status, 200);

  const persisted = await (await request(`/runs/${run.id}`)).json() as {
    status: string;
    steps: Array<{ name: string }>;
  };
  assert.equal(persisted.status, "pass");
  assert.equal(persisted.steps.length, step.status === 201 ? 1 : 0);
  if (persisted.steps.length === 1) assert.equal(persisted.steps[0]?.name, "verifier_started");
});
