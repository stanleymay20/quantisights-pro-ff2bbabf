/**
 * Centralized error reporting utility.
 * In production, this would forward to Sentry/Datadog/PagerDuty.
 * Currently logs structured errors to console + optional backend.
 */

import { supabase } from "@/integrations/supabase/client";

interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  context?: string;
  severity: "error" | "warning" | "fatal";
  metadata?: Record<string, unknown>;
}

const ERROR_QUEUE: ErrorReport[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Report an error to the monitoring pipeline */
export function reportError(report: ErrorReport): void {
  const enriched = {
    ...report,
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "unknown",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  };

  // Always log structured to console
  console.error(`[ErrorReporter:${report.severity}]`, enriched.message, enriched);

  // Queue for batch flush
  ERROR_QUEUE.push(report);

  // Debounced flush (don't spam backend)
  if (!flushTimer) {
    flushTimer = setTimeout(flushErrors, 5000);
  }
}

/** Flush queued errors to audit_log (best-effort) */
async function flushErrors(): Promise<void> {
  flushTimer = null;
  if (ERROR_QUEUE.length === 0) return;

  const batch = ERROR_QUEUE.splice(0, 10); // Max 10 per flush

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // Can't log without auth

    // Best-effort log to audit trail — don't block app
    for (const err of batch) {
      await supabase.from("audit_log").insert({
        organization_id: "00000000-0000-0000-0000-000000000000", // Will be overridden by RLS context
        action_type: "client_error",
        resource_type: "frontend",
        actor_type: "system",
        actor_id: session.user.id,
        payload: {
          message: err.message,
          severity: err.severity,
          context: err.context,
          stack: err.stack?.substring(0, 500),
          url: typeof window !== "undefined" ? window.location.href : undefined,
        } as Record<string, unknown>,
      }).then(() => {/* ignore result */});
    }
  } catch {
    // Silent — error reporting should never crash the app
  }
}

/** Global unhandled error listener */
export function installGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    reportError({
      message: event.message || "Unhandled error",
      stack: event.error?.stack,
      severity: "error",
      context: "window.onerror",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reportError({
      message: reason?.message || String(reason) || "Unhandled promise rejection",
      stack: reason?.stack,
      severity: "error",
      context: "unhandledrejection",
    });
  });
}
