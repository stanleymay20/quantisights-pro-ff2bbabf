import { useRef, useCallback } from "react";

/**
 * Client-side rate limiter for auth forms.
 * Tracks attempts and enforces cooldown after maxAttempts.
 */
export const useAuthThrottle = (maxAttempts = 5, cooldownMs = 60_000) => {
  const attempts = useRef(0);
  const lockedUntil = useRef(0);

  const check = useCallback((): { allowed: boolean; waitSeconds: number } => {
    const now = Date.now();
    if (now < lockedUntil.current) {
      return { allowed: false, waitSeconds: Math.ceil((lockedUntil.current - now) / 1000) };
    }

    attempts.current += 1;
    if (attempts.current > maxAttempts) {
      lockedUntil.current = now + cooldownMs;
      attempts.current = 0;
      return { allowed: false, waitSeconds: Math.ceil(cooldownMs / 1000) };
    }

    return { allowed: true, waitSeconds: 0 };
  }, [maxAttempts, cooldownMs]);

  const reset = useCallback(() => {
    attempts.current = 0;
    lockedUntil.current = 0;
  }, []);

  return { check, reset };
};
