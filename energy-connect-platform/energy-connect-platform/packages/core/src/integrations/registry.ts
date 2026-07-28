import { EnergyProvider } from "./provider";
import { SimulatedEnergyProvider } from "./simulatedProvider";

const providers = new Map<string, EnergyProvider>();
providers.set("volt-oem", new SimulatedEnergyProvider("volt-oem"));
providers.set("charge-oem", new SimulatedEnergyProvider("charge-oem"));

export function getProvider(name: string): EnergyProvider {
  const provider = providers.get(name);
  if (!provider) throw new Error(`unknown_provider:${name}`);
  return provider;
}

export function registerProvider(provider: EnergyProvider): void {
  providers.set(provider.name, provider);
}
