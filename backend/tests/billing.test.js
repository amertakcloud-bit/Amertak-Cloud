import test from "node:test";
import assert from "node:assert/strict";
import { RATES, tokensForBytes } from "../lib/billing.js";
import { decryptSecret, encryptSecret } from "../lib/secretBox.js";

const MB = 1048576;
test("token cost is always a whole number, rounded up", () => {
  assert.equal(tokensForBytes(1 * MB, RATES.captionPerMB), 5);
  assert.equal(tokensForBytes(2.12 * MB, RATES.captionPerMB), 11); // 10.6 → 11
  assert.equal(tokensForBytes(1.018 * MB, RATES.captionPerMB), 6); // 5.09 → 6
  assert.equal(tokensForBytes(5 * MB, RATES.cloudSharePerMB), 10);
  assert.equal(tokensForBytes(5 * MB + 1, RATES.cloudSharePerMB), 11);
  assert.equal(tokensForBytes(10, RATES.cloudSharePerMB), 1); // minimum 1
  for (const b of [1, 999, 123456, 7 * MB + 3]) assert.ok(Number.isInteger(tokensForBytes(b, 5)));
});

test("secretBox round-trips and rejects tampering", () => {
  const e = encryptSecret("AQ.some-key-123");
  assert.notEqual(e, "AQ.some-key-123");
  assert.equal(decryptSecret(e), "AQ.some-key-123");
  assert.equal(decryptSecret(e.slice(0, -2) + "xx"), "");
  assert.equal(decryptSecret(""), "");
});
