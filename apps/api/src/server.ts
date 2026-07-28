import { Repository } from "../../../packages/core/src/persistence/repository";
import { IntegrationService } from "../../../packages/core/src/services/integrationService";
import { metrics } from "../../../packages/core/src/observability/metrics";
import { getSloSnapshot } from "../../../packages/core/src/observability/slo";
import { logger } from "../../../packages/core/src/observability/logger";
import { CommandType, DeviceKind } from "../../../packages/core/src/domain";
import { randomId } from "../../../packages/core/src/util";

const http = require("http");
const { URL } = require("url");

const repository = new Repository();
const integrationService = new IntegrationService(repository);
const port = Number(process.env.PORT ?? "8080");

function json(res: any, status: number, body: unknown, correlationId: string): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "x-correlation-id": correlationId,
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,idempotency-key,x-correlation-id",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: any): Promise<any> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new Error("invalid_json"); }
}

function validKind(value: unknown): value is DeviceKind {
  return value === "vehicle" || value === "charger";
}

function validCommand(value: unknown): value is CommandType {
  return value === "START_CHARGING" || value === "STOP_CHARGING" || value === "REFRESH_STATUS";
}

const server = http.createServer(async (req: any, res: any) => {
  const started = Date.now();
  const correlationId = String(req.headers["x-correlation-id"] ?? randomId("corr"));
  metrics.inc("connect_http_requests_total");
  try {
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type,idempotency-key,x-correlation-id",
        "access-control-allow-methods": "GET,POST,OPTIONS",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && path === "/health") {
      await repository.ping();
      json(res, 200, { ok: true, service: "connect-api" }, correlationId);
      return;
    }

    if (req.method === "GET" && path === "/metrics") {
      const backlog = await repository.queueBacklog();
      metrics.set("connect_command_queue_backlog", backlog);
      res.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
      res.end(metrics.renderPrometheus());
      return;
    }

    if (req.method === "GET" && path === "/v1/devices") {
      json(res, 200, { devices: await repository.listDevices() }, correlationId);
      return;
    }

    if (req.method === "POST" && path === "/v1/devices/connect") {
      const body = await readJson(req);
      if (typeof body.provider !== "string" || typeof body.externalId !== "string" || !validKind(body.kind)) {
        json(res, 400, { error: "provider, externalId and kind are required" }, correlationId);
        return;
      }
      const device = await integrationService.connectDevice(body.provider, body.externalId, body.kind);
      json(res, 201, { device }, correlationId);
      return;
    }

    const commandMatch = path.match(/^\/v1\/devices\/([^/]+)\/commands$/);
    if (req.method === "POST" && commandMatch) {
      const body = await readJson(req);
      const idempotencyKey = req.headers["idempotency-key"];
      if (!validCommand(body.type) || typeof idempotencyKey !== "string") {
        json(res, 400, { error: "valid command type and idempotency-key header are required" }, correlationId);
        return;
      }
      const device = await repository.getDevice(commandMatch[1]);
      if (!device) {
        json(res, 404, { error: "device_not_found" }, correlationId);
        return;
      }
      const command = await repository.enqueueCommand(device.id, body.type, idempotencyKey);
      metrics.inc("connect_commands_enqueued_total");
      json(res, 202, { command }, correlationId);
      return;
    }

    const getCommandMatch = path.match(/^\/v1\/commands\/([^/]+)$/);
    if (req.method === "GET" && getCommandMatch) {
      const command = await repository.getCommand(getCommandMatch[1]);
      if (!command) {
        json(res, 404, { error: "command_not_found" }, correlationId);
        return;
      }
      json(res, 200, { command }, correlationId);
      return;
    }

    if (req.method === "GET" && path === "/v1/ops/slo") {
      json(res, 200, getSloSnapshot(), correlationId);
      return;
    }

    json(res, 404, { error: "not_found" }, correlationId);
  } catch (error) {
    metrics.inc("connect_http_requests_failed_total");
    logger.error("request failed", { correlationId, method: req.method, url: req.url, error: String(error) });
    json(res, 500, { error: "internal_error", correlationId }, correlationId);
  } finally {
    const durationMs = Date.now() - started;
    metrics.observe("connect_http_request_duration_ms", durationMs);
    logger.info("request completed", { correlationId, method: req.method, url: req.url, durationMs });
  }
});

server.listen(port, () => logger.info("api listening", { port }));

process.on("SIGTERM", async () => {
  await repository.close();
  process.exit(0);
});
