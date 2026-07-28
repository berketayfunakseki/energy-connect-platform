import { Pool } from "pg";
import { CommandType, Device, DeviceCommand, DeviceKind } from "../domain";
import { nowIso, randomId } from "../util";

function rowToDevice(row: any): Device {
  return {
    id: row.id,
    provider: row.provider,
    externalId: row.external_id,
    kind: row.kind,
    status: row.status,
    batteryPct: row.battery_pct,
    charging: row.charging,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function rowToCommand(row: any): DeviceCommand {
  return {
    id: row.id,
    deviceId: row.device_id,
    type: row.type,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME ?? "connect";
  const port = process.env.DB_PORT ?? "5432";
  if (host && user && password) {
    return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }
  return "postgres://connect:connect@localhost:5432/connect";
}

export class Repository {
  readonly pool: Pool;

  constructor(connectionString = resolveDatabaseUrl()) {
    this.pool = new Pool({ connectionString });
  }

  async ping(): Promise<void> { await this.pool.query("SELECT 1"); }

  async listDevices(): Promise<Device[]> {
    const result = await this.pool.query("SELECT * FROM devices ORDER BY created_at DESC");
    return result.rows.map(rowToDevice);
  }

  async getDevice(id: string): Promise<Device | null> {
    const result = await this.pool.query("SELECT * FROM devices WHERE id=$1", [id]);
    return result.rows[0] ? rowToDevice(result.rows[0]) : null;
  }

  async createDevice(provider: string, externalId: string, kind: DeviceKind, state: {status: string; batteryPct: number|null; charging: boolean|null}): Promise<Device> {
    const id = randomId("dev");
    const result = await this.pool.query(
      `INSERT INTO devices (id, provider, external_id, kind, status, battery_pct, charging)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [id, provider, externalId, kind, state.status, state.batteryPct, state.charging],
    );
    return rowToDevice(result.rows[0]);
  }

  async enqueueCommand(deviceId: string, type: CommandType, idempotencyKey: string): Promise<DeviceCommand> {
    const existing = await this.pool.query("SELECT * FROM commands WHERE idempotency_key=$1", [idempotencyKey]);
    if (existing.rows[0]) return rowToCommand(existing.rows[0]);
    const id = randomId("cmd");
    const result = await this.pool.query(
      `INSERT INTO commands (id, device_id, type, status, idempotency_key)
       VALUES ($1,$2,$3,'queued',$4)
       RETURNING *`,
      [id, deviceId, type, idempotencyKey],
    );
    return rowToCommand(result.rows[0]);
  }

  async getCommand(id: string): Promise<DeviceCommand | null> {
    const result = await this.pool.query("SELECT * FROM commands WHERE id=$1", [id]);
    return result.rows[0] ? rowToCommand(result.rows[0]) : null;
  }

  async queueBacklog(): Promise<number> {
    const result = await this.pool.query("SELECT count(*)::int AS count FROM commands WHERE status='queued'");
    return Number(result.rows[0]?.count ?? 0);
  }

  async claimNextCommand(): Promise<DeviceCommand | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `SELECT * FROM commands
         WHERE status='queued'
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
      );
      const row = result.rows[0];
      if (!row) {
        await client.query("COMMIT");
        return null;
      }
      const updated = await client.query(
        `UPDATE commands
         SET status='processing', attempt_count=attempt_count+1, updated_at=NOW()
         WHERE id=$1
         RETURNING *`,
        [row.id],
      );
      await client.query("COMMIT");
      return rowToCommand(updated.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async markCommand(id: string, status: "succeeded" | "failed" | "dead_letter", error: string | null): Promise<void> {
    await this.pool.query(
      "UPDATE commands SET status=$2, last_error=$3, updated_at=NOW() WHERE id=$1",
      [id, status, error],
    );
  }

  async refreshDeviceState(id: string, state: {status: string; batteryPct: number|null; charging: boolean|null}): Promise<void> {
    await this.pool.query(
      "UPDATE devices SET status=$2, battery_pct=$3, charging=$4, updated_at=NOW() WHERE id=$1",
      [id, state.status, state.batteryPct, state.charging],
    );
  }

  async close(): Promise<void> { await this.pool.end(); }
}

export const repositoryStartedAt = nowIso();
