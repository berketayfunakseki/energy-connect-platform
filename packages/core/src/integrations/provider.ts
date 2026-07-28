import { CommandType, DeviceKind, ProviderCommandResult } from "../domain";

export interface ProviderDeviceState {
  status: "online" | "offline" | "unknown";
  batteryPct: number | null;
  charging: boolean | null;
}

export interface ConnectDeviceInput {
  externalId: string;
  kind: DeviceKind;
}

export interface EnergyProvider {
  readonly name: string;
  connect(input: ConnectDeviceInput): Promise<ProviderDeviceState>;
  getState(externalId: string): Promise<ProviderDeviceState>;
  sendCommand(externalId: string, command: CommandType): Promise<ProviderCommandResult>;
}
