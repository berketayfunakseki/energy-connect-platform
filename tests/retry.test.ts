const test = require("node:test");
const assert = require("node:assert/strict");
import { withRetry } from "../packages/core/src/reliability/retry";

test("retry recovers from transient failures", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls += 1;
    if (calls < 3) throw new Error("transient");
    return "ok";
  }, { attempts: 3, baseDelayMs: 1, maxDelayMs: 2 });
  assert.equal(result, "ok");
  assert.equal(calls, 3);
});

test("retry stops when predicate says permanent", async () => {
  let calls = 0;
  await assert.rejects(() => withRetry(async () => {
    calls += 1;
    throw new Error("permanent");
  }, { attempts: 5, baseDelayMs: 1, maxDelayMs: 1, shouldRetry: () => false }));
  assert.equal(calls, 1);
});
