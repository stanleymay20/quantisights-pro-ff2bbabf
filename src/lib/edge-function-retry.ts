/**
 * Client-side retry wrapper for supabase.functions.invoke()
 * Retries only on network/5xx errors with exponential backoff.
 */
import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/sentry";

interface InvokeOptions {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

interface RetryConfig {
  maxAttempts?: number;
  baseDelayMs?: number;
}

function isRetryable(error: unknown): boolean {
  if (!error) return false;
  const msg = String(error);
  // Retry on network failures and server errors only
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("fetch failed")) return true;
  if (msg.includes("5") && /5\d{2}/.test(msg)) return true;
  return false;
}

/**
 * Invoke an edge function with automatic retry for transient failures.
 * Does NOT retry 4xx (validation/auth) errors.
 */
export async function invokeWithRetry<T = unknown>(
  functionName: string,
  options?: InvokeOptions,
  retryConfig?: RetryConfig
): Promise<{ data: T | null; error: Error | null }> {
  const { maxAttempts = 3, baseDelayMs = 300 } = retryConfig ?? {};

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, options);

      if (error) {
        // Don't retry client errors
        if (!isRetryable(error.message)) {
          return { data: null, error: new Error(error.message) };
        }
        if (attempt < maxAttempts - 1) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        return { data: null, error: new Error(error.message) };
      }

      return { data: data as T, error: null };
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));

      if (!isRetryable(errorObj.message) || attempt >= maxAttempts - 1) {
        captureError(errorObj, {
          functionName,
          attempt: attempt + 1,
          context: "invokeWithRetry",
        });
        return { data: null, error: errorObj };
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return { data: null, error: new Error(`invokeWithRetry: exhausted ${maxAttempts} attempts for ${functionName}`) };
}
