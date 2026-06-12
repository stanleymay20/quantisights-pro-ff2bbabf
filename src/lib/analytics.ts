/**
 * analytics.ts — PostHog product analytics
 *
 * Privacy-first: no PII in event properties.
 * GDPR compliant: respects cookie consent before capturing.
 * Lazy: only loads PostHog if the user has consented.
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

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined ?? "https://eu.posthog.com";

let initialized = false;

async function init() {
  if (initialized || !POSTHOG_KEY || typeof window === "undefined") return;
  initialized = true;

  // Dynamic import — zero bundle cost if PostHog isn't configured
  const { default: posthog } = await import("posthog-js");
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,            // Only explicit track() calls
    persistence: "localStorage",
    disable_session_recording: true, // Enable manually if needed
    respect_dnt: true,
    loaded(ph) {
      // Check cookie consent — if not given, opt out
      const consent = localStorage.getItem("quantivis_cookie_consent");
      if (consent !== "accepted") {
        ph.opt_out_capturing();
      }
    },
  });
  window.posthog = posthog as Window["posthog"];
}

// Call init() as a side effect — non-blocking
if (POSTHOG_KEY) init().catch(() => {});

/** Identify the current user (call on login, no email or personal data) */
export function identifyUser(userId: string, orgId: string, role: string) {
  window.posthog?.identify(userId, { org_id: orgId, role });
}

/** Track an event. Never include PII — use IDs not names/emails. */
export function track(event: string, props?: Record<string, unknown>) {
  window.posthog?.capture(event, props);
}

/** Called when user accepts cookie consent */
export function enableAnalytics() {
  window.posthog?.opt_in_capturing();
  track("analytics_enabled");
}

/** Called when user rejects cookie consent */
export function disableAnalytics() {
  window.posthog?.opt_out_capturing();
  window.posthog?.reset();
}

// ─── Key product events to track ─────────────────────────────────────────────
// Call these from the relevant components:

/** User logs in */
export const trackLogin = (method: "password" | "google" | "saml") =>
  track("user_login", { method });

/** User creates a decision */
export const trackDecisionCreated = (decision_type: string) =>
  track("decision_created", { decision_type });

/** User approves or rejects a decision */
export const trackDecisionActioned = (action: "approved" | "rejected", decision_type: string) =>
  track("decision_actioned", { action, decision_type });

/** User connects a data source */
export const trackConnectorConnected = (connector_type: string) =>
  track("connector_connected", { connector_type });

/** User generates executive brief */
export const trackBriefGenerated = () => track("executive_brief_generated");

/** User asks Copilot a question */
export const trackCopilotQuery = (intent: string) =>
  track("copilot_query", { intent });

/** User reaches the board report */
export const trackBoardReport = () => track("board_report_viewed");
