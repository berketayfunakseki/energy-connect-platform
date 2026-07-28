import { metrics } from "./metrics";

export interface SloSnapshot {
  successTarget: number;
  p95TargetMs: number;
  totalRequests: number;
  failedRequests: number;
  successRate: number;
  p95Ms: number;
  successObjectiveMet: boolean;
  latencyObjectiveMet: boolean;
}

export function getSloSnapshot(): SloSnapshot {
  const successTarget = Number(process.env.SLO_SUCCESS_TARGET ?? "0.999");
  const p95TargetMs = Number(process.env.SLO_P95_MS ?? "500");
  const totalRequests = metrics.getCounter("connect_http_requests_total");
  const failedRequests = metrics.getCounter("connect_http_requests_failed_total");
  const successRate = totalRequests === 0 ? 1 : (totalRequests - failedRequests) / totalRequests;
  const p95Ms = metrics.percentile("connect_http_request_duration_ms", 0.95);

  return {
    successTarget,
    p95TargetMs,
    totalRequests,
    failedRequests,
    successRate,
    p95Ms,
    successObjectiveMet: successRate >= successTarget,
    latencyObjectiveMet: p95Ms <= p95TargetMs,
  };
}
