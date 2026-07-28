const test = require("node:test");
const assert = require("node:assert/strict");
import { CircuitBreaker } from "../packages/core/src/reliability/circuitBreaker";

test("circuit opens after threshold failures", async () => {
  const breaker = new CircuitBreaker(2, 10_000);
  await assert.rejects(() => breaker.execute(async () => { throw new Error("x"); }));
  await assert.rejects(() => breaker.execute(async () => { throw new Error("x"); }));
  assert.equal(breaker.state, "open");
  await assert.rejects(() => breaker.execute(async () => "should-not-run"), /circuit_open/);
});
