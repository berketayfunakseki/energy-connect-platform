export function randomId(prefix: string): string {
  const seed = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${seed}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function nowIso(): string {
  return new Date().toISOString();
}
