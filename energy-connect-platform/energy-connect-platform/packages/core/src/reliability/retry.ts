import { sleep } from "../util";

export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable = options.shouldRetry ? options.shouldRetry(error) : true;
      if (!retryable || attempt === options.attempts) break;
      const delayMs = Math.min(options.maxDelayMs, options.baseDelayMs * (2 ** (attempt - 1)));
      options.onRetry?.(attempt, error, delayMs);
      await sleep(delayMs);
    }
  }
  throw lastError;
}
