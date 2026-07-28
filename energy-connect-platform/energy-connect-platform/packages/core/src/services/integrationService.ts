import { CommandType, Device, DeviceKind } from "../domain";
import { getProvider } from "../integrations/registry";
import { ProviderPermanentError, ProviderTransientError } from "../integrations/simulatedProvider";
import { metrics } from "../observability/metrics";
import { logger } from "../observability/logger";
import { CircuitBreaker } from "../reliability/circuitBreaker";
import { withRetry } from "../reliability/retry";
import { Repository } from "../persistence/repository";

const circuits = new Map<string, CircuitBreaker>();

function circuitFor(provider: string): CircuitBreaker {
  const current = circuits.get(provider) ?? new CircuitBreaker(3, 20_000);
  circuits.set(provider, current);
  return current;
}

export class IntegrationService {
  constructor(private readonly repository: Repository) {}

  async connectDevice(providerName: string, externalId: string, kind: DeviceKind): Promise<Device> {
    const provider = getProvider(providerName);
    const circuit = circuitFor(providerName);
    const state = await circuit.execute(() => withRetry(
      () => provider.connect({ externalId, kind }),
      {
        attempts: 3,
        baseDelayMs: 50,
        maxDelayMs: 500,
        shouldRetry: (error) => error instanceof ProviderTransientError,
        onRetry: (attempt, error, delayMs) => {
          metrics.inc("connect_provider_retries_total");
          logger.warn("provider retry", { provider: providerName, attempt, delayMs, error: String(error) });
        },
      },
    ));
    metrics.inc("connect_provider_calls_total");
    return this.repository.createDevice(providerName, externalId, kind, state);
  }

  async executeCommand(commandId: string, deviceId: string, type: CommandType): Promise<void> {
    const device = await this.repository.getDevice(deviceId);
    if (!device) {
      await this.repository.markCommand(commandId, "dead_letter", "device_not_found");
      return;
    }

    const provider = getProvider(device.provider);
    const circuit = circuitFor(device.provider);

    try {
      await circuit.execute(() => withRetry(
        () => provider.sendCommand(device.externalId, type),
        {
          attempts: 3,
          baseDelayMs: 100,
          maxDelayMs: 1000,
          shouldRetry: (error) => error instanceof ProviderTransientError,
          onRetry: (attempt, error, delayMs) => {
            metrics.inc("connect_provider_retries_total");
            logger.warn("command retry", { commandId, provider: device.provider, attempt, delayMs, error: String(error) });
          },
        },
      ));
      const state = await provider.getState(device.externalId);
      await this.repository.refreshDeviceState(device.id, state);
      await this.repository.markCommand(commandId, "succeeded", null);
      metrics.inc("connect_commands_succeeded_total");
    } catch (error) {
      metrics.inc("connect_provider_failures_total");
      const permanent = error instanceof ProviderPermanentError || String(error).includes("circuit_open");
      await this.repository.markCommand(commandId, permanent ? "dead_letter" : "failed", String(error));
      logger.error("command failed", { commandId, deviceId, provider: device.provider, circuitState: circuit.state, error: String(error) });
    }
  }
}
