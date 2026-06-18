import assert from "node:assert/strict";
import test from "node:test";
import { findSilentCatchHandlers } from "./check-silent-catches.mjs";

test("detects expression-bodied promise catches that discard the error", () => {
  const findings = findSilentCatchHandlers(`
    Promise.resolve().catch(() => undefined);
    Promise.resolve().catch((err) => null);
    Promise.resolve().catch(error => void 0);
  `);

  assert.equal(findings.length, 3);
  assert.deepEqual(
    findings.map((finding) => finding.line),
    [2, 3, 4]
  );
});

test("allows promise catches that explicitly swallow the received error", () => {
  const findings = findSilentCatchHandlers(`
    Promise.resolve().catch((err) => swallow(err, "cache.cleanup", "file already removed"));
  `);

  assert.deepEqual(findings, []);
});
