const test = require("node:test");
const assert = require("node:assert/strict");
import { SimulatedEnergyProvider } from "../packages/core/src/integrations/simulatedProvider";

test("provider connects a vehicle and updates charging state", async () => {
  const provider = new SimulatedEnergyProvider("test-oem");
  const state = await provider.connect({ externalId: "EV-1", kind: "vehicle" });
  assert.equal(state.status, "online");
  assert.equal(state.charging, false);
  await provider.sendCommand("EV-1", "START_CHARGING");
  const updated = await provider.getState("EV-1");
  assert.equal(updated.charging, true);
});
