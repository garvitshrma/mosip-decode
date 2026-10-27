import test from "node:test";
import assert from "node:assert/strict";
import {
  createCredentialRequestProof,
  createLocalIdentity,
  createLocalPresentation,
  createLocalVerifierRequest,
  executeLocalDemo,
  isLocalDemoSelection,
  issueLocalCredential,
  verifyCredentialRequestProof,
  verifyLocalCredential,
  verifyLocalPresentation,
  type LocalSignedCredential,
} from "./adapters/localDemo";

function setup() {
  const issuer = createLocalIdentity();
  const holder = createLocalIdentity();
  const verifier = createLocalIdentity();
  const credential = issueLocalCredential({ format: "ldp_vc", issuer, holder });
  return { issuer, holder, verifier, credential };
}

test("local demo selection requires the whole reference stack", () => {
  assert.equal(isLocalDemoSelection("local-issuer", "local-wallet", "local-verifier"), true);
  assert.equal(isLocalDemoSelection("local-issuer", "local-wallet", "inji-verify"), false);
  assert.equal(isLocalDemoSelection("inji-certify", "local-wallet", "local-verifier"), false);
});

test("LDP credential has a real Ed25519 proof and verifies", () => {
  const { issuer, credential } = setup();
  const result = verifyLocalCredential(credential, issuer.did);
  assert.equal(result.outcome, "VALID");
  assert.equal(result.checks.find((check) => check.name === "issuer signature")?.ok, true);
});

test("tampering with the credential subject invalidates the proof", () => {
  const { issuer, credential } = setup();
  const document = credential.credential as Record<string, unknown>;
  const subject = document.credentialSubject as Record<string, unknown>;
  const tampered: LocalSignedCredential = {
    ...credential,
    credential: { ...document, credentialSubject: { ...subject, fullName: "Mallory" } },
  };
  const result = verifyLocalCredential(tampered, issuer.did);
  assert.equal(result.outcome, "INVALID");
  assert.equal(result.checks.find((check) => check.name === "issuer signature")?.ok, false);
});

test("a credential signed by a different key cannot claim the expected issuer", () => {
  const expectedIssuer = createLocalIdentity();
  const attacker = createLocalIdentity();
  const holder = createLocalIdentity();
  const credential = issueLocalCredential({ format: "ldp_vc", issuer: attacker, holder });
  const document = credential.credential as Record<string, unknown>;
  const tampered: LocalSignedCredential = {
    ...credential,
    credential: { ...document, issuer: expectedIssuer.did },
  };
  const result = verifyLocalCredential(tampered, expectedIssuer.did);
  assert.equal(result.outcome, "INVALID");
  assert.equal(result.checks.find((check) => check.name === "issuer key binding")?.ok, false);
});

test("an expired credential is reported as EXPIRED, not VALID", () => {
  const issuer = createLocalIdentity();
  const holder = createLocalIdentity();
  const credential = issueLocalCredential({
    format: "ldp_vc",
    issuer,
    holder,
    issuedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });
  const result = verifyLocalCredential(credential, issuer.did);
  assert.equal(result.outcome, "EXPIRED");
});

test("SD-JWT VC is a signed compact JWT and verifies", () => {
  const issuer = createLocalIdentity();
  const holder = createLocalIdentity();
  const credential = issueLocalCredential({ format: "vc+sd-jwt", issuer, holder });
  assert.equal(typeof credential.credential, "string");
  assert.equal((credential.credential as string).split(".").length, 3);
  const result = verifyLocalCredential(credential, issuer.did);
  assert.equal(result.outcome, "VALID");
});

test("a tampered SD-JWT VC fails signature verification", () => {
  const issuer = createLocalIdentity();
  const holder = createLocalIdentity();
  const credential = issueLocalCredential({ format: "vc+sd-jwt", issuer, holder });
  const [header, , signature] = (credential.credential as string).split(".");
  const payload = JSON.parse(
    Buffer.from((credential.credential as string).split(".")[1], "base64url").toString("utf8"),
  ) as Record<string, unknown>;
  const tamperedPayload = Buffer.from(
    JSON.stringify({ ...payload, fullName: "Mallory" }),
  ).toString("base64url");
  const tampered: LocalSignedCredential = {
    ...credential,
    credential: `${header}.${tamperedPayload}.${signature}`,
  };
  const result = verifyLocalCredential(tampered, issuer.did);
  assert.equal(result.outcome, "INVALID");
});

test("credential request proof binds the nonce and audience", () => {
  const holder = createLocalIdentity();
  const jwt = createCredentialRequestProof(holder, "http://local.demo/issuer", "nonce-1");
  const valid = verifyCredentialRequestProof(jwt, "http://local.demo/issuer", "nonce-1");
  assert.equal(valid.ok, true);
  assert.equal(valid.holderDid, holder.did);

  const wrongNonce = verifyCredentialRequestProof(jwt, "http://local.demo/issuer", "nonce-2");
  assert.equal(wrongNonce.ok, false);
  assert.match(wrongNonce.reason ?? "", /nonce/);
});

test("a holder-signed presentation verifies against the request", () => {
  const { issuer, holder, verifier, credential } = setup();
  const request = createLocalVerifierRequest(verifier);
  const presentation = createLocalPresentation(holder, credential, request);
  const result = verifyLocalPresentation({ presentation, request, expectedIssuerDid: issuer.did });
  assert.equal(result.outcome, "VALID");
});

test("a presentation replayed with a different nonce is rejected", () => {
  const { issuer, holder, verifier, credential } = setup();
  const request = createLocalVerifierRequest(verifier);
  const presentation = createLocalPresentation(holder, credential, request);
  const replay = { ...request, nonce: "different-nonce" };
  const result = verifyLocalPresentation({ presentation, request: replay, expectedIssuerDid: issuer.did });
  assert.equal(result.outcome, "INVALID");
  assert.equal(result.checks.find((check) => check.name === "holder signature")?.ok, false);
});

test("the full local demo records every protocol step and passes", async () => {
  const steps: string[] = [];
  const result = await executeLocalDemo({
    runId: "test-run",
    format: "ldp_vc",
    flow: "pre_authorized_code",
    record: async (input) => {
      steps.push(input.name);
    },
  });

  assert.equal(result.outcome, "VALID");
  assert.deepEqual(steps, [
    "issuer_metadata",
    "credential_offer",
    "token",
    "credential_request",
    "credential",
    "authorization_request",
    "presentation_definition",
    "vp_token",
    "verification_result",
  ]);
  assert.equal(result.checks.every((check) => check.ok), true);
});

test("the authorization-code flow adds the authorization exchange", async () => {
  const steps: string[] = [];
  const result = await executeLocalDemo({
    runId: "test-auth-code",
    format: "vc+sd-jwt",
    flow: "authorization_code",
    record: async (input) => {
      steps.push(input.name);
    },
  });

  assert.equal(result.outcome, "VALID");
  assert.deepEqual(steps, [
    "issuer_metadata",
    "credential_offer",
    "authorization",
    "token",
    "credential_request",
    "credential",
    "authorization_request",
    "presentation_definition",
    "vp_token",
    "verification_result",
  ]);
});
