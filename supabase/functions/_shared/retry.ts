/**
 * Retry utility with exponential backoff for edge functions.
 */

export interface RetryOptions {
  attempts?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
  retryOn?: (error: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { attempts = 3, backoffMs = 500, maxBackoffMs = 5000, retryOn } = opts;

  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (retryOn && !retryOn(err)) throw err;
      if (i < attempts - 1) {
        const delay = Math.min(backoffMs * Math.pow(2, i), maxBackoffMs);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
