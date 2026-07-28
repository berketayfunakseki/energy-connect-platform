# Energy Connect Platform

A portfolio-grade **TypeScript / Node.js backend platform** for reliable communication between digital services and simulated energy devices such as EV chargers and vehicles.

The project is intentionally shaped around real platform-engineering problems: **API integrations, distributed systems, scalable backend architecture, PostgreSQL, reliability engineering, observability, monitoring, alerting, debugging, automation, SLA/SLO practices, Docker, React, AWS, CDK/CloudFormation, and AI-assisted engineering workflows**.

> This repository is an independent portfolio project. It is not affiliated with Enode or any OEM.

## Why this exists

Energy platforms often need to hide unreliable OEM APIs behind one consistent product interface. This project demonstrates how to build that connectivity layer while keeping failures isolated and operations observable.

## Architecture

```text
                         +-----------------------------+
                         | React Operations Dashboard  |
                         +--------------+--------------+
                                        |
                                        v
+-------------+       HTTP       +------+----------------+
| Client/App  +----------------->+ TypeScript / Node API  |
+-------------+                  +------+----------------+
                                        |
                           enqueue command / idempotency
                                        |
                                        v
                               +--------+--------+
                               | PostgreSQL      |
                               | devices + queue |
                               +--------+--------+
                                        |
                            FOR UPDATE SKIP LOCKED
                                        |
                                        v
                              +---------+---------+
                              | Node.js Worker    |
                              +---------+---------+
                                        |
                        retry + circuit breaker
                                        |
                     +------------------+------------------+
                     |                                     |
                     v                                     v
              Simulated EV OEM A                    Simulated EV OEM B

API + Worker expose structured logs and Prometheus-style metrics.
AWS CDK defines a cloud deployment using ECS/Fargate, RDS PostgreSQL,
CloudWatch alarms, networking and autoscaling. `cdk synth` produces CloudFormation.
```

The API and worker are separate processes and can be horizontally scaled. Queue claiming uses PostgreSQL row locking with `FOR UPDATE SKIP LOCKED`, which prevents two workers from processing the same command and demonstrates a practical distributed-systems coordination pattern.

## Core engineering features

- **Maintainable, testable backend software:** modular TypeScript services with Node.js and automated tests.
- **API integrations:** adapter interface for multiple simulated EV/charger OEM providers.
- **Distributed systems:** independently scalable API and worker services, idempotency keys, durable command queue, safe concurrent worker claiming.
- **Reliability engineering:** exponential-backoff retries, circuit breaker, timeout handling, failure classification and dead-letter state.
- **Observability:** structured JSON logs, correlation IDs, request metrics, provider success/failure counters, latency histograms, health endpoint.
- **Monitoring and alerting:** Prometheus scrape configuration plus alert rules for error rate, p95 latency and queue backlog.
- **SLA/SLO practices:** code tracks success-rate and p95-latency objectives; dashboards surface SLO health.
- **Automation / internal tools:** worker automation, provider health checks, operational dashboard and deterministic integration simulator.
- **PostgreSQL:** relational device model, command queue, idempotency constraints and indexes.
- **Docker:** multi-service Docker Compose for API, worker, PostgreSQL, Prometheus and Grafana.
- **React:** operations UI for device state, queued commands, provider reliability and SLO status.
- **AWS:** AWS CDK stack for ECS/Fargate services, RDS PostgreSQL, CloudWatch alarms and autoscaling; CDK synthesizes to **CloudFormation**.
- **AI-assisted engineering:** `docs/AI_ENGINEERING.md` documents safe use of coding assistants for test generation, debugging hypotheses and review, with human verification.

## Tech stack

**TypeScript, Node.js, JavaScript, React, PostgreSQL, Docker, AWS, AWS CDK, CloudFormation, Prometheus, Grafana, GitHub Actions CI/CD**

## API surface

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness/readiness signal |
| `GET` | `/metrics` | Prometheus text metrics |
| `GET` | `/v1/devices` | List connected devices |
| `POST` | `/v1/devices/connect` | Create a simulated OEM device integration |
| `POST` | `/v1/devices/:id/commands` | Enqueue an idempotent device command |
| `GET` | `/v1/commands/:id` | Inspect command status / debugging data |
| `GET` | `/v1/ops/slo` | Current SLO snapshot |

Example connection:

```bash
curl -X POST http://localhost:8080/v1/devices/connect \
  -H 'content-type: application/json' \
  -d '{"provider":"volt-oem","externalId":"EV-42","kind":"vehicle"}'
```

Example command:

```bash
curl -X POST http://localhost:8080/v1/devices/DEVICE_ID/commands \
  -H 'content-type: application/json' \
  -H 'idempotency-key: demo-001' \
  -d '{"type":"START_CHARGING"}'
```

## Local run

### Option A - Docker Compose

```bash
docker compose up --build
```

Services:

- API: `http://localhost:8080`
- React operations dashboard: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`
- PostgreSQL: `localhost:5432`

### Option B - host Node.js + Docker PostgreSQL

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run build
npm run start:api
# second terminal
npm run start:worker
```

Run tests:

```bash
npm test
```

## Reliability design

### Retries
Only transient provider failures are retried. Backoff grows exponentially and is capped to avoid retry storms.

### Circuit breaker
Repeated provider failures open a circuit. Requests fail fast during the cooldown period and the provider is probed again in half-open state. This isolates unhealthy OEM integrations from the rest of the connectivity platform.

### Idempotency
The `commands.idempotency_key` column is unique. Replayed client requests return the existing command instead of issuing a duplicate real-world device action.

### Distributed worker coordination
Workers claim jobs using a transaction and `FOR UPDATE SKIP LOCKED`. Multiple worker replicas can process separate jobs concurrently without double-executing a command.

## SLOs and monitoring

The sample operational targets are intentionally explicit:

- API success SLO: **99.9%**
- API p95 latency objective: **< 500 ms**
- Alert when 5-minute error ratio exceeds **1%**
- Alert when queue backlog exceeds **100 commands**

These are demonstration objectives, not claims about production traffic.

See `monitoring/alert.rules.yml` and `packages/core/src/observability/slo.ts`.

## AWS / CDK / CloudFormation

The `infra/cdk` package defines:

- VPC
- ECS Fargate API service
- ECS Fargate worker service
- Application Load Balancer
- RDS PostgreSQL
- CloudWatch alarms
- CPU-based autoscaling
- secrets/environment wiring

```bash
cd infra/cdk
npm install
npx cdk synth
```

`cdk synth` emits the corresponding AWS CloudFormation template.

## Debugging playbook

See [`docs/DEBUGGING.md`](docs/DEBUGGING.md) for a systematic workflow covering correlation IDs, queue state, provider failures, circuit state, SQL inspection, metrics and recurrent-incident prevention.

## Repository map

```text
apps/api/                 Node.js API service
apps/worker/              asynchronous command worker
packages/core/            integrations, reliability, observability, persistence
frontend/                 React operations dashboard
migrations/               PostgreSQL schema
monitoring/               Prometheus + alerting rules
infra/cdk/                AWS CDK / CloudFormation deployment
.github/workflows/        CI pipeline
docs/                     architecture, debugging, AI engineering notes
```

## CV-ready one-line description

> Built a TypeScript/Node.js energy-device connectivity platform with OEM-style API integrations, PostgreSQL-backed asynchronous workers, idempotency, retries/circuit breakers, observability/SLO monitoring, React ops tooling, Docker, and AWS CDK/CloudFormation infrastructure.
