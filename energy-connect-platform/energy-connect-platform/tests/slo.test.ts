const test = require("node:test");
const assert = require("node:assert/strict");
import { metrics } from "../packages/core/src/observability/metrics";
import { getSloSnapshot } from "../packages/core/src/observability/slo";

test("SLO snapshot calculates success rate and latency", () => {
  metrics.inc("connect_http_requests_total", 1000);
  metrics.inc("connect_http_requests_failed_total", 1);
  for (const value of [50, 80, 100, 120, 150, 200, 250, 300, 400, 450]) {
    metrics.observe("connect_http_request_duration_ms", value);
  }
  const snapshot = getSloSnapshot();
  assert.ok(snapshot.successRate >= 0.999);
  assert.ok(snapshot.p95Ms <= 500);
});
