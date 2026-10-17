import test from "node:test";
import assert from "node:assert/strict";
import { REDACTED, redactBody, redactHeaders } from "./redact";

test("secret headers are hidden, ordinary ones are kept", () => {
  const headers = redactHeaders({
    Authorization: "Bearer abc123",
    "Content-Type": "application/json",
    Cookie: "session=1",
  });
  assert.equal(headers.Authorization, REDACTED);
  assert.equal(headers.Cookie, REDACTED);
  assert.equal(headers["Content-Type"], "application/json");
});

test("token response keeps its shape but loses the token", () => {
  const body = redactBody({ access_token: "secret", token_type: "Bearer", c_nonce: "keep" }) as Record<
    string,
    unknown
  >;
  assert.equal(body.access_token, REDACTED);
  assert.equal(body.token_type, "Bearer");
  assert.equal(body.c_nonce, "keep");
});

test("form encoded bodies are redacted per field", () => {
  const body = redactBody("grant_type=authorization_code&code=abc&redirect_uri=http://x");
  assert.equal(body, `grant_type=authorization_code&code=${REDACTED}&redirect_uri=http://x`);
});

test("single-field, encoded, and malformed structured secrets are hidden", () => {
  const values = [
    redactBody("client_secret=SECRET_SENTINEL"),
    redactBody("grant_type=authorization_code&client_secret=SECRET_SENTINEL"),
    redactBody("client%5Fsecret=SECRET_SENTINEL"),
    redactBody('{"access_token":"SECRET_SENTINEL"'),
  ];
  assert.equal(values.every((value) => !JSON.stringify(value).includes("SECRET_SENTINEL")), true);
});

test("ordinary non-sensitive strings remain readable", () => {
  assert.equal(redactBody("issuer metadata is available"), "issuer metadata is available");
});

test("secrets nested in arrays and objects are found", () => {
  const body = redactBody({ a: { b: [{ client_secret: "x", keep: 1 }] } }) as {
    a: { b: { client_secret: string; keep: number }[] };
  };
  assert.equal(body.a.b[0].client_secret, REDACTED);
  assert.equal(body.a.b[0].keep, 1);
});

test("tx_code and proof objects stay readable, their scalar forms do not", () => {
  const offer = redactBody({ tx_code: { input_mode: "numeric", length: 4 } }) as {
    tx_code: { length: number };
  };
  assert.equal(offer.tx_code.length, 4);

  const proof = redactBody({ proof: { proof_type: "jwt", jwt: "ey.secret" } }) as {
    proof: { proof_type: string; jwt: string };
  };
  assert.equal(proof.proof.proof_type, "jwt");
  assert.equal(proof.proof.jwt, REDACTED);

  const scalars = redactBody({ tx_code: "123456", proof: "ey.secret" }) as Record<string, unknown>;
  assert.equal(scalars.tx_code, REDACTED);
  assert.equal(scalars.proof, REDACTED);
});

test("pre-authorized_code is hidden inside the grants object", () => {
  const key = "urn:ietf:params:oauth:grant-type:pre-authorized_code";
  const offer = redactBody({ grants: { [key]: { "pre-authorized_code": "p1" } } }) as {
    grants: Record<string, Record<string, string>>;
  };
  assert.equal(offer.grants[key]["pre-authorized_code"], REDACTED);
});

test("credential claims are hidden from recorded protocol bodies", () => {
  const body = redactBody({ claims: { given_name: "claim-secret" } }) as Record<string, unknown>;
  assert.equal(body.claims, REDACTED);
  assert.equal(JSON.stringify(body).includes("claim-secret"), false);
});

test("deep and cyclic values do not expose secrets or throw", () => {
  assert.equal(redactBody(null), null);
  assert.equal(redactBody(undefined), undefined);
  assert.equal(redactBody("plain string"), "plain string");
  const cyclic: Record<string, unknown> = { name: "x" };
  cyclic.self = cyclic;
  assert.doesNotThrow(() => JSON.stringify(redactBody(cyclic)));

  const deep: Record<string, unknown> = {};
  let current = deep;
  for (let index = 0; index < 8; index += 1) {
    const nested: Record<string, unknown> = {};
    current.nested = nested;
    current = nested;
  }
  current.access_token = "SECRET_SENTINEL";
  assert.equal(JSON.stringify(redactBody(deep)).includes("SECRET_SENTINEL"), false);
});
