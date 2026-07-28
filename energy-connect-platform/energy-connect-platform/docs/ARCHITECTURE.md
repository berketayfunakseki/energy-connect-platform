# Architecture decisions

## Product-level platform engineering

The system focuses on the product connectivity layer rather than treating infrastructure as the product. Clients see one stable API even though each energy-device provider can have different behavior and failure modes.

## API + worker split

The HTTP API validates requests and persists commands quickly. Device actions happen asynchronously in a worker process. This reduces request latency and makes provider outages easier to absorb.

## PostgreSQL as durable coordination layer

The `commands` table acts as a durable queue for the portfolio demo. Workers claim rows with `FOR UPDATE SKIP LOCKED` inside a transaction. This is a widely useful distributed-systems pattern because it enables multiple worker replicas without duplicate processing.

## Integration adapter boundary

Each OEM implements the same provider interface. Provider-specific authentication, payload mapping and error classification stay behind that boundary.

## Reliability boundaries

Retries are bounded. Circuit breakers are provider-scoped, so one unhealthy integration does not consume all worker capacity. Idempotency keys guard device actions from duplicate client requests.

## Observability

Every request gets a correlation ID. Logs are structured JSON. Metrics cover request count, error count, latency, queue backlog, provider calls, provider failures, retry count and circuit-open events.
