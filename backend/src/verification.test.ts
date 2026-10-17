import assert from "node:assert/strict";
import test from "node:test";
import {
  canAcceptAttemptCallback,
  summarizeVerificationResult,
} from "@playground/shared";
import { shouldCreateCredential } from "./store/runStore";
import { validateVerifierStatusTransition } from "./verificationPolicy";

test("verification runs do not create issued credentials", () => {
  assert.equal(shouldCreateCredential("verification"), false);
  assert.equal(shouldCreateCredential("issuance"), false);
  assert.equal(shouldCreateCredential("workflow"), true);
  assert.equal(shouldCreateCredential(undefined), true);
});

test("verifier status transitions are terminal and require a valid pass", () => {
  assert.equal(validateVerifierStatusTransition("running", "pass", "VALID"), undefined);
  assert.match(
    validateVerifierStatusTransition("running", "pass", "INVALID") ?? "",
    /VALID outcome/,
  );
  assert.match(
    validateVerifierStatusTransition("running", "running", undefined) ?? "",
    /terminal/,
  );
  assert.match(
    validateVerifierStatusTransition("pass", "fail", "INVALID") ?? "",
    /already has a terminal/,
  );
});

test("attempt callbacks require the current unfinished attempt", () => {
  const current = { id: "new", finished: false };
  assert.equal(canAcceptAttemptCallback(current, "new"), true);
  assert.equal(canAcceptAttemptCallback(current, "old"), false);
  current.finished = true;
  assert.equal(canAcceptAttemptCallback(current, "new"), false);
  assert.equal(canAcceptAttemptCallback(null, "new"), false);
});

test("mixed SDK results preserve item outcomes and fail closed", () => {
  const summary = summarizeVerificationResult([
    { verificationStatus: "SUCCESS" },
    { verificationStatus: "EXPIRED" },
    { verificationStatus: "REVOKED" },
  ]);
  assert.deepEqual(summary.itemOutcomes, ["VALID", "EXPIRED", "REVOKED"]);
  assert.equal(summary.outcome, "REVOKED");
  assert.equal(summarizeVerificationResult([{ verificationStatus: "SUCCESS" }, { unknown: true }]).outcome, null);
  assert.equal(summarizeVerificationResult({ malformed: true }).outcome, null);
});
