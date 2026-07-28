type Histogram = { values: number[] };

class MetricsRegistry {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, Histogram>();

  inc(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  set(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  observe(name: string, value: number): void {
    const histogram = this.histograms.get(name) ?? { values: [] };
    histogram.values.push(value);
    if (histogram.values.length > 5000) histogram.values.shift();
    this.histograms.set(name, histogram);
  }

  percentile(name: string, p: number): number {
    const values = [...(this.histograms.get(name)?.values ?? [])].sort((a, b) => a - b);
    if (!values.length) return 0;
    const index = Math.min(values.length - 1, Math.max(0, Math.ceil(p * values.length) - 1));
    return values[index];
  }

  getCounter(name: string): number { return this.counters.get(name) ?? 0; }
  getGauge(name: string): number { return this.gauges.get(name) ?? 0; }

  renderPrometheus(): string {
    const lines: string[] = [];
    for (const [name, value] of this.counters) lines.push(`${name} ${value}`);
    for (const [name, value] of this.gauges) lines.push(`${name} ${value}`);
    for (const [name] of this.histograms) {
      lines.push(`${name}_p50 ${this.percentile(name, 0.50)}`);
      lines.push(`${name}_p95 ${this.percentile(name, 0.95)}`);
      lines.push(`${name}_p99 ${this.percentile(name, 0.99)}`);
    }
    return `${lines.join("\n")}\n`;
  }
}

export const metrics = new MetricsRegistry();
