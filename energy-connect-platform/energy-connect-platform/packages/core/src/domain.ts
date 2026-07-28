export type DeviceKind = "vehicle" | "charger";
export type CommandType = "START_CHARGING" | "STOP_CHARGING" | "REFRESH_STATUS";
export type CommandStatus = "queued" | "processing" | "succeeded" | "failed" | "dead_letter";

export interface Device {
  id: string;
  provider: string;
  externalId: string;
  kind: DeviceKind;
  status: "online" | "offline" | "unknown";
  batteryPct: number | null;
  charging: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceCommand {
  id: string;
  deviceId: string;
  type: CommandType;
  status: CommandStatus;
  idempotencyKey: string;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCommandResult {
  accepted: boolean;
  providerRequestId: string;
}
