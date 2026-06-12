/**
 * analytics.ts — PostHog product analytics
 *
 * Privacy-first: no PII in event properties.
 * GDPR compliant: respects cookie consent before capturing.
 * Graceful: build succeeds even if posthog-js is not yet installed.
 *   Add VITE_POSTHOG_KEY to env vars to activate.
 *
 * Usage:
 *   import { track } from "@/lib/analytics";
 *   track("decision_approved", { decision_type: "pricing" });
 */

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, props?: Record<string, unknown>) => void;
      identify: (id: string, traits?: Record<string, unknown>) => void;
      reset: () => void;
      opt_in_capturing: () => void;
      opt_out_capturing: () => void;
      has_opted_in_capturing: () => boolean;
    };
  }
}

const POSTHOG_KEY = (import.meta.env.VITE_POSTHOG_KEY ?? "") as string;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST ?? "https://eu.posthog.com") as string;

let initialized = false;

async function init() {
  if (initialized || !POSTHOG_KEY || typeof window === "undefined") return;
  initialized = true;
  try {
    // Dynamic import — only runs if VITE_POSTHOG_KEY is set AND posthog-js is installed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import("posthog-js" as any);
    const posthog = mod.default ?? mod;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
      persistence: "localStorage",
      disable_session_recording: true,
      respect_dnt: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loaded(ph: any) {
        const consent = localStorage.getItem("quantivis_cookie_consent");
        if (consent !== "accepted") ph.opt_out_capturing();
      },
    });
    window.posthog = posthog;
  } catch {
    // posthog-js not installed yet — analytics silently disabled
  }
}

if (POSTHOG_KEY) init().catch(() => {});

export function identifyUser(userId: string, orgId: string, role: string) {
  window.posthog?.identify(userId, { org_id: orgId, role });
}

export function track(event: string, props?: Record<string, unknown>) {
  window.posthog?.capture(event, props);
}

export function enableAnalytics() {
  window.posthog?.opt_in_capturing();
  track("analytics_enabled");
}

export function disableAnalytics() {
  window.posthog?.opt_out_capturing();
  window.posthog?.reset();
}

export const trackLogin = (method: "password" | "google" | "saml") =>
  track("user_login", { method });

export const trackDecisionCreated = (decision_type: string) =>
  track("decision_created", { decision_type });

export const trackDecisionActioned = (action: "approved" | "rejected", decision_type: string) =>
  track("decision_actioned", { action, decision_type });

export const trackConnectorConnected = (connector_type: string) =>
  track("connector_connected", { connector_type });

export const trackBriefGenerated = () => track("executive_brief_generated");

export const trackCopilotQuery = (intent: string) =>
  track("copilot_query", { intent });

export const trackBoardReport = () => track("board_report_viewed");
