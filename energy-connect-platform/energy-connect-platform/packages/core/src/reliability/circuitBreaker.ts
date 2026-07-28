export type CircuitState = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private failures = 0;
  private stateValue: CircuitState = "closed";
  private openedAt = 0;

  constructor(
    private readonly failureThreshold = 3,
    private readonly cooldownMs = 30_000,
  ) {}

  get state(): CircuitState {
    if (this.stateValue === "open" && Date.now() - this.openedAt >= this.cooldownMs) {
      this.stateValue = "half-open";
    }
    return this.stateValue;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") throw new Error("circuit_open");
    try {
      const result = await fn();
      this.failures = 0;
      this.stateValue = "closed";
      return result;
    } catch (error) {
      this.failures += 1;
      if (this.failures >= this.failureThreshold || this.stateValue === "half-open") {
        this.stateValue = "open";
        this.openedAt = Date.now();
      }
      throw error;
    }
  }
}
