CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('vehicle','charger')),
    status TEXT NOT NULL DEFAULT 'unknown',
    battery_pct INTEGER NULL CHECK (battery_pct BETWEEN 0 AND 100),
    charging BOOLEAN NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, external_id)
);

CREATE TABLE IF NOT EXISTS commands (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('START_CHARGING','STOP_CHARGING','REFRESH_STATUS')),
    status TEXT NOT NULL CHECK (status IN ('queued','processing','succeeded','failed','dead_letter')),
    idempotency_key TEXT NOT NULL UNIQUE,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commands_queue
    ON commands(status, created_at)
    WHERE status='queued';

CREATE INDEX IF NOT EXISTS idx_devices_provider
    ON devices(provider);
