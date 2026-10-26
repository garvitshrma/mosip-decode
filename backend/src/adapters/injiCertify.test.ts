import test from "node:test";
import assert from "node:assert/strict";
import type { RunContext } from "@playground/shared";
import type { RecordStepInput } from "@playground/shared";
import {
  CredentialOfferOutcomeUnknownError,
  createInjiCertify,
  type CertifyHttpClient,
} from "./injiCertify";
import { redactBody } from "../http/redact";
import { createTracedClient, tracedRequestWith } from "../http/tracedClient";

const context: RunContext = {
  runId: "run-test",
  format: "dc+sd-jwt",
  record: async () => undefined,
};

const metadataFixture = {
  credential_issuer: "https://certify.test",
  credential_endpoint: "https://certify.test/issuance/credential",
  credential_configurations_supported: {
    identity_ldp_vc: {
      format: "ldp_vc",
      credential_definition: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "IdentityCredential"],
      },
      proof_types_supported: {
        jwt: {
          proof_signing_alg_values_supported: ["ES256"],
        },
      },
    },
    identity_sd_jwt: {
      format: "dc+sd-jwt",
      vct: "IdentityCredential",
      claims: { given_name: {} },
    },
  },
};

function client(response: unknown, status = 200): CertifyHttpClient {
  return {
    async request(_trace, request) {
      assert.equal(request.method, "GET");
      assert.equal(request.url, "https://certify.test/.well-known/openid-credential-issuer");
      return { status, data: response };
    },
  };
}

function offerClient(
  offerResponse: unknown,
  offerStatus = 200,
  onOfferRequest?: (request: { method?: string; url?: string; data?: unknown }) => void,
): CertifyHttpClient {
  return {
    async request(trace, request) {
      if (trace.name === "issuer_metadata") {
        assert.equal(request.method, "GET");
        assert.equal(request.url, "https://certify.test/.well-known/openid-credential-issuer");
        return { status: 200, data: metadataFixture };
      }
      assert.equal(trace.name, "credential_offer");
      onOfferRequest?.(request);
      return { status: offerStatus, data: offerResponse };
    },
  };
}

test("discovers issuer metadata using the documented method and path", async () => {
  const adapter = createInjiCertify(client(metadataFixture), { baseUrl: "https://certify.test" });

  const metadata = await adapter.discoverMetadata(context);

  assert.equal(metadata.credential_issuer, "https://certify.test");
  assert.equal(metadata.credential_configurations_supported.identity_ldp_vc.format, "ldp_vc");
  assert.equal(metadata.credential_configurations_supported.identity_sd_jwt.format, "dc+sd-jwt");
});

test("rejects malformed JSON and invalid metadata shapes", async () => {
  for (const response of [
    "not-json",
    [],
    { credential_issuer: "https://certify.test" },
    { ...metadataFixture, credential_configurations_supported: [] },
    { ...metadataFixture, credential_configurations_supported: {} },
    { ...metadataFixture, credential_configurations_supported: { identity: { format: 42 } } },
    { ...metadataFixture, credential_configurations_supported: { identity: null } },
  ]) {
    await assert.rejects(
      createInjiCertify(client(response), { baseUrl: "https://certify.test" }).discoverMetadata(context),
      /metadata (response is not a JSON object|is missing|has no credential configurations|has an invalid credential configuration)/,
    );
  }
});

test("accepts structurally valid credential configuration entries", async () => {
  const metadata = await createInjiCertify(client(metadataFixture), {
    baseUrl: "https://certify.test",
  }).discoverMetadata(context);

  assert.deepEqual(Object.keys(metadata.credential_configurations_supported), [
    "identity_ldp_vc",
    "identity_sd_jwt",
  ]);
});

test("rejects invalid configured base and metadata URLs", async () => {
  assert.throws(() => createInjiCertify(client({}), { baseUrl: "https://user:pass@certify.test" }), /invalid base URL/);

  for (const response of [
    { credential_issuer: "javascript:alert(1)", credential_endpoint: "https://certify.test/issuance/credential" },
    { credential_issuer: "https://certify.test#fragment", credential_endpoint: "https://certify.test/issuance/credential" },
    { credential_issuer: "https://certify.test", credential_endpoint: "https://user:pass@certify.test/issuance/credential" },
  ]) {
    await assert.rejects(
      createInjiCertify(client(response), { baseUrl: "https://certify.test" }).discoverMetadata(context),
      /invalid .* URL/,
    );
  }
});

test("rejects non-2xx metadata responses", async () => {
  await assert.rejects(
    createInjiCertify(client({ error: "unavailable" }, 503), { baseUrl: "https://certify.test" }).discoverMetadata(context),
    /HTTP 503/,
  );
});

test("normalizes network errors without exposing their contents", async () => {
  const adapter = createInjiCertify({
    async request() {
      throw new Error("network failed with client_secret=secret-value");
    },
  }, { baseUrl: "https://certify.test" });

  await assert.rejects(
    adapter.discoverMetadata(context),
    (error: Error) => error.message === "Inji Certify metadata request failed"
      && !error.message.includes("secret-value"),
  );
});

test("creates a pre-authorized offer after validating issuer support", async () => {
  let offerRequest: { method?: string; url?: string; data?: unknown } | undefined;
  const adapter = createInjiCertify(
    offerClient({
      credential_offer_uri: "openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fcertify.test%2Fcredential-offer-data%2Foffer-1",
    }, 200, (request) => {
      offerRequest = request;
    }),
    { baseUrl: "https://certify.test" },
  );

  const offer = await adapter.createOffer(context, {
    credentialType: "identity_sd_jwt",
    issuanceFlow: "pre_authorized_code",
    claims: { given_name: "claim-sentinel" },
    expiresIn: 600,
    txCode: "TX12",
  });

  assert.equal(offer.offerUri.startsWith("openid-credential-offer://"), true);
  assert.equal(offer.issuerUrl, "https://certify.test");
  assert.equal(offerRequest?.method, "POST");
  assert.equal(offerRequest?.url, "https://certify.test/pre-authorized-data");
  assert.deepEqual(offerRequest?.data, {
    credential_configuration_id: "identity_sd_jwt",
    claims: { given_name: "claim-sentinel" },
    expires_in: 600,
    tx_code: "TX12",
  });
});

test("requires the run format to match the advertised configuration format", async () => {
  for (const [format, configuration] of [
    ["ldp_vc", "identity_ldp_vc"],
    ["dc+sd-jwt", "identity_sd_jwt"],
  ] as const) {
    const adapter = createInjiCertify(
      offerClient({
        credential_offer_uri: "openid-credential-offer://test",
      }),
      { baseUrl: "https://certify.test" },
    );

    const offer = await adapter.createOffer({ ...context, format }, {
      credentialType: configuration,
      issuanceFlow: "pre_authorized_code",
      claims: {},
    });
    assert.equal(offer.offerUri, "openid-credential-offer://test");
  }

  await assert.rejects(
    createInjiCertify(offerClient({ credential_offer_uri: "openid-credential-offer://test" }), {
      baseUrl: "https://certify.test",
    }).createOffer({ ...context, format: "ldp_vc" }, {
      credentialType: "identity_sd_jwt",
      issuanceFlow: "pre_authorized_code",
      claims: {},
    }),
    /configuration format is not supported/,
  );
});

test("rejects invalid offer input before contacting Certify", async () => {
  let calls = 0;
  const adapter = createInjiCertify({
    async request() {
      calls += 1;
      return { status: 200, data: metadataFixture };
    },
  }, { baseUrl: "https://certify.test" });

  const requests = [
    undefined,
    { credentialType: "", issuanceFlow: "pre_authorized_code" as const },
    { credentialType: "identity_sd_jwt", issuanceFlow: "authorization_code" as const },
    { credentialType: "identity_sd_jwt", issuanceFlow: "pre_authorized_code" as const, claims: [] as never },
    { credentialType: "identity_sd_jwt", issuanceFlow: "pre_authorized_code" as const, claims: {}, expiresIn: 59 },
    { credentialType: "identity_sd_jwt", issuanceFlow: "pre_authorized_code" as const, claims: {}, expiresIn: 86401 },
    { credentialType: "identity_sd_jwt", issuanceFlow: "pre_authorized_code" as const, claims: {}, txCode: "bad!" },
  ];

  for (const request of requests) {
    await assert.rejects(adapter.createOffer(context, request), /offer request is invalid/);
  }
  assert.equal(calls, 0);
});

test("rejects unsupported configurations without creating an offer", async () => {
  let postCalled = false;
  const adapter = createInjiCertify(offerClient({}, 200, () => {
    postCalled = true;
  }), { baseUrl: "https://certify.test" });

  await assert.rejects(
    adapter.createOffer(context, {
      credentialType: "unknown_configuration",
      issuanceFlow: "pre_authorized_code",
      claims: {},
    }),
    /credential configuration is not supported/,
  );
  assert.equal(postCalled, false);
});

test("rejects malformed offer responses and classifies HTTP outcomes safely", async () => {
  for (const response of [undefined, {}, [], { credential_offer_uri: "https://certify.test/offer" }]) {
    await assert.rejects(
      createInjiCertify(offerClient(response), { baseUrl: "https://certify.test" }).createOffer(context, {
        credentialType: "identity_sd_jwt",
        issuanceFlow: "pre_authorized_code",
        claims: {},
      }),
      (error: Error) => error instanceof CredentialOfferOutcomeUnknownError,
    );
  }

  await assert.rejects(
    createInjiCertify(offerClient({ error: "unavailable" }, 503), { baseUrl: "https://certify.test" }).createOffer(context, {
      credentialType: "identity_sd_jwt",
      issuanceFlow: "pre_authorized_code",
      claims: {},
    }),
    (error: Error) => error instanceof CredentialOfferOutcomeUnknownError,
  );

  await assert.rejects(
    createInjiCertify(offerClient({ error: "invalid request" }, 400), { baseUrl: "https://certify.test" }).createOffer(context, {
      credentialType: "identity_sd_jwt",
      issuanceFlow: "pre_authorized_code",
      claims: {},
    }),
    /credential offer request returned HTTP 400/,
  );
});

test("normalizes offer network errors without exposing their contents", async () => {
  const adapter = createInjiCertify({
    async request(trace) {
      if (trace.name === "issuer_metadata") return { status: 200, data: metadataFixture };
      throw new Error("network-secret-sentinel");
    },
  }, { baseUrl: "https://certify.test" });

  await assert.rejects(
    adapter.createOffer(context, {
      credentialType: "identity_sd_jwt",
      issuanceFlow: "pre_authorized_code",
      claims: {},
    }),
    (error: Error) => error instanceof CredentialOfferOutcomeUnknownError
      && !error.message.includes("network-secret-sentinel"),
  );
});

test("mocked pre-authorized-data fixture preserves the contract while redacting secrets", async () => {
  const steps: RecordStepInput[] = [];
  const tracedClient = createTracedClient(async (_runId: string, input: RecordStepInput) => {
    steps.push(input);
  });
  const response = await tracedRequestWith(tracedClient, {
    runId: context.runId,
    name: "credential_offer",
    stage: "issuance",
    from: "playground",
    to: "inji-certify",
  }, {
    method: "POST",
    url: "https://certify.test/pre-authorized-data",
    headers: { Authorization: "access-token-sentinel" },
    data: {
      credential_configuration_id: "identity_sd_jwt",
      claims: { given_name: "secret-claim-sentinel" },
      expires_in: 600,
      tx_code: "tx-code-sentinel",
    },
    adapter: async (requestConfig) => ({
      data: {
        credential_offer_uri: "openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fcertify.test%2Fcredential-offer-data%2Foffer-1",
        "pre-authorized_code": "pre-auth-code-sentinel",
        tx_code: "tx-code-sentinel",
        access_token: "access-token-sentinel",
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: requestConfig,
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(
    (response.data as { credential_offer_uri: string }).credential_offer_uri.startsWith("openid-credential-offer://"),
    true,
  );
  const serialized = JSON.stringify(steps);
  assert.equal(serialized.includes("secret-claim-sentinel"), false);
  assert.equal(serialized.includes("pre-auth-code-sentinel"), false);
  assert.equal(serialized.includes("tx-code-sentinel"), false);
  assert.equal(serialized.includes("access-token-sentinel"), false);
});

test("createOffer traces redacted request and response data", async () => {
  const steps: RecordStepInput[] = [];
  const traced = createTracedClient(async (_runId: string, input: RecordStepInput) => {
    steps.push(input);
  });
  const client: CertifyHttpClient = {
    request: (trace, request) => tracedRequestWith(traced, trace, {
      ...request,
      adapter: async (requestConfig) => ({
        data: requestConfig.url?.endsWith("/pre-authorized-data")
          ? {
              credential_offer_uri: "openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fcertify.test%2Foffer-1",
              "pre-authorized_code": "pre-auth-sentinel",
              tx_code: "tx-code-sentinel",
              access_token: "access-token-sentinel",
            }
          : metadataFixture,
        status: 200,
        statusText: "OK",
        headers: {},
        config: requestConfig,
      }),
    }),
  };

  await createInjiCertify(client, { baseUrl: "https://certify.test" }).createOffer(context, {
    credentialType: "identity_sd_jwt",
    issuanceFlow: "pre_authorized_code",
    claims: { given_name: "claim-sentinel" },
    txCode: "TX12",
  });

  const serialized = JSON.stringify(steps);
  assert.equal(serialized.includes("claim-sentinel"), false);
  assert.equal(serialized.includes("pre-auth-sentinel"), false);
  assert.equal(serialized.includes("tx-code-sentinel"), false);
  assert.equal(serialized.includes("access-token-sentinel"), false);
});

test("redaction removes token, code, and client-secret values from serialized records", () => {
  const serialized = JSON.stringify(redactBody({
    access_token: "access-token-test",
    "pre-authorized_code": "pre-auth-test",
    tx_code: "tx-code-test",
    client_secret: "client-secret-test",
    credentialSubject: { name: "not persisted by this boundary" },
  }));

  assert.equal(serialized.includes("access-token-test"), false);
  assert.equal(serialized.includes("pre-auth-test"), false);
  assert.equal(serialized.includes("tx-code-test"), false);
  assert.equal(serialized.includes("client-secret-test"), false);
  assert.equal(serialized.includes("not persisted by this boundary"), true);
});
