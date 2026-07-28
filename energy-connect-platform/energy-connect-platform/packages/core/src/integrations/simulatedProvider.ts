import { CommandType, ProviderCommandResult } from "../domain";
import { randomId } from "../util";
import { ConnectDeviceInput, EnergyProvider, ProviderDeviceState } from "./provider";

export class ProviderTransientError extends Error {}
export class ProviderPermanentError extends Error {}

export class SimulatedEnergyProvider implements EnergyProvider {
  readonly name: string;
  private readonly states = new Map<string, ProviderDeviceState>();
  private transientFailuresRemaining = 0;

  constructor(name = "volt-oem") {
    this.name = name;
  }

  failNext(count: number): void {
    this.transientFailuresRemaining = count;
  }

  private maybeFail(externalId: string): void {
    if (externalId.startsWith("PERM_FAIL")) throw new ProviderPermanentError("provider_rejected_device");
    if (this.transientFailuresRemaining > 0) {
      this.transientFailuresRemaining -= 1;
      throw new ProviderTransientError("provider_temporarily_unavailable");
    }
  }

  async connect(input: ConnectDeviceInput): Promise<ProviderDeviceState> {
    this.maybeFail(input.externalId);
    const state: ProviderDeviceState = {
      status: "online",
      batteryPct: input.kind === "vehicle" ? 64 : null,
      charging: false,
    };
    this.states.set(input.externalId, state);
    return { ...state };
  }

  async getState(externalId: string): Promise<ProviderDeviceState> {
    this.maybeFail(externalId);
    return { ...(this.states.get(externalId) ?? { status: "unknown", batteryPct: null, charging: null }) };
  }

  async sendCommand(externalId: string, command: CommandType): Promise<ProviderCommandResult> {
    this.maybeFail(externalId);
    const current = this.states.get(externalId) ?? { status: "online", batteryPct: 50, charging: false };
    if (command === "START_CHARGING") current.charging = true;
    if (command === "STOP_CHARGING") current.charging = false;
    this.states.set(externalId, current);
    return { accepted: true, providerRequestId: randomId("provider") };
  }
}
