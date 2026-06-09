/**
 * useCopilotTelemetry — Phase 5.5
 *
 * Logs every Copilot interaction to localStorage (client-side store)
 * until the copilot_queries Supabase table is provisioned.
 *
 * Tracks:
 *   - query text
 *   - detected intent (from simple keyword matching)
 *   - routed destination
 *   - timestamp
 *   - success (did the user proceed to the destination?)
 *
 * The /copilot/analytics page reads from this store to display
 * Gate 2 readiness metrics.
 *
 * Migration path: once copilot_queries table exists in Supabase,
 * swap the localStorage write for a supabase.from('copilot_queries').insert()
 * call. The hook interface does not change.
 */

import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";

export interface CopilotQueryEvent {
  id: string;
  userId: string | null;
  orgId: string | null;
  timestamp: string;
  query: string;
  detectedIntent: string;
  routedDestination: string;
  executionTimeMs: number;
  success: boolean;
  createdBriefId?: string | null;
}

// ─── Intent detection ─────────────────────────────────────────────────────────
const INTENT_PATTERNS: Array<{ intent: string; keywords: string[]; destination: string }> = [
  { intent: "view_decisions",       keywords: ["decision","approv","pending","ledger","review"],            destination: "/decisions" },
  { intent: "view_risks",           keywords: ["risk","threat","critical","danger","biggest risk"],         destination: "/executive-intelligence" },
  { intent: "run_forecast",         keywords: ["forecast","predict","next quarter","projection","revenue"], destination: "/forecasting" },
  { intent: "run_simulation",       keywords: ["simulat","what if","what-if","scenario","impact"],          destination: "/simulations" },
  { intent: "view_reports",         keywords: ["report","board","executive summary","brief"],               destination: "/reports" },
  { intent: "upload_data",          keywords: ["upload","csv","dataset","data","import"],                   destination: "/data-upload" },
  { intent: "view_governance",      keywords: ["govern","compliance","soc","iso","audit","gdpr"],           destination: "/governance" },
  { intent: "view_outcomes",        keywords: ["outcome","result","did it work","performance","accuracy"],  destination: "/outcomes" },
  { intent: "view_interventions",   keywords: ["intervention","alert","escalat","response"],                destination: "/interventions" },
  { intent: "view_lineage",         keywords: ["lineage","source","provenance","trace","where did"],        destination: "/lineage" },
  { intent: "view_trust",           keywords: ["trust","compliance","security","certif"],                   destination: "/trust-center" },
  { intent: "view_execution",       keywords: ["execut","action","stall","overdue","blocked"],              destination: "/execution" },
];

export function detectIntent(query: string): { intent: string; destination: string } {
  const lower = query.toLowerCase();
  for (const pattern of INTENT_PATTERNS) {
    if (pattern.keywords.some(k => lower.includes(k))) {
      return { intent: pattern.intent, destination: pattern.destination };
    }
  }
  return { intent: "unknown", destination: "/executive-intelligence" };
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "quantivis_copilot_queries";
const MAX_STORED = 500;

export function getCopilotQueryLog(): CopilotQueryEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function appendToLog(event: CopilotQueryEvent) {
  try {
    const existing = getCopilotQueryLog();
    const updated = [event, ...existing].slice(0, MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useCopilotTelemetry() {
  const { user } = useAuth();
  const { currentOrgId } = useOrganization();

  const logQuery = useCallback((
    query: string,
    routedDestination?: string,
    success: boolean = true,
    createdBriefId?: string | null,
  ): { intent: string; destination: string } => {
    const start = performance.now();
    const { intent, destination } = detectIntent(query);
    const finalDestination = routedDestination ?? destination;
    const executionTimeMs = Math.round(performance.now() - start);

    const event: CopilotQueryEvent = {
      id: `cq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: user?.id ?? null,
      orgId: currentOrgId ?? null,
      timestamp: new Date().toISOString(),
      query,
      detectedIntent: intent,
      routedDestination: finalDestination,
      executionTimeMs,
      success,
      createdBriefId: createdBriefId ?? null,
    };

    appendToLog(event);
    return { intent, destination: finalDestination };
  }, [user?.id, currentOrgId]);

  return { logQuery, detectIntent };
}
