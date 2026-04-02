/**
 * Sentry integration for enterprise-grade frontend observability.
 * 
 * To activate: set VITE_SENTRY_DSN in your environment.
 * Without a DSN, Sentry is a no-op — the app runs normally.
 */
import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || "";

export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.info("[Sentry] No DSN configured — running without external error monitoring.");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE || "production",
    release: `quantivis@${import.meta.env.VITE_APP_VERSION || "0.0.0"}`,

    // Performance
    tracesSampleRate: 0.1, // 10% of transactions
    replaysSessionSampleRate: 0.0, // Don't record sessions by default
    replaysOnErrorSampleRate: 1.0, // Record 100% of sessions with errors

    // Filtering
    ignoreErrors: [
      "ResizeObserver loop",
      "Non-Error promise rejection",
      "AbortError",
      /Loading chunk \d+ failed/,
    ],

    beforeSend(event) {
      // Strip PII from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((bc) => {
          if (bc.data?.url) {
            try {
              const url = new URL(bc.data.url as string);
              url.searchParams.delete("token");
              url.searchParams.delete("key");
              bc.data.url = url.toString();
            } catch { /* ignore */ }
          }
          return bc;
        });
      }
      return event;
    },

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });

  console.info("[Sentry] Initialized with DSN:", SENTRY_DSN.substring(0, 20) + "...");
}

/** Set user context after authentication */
export function setSentryUser(userId: string, email?: string, orgId?: string): void {
  if (!SENTRY_DSN) return;
  Sentry.setUser({ id: userId, email, });
  if (orgId) Sentry.setTag("organization_id", orgId);
}

/** Clear user on logout */
export function clearSentryUser(): void {
  if (!SENTRY_DSN) return;
  Sentry.setUser(null);
}

/** Capture a manual error with context */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error, { extra: context });
}

/** Add breadcrumb for important actions */
export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>): void {
  if (!SENTRY_DSN) return;
  Sentry.addBreadcrumb({ message, category, data, level: "info" });
}

export { Sentry };
