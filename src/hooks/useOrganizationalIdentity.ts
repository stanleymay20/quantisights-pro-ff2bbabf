import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OrganizationalIdentity {
  id: string;
  organization_id: string;
  vision_statement: string | null;
  mission_statement: string | null;
  core_values: string[];
  strategic_priorities: string[];
  risk_appetite: "conservative" | "moderate" | "aggressive" | "visionary";
  innovation_posture: "defender" | "balanced" | "explorer" | "disruptor";
  decision_speed_preference: "deliberate" | "balanced" | "agile" | "rapid";
  stakeholder_orientation: "shareholder" | "balanced" | "stakeholder" | "community";
  decision_principles: string[];
  ethical_boundaries: string[];
  governance_model: "centralized" | "collaborative" | "delegated" | "consensus";
  competitive_position: string | null;
  regulatory_environment: string | null;
  market_stage: "startup" | "growth" | "mature" | "turnaround" | "decline";
  industry_context: string | null;
  key_stakeholders: StakeholderEntry[];
  updated_at: string;
}

export interface StakeholderEntry {
  name: string;
  role: string;
  influence: "high" | "medium" | "low";
  interest: "high" | "medium" | "low";
}

export interface IdentityUpdateInput {
  vision_statement?: string | null;
  mission_statement?: string | null;
  core_values?: string[];
  strategic_priorities?: string[];
  risk_appetite?: string;
  innovation_posture?: string;
  decision_speed_preference?: string;
  stakeholder_orientation?: string;
  decision_principles?: string[];
  ethical_boundaries?: string[];
  governance_model?: string;
  competitive_position?: string | null;
  regulatory_environment?: string | null;
  market_stage?: string;
  industry_context?: string | null;
  key_stakeholders?: StakeholderEntry[];
}

const DEFAULTS: Omit<OrganizationalIdentity, "id" | "organization_id" | "updated_at"> = {
  vision_statement: null,
  mission_statement: null,
  core_values: [],
  strategic_priorities: [],
  risk_appetite: "moderate",
  innovation_posture: "balanced",
  decision_speed_preference: "balanced",
  stakeholder_orientation: "balanced",
  decision_principles: [],
  ethical_boundaries: [],
  governance_model: "collaborative",
  competitive_position: null,
  regulatory_environment: null,
  market_stage: "growth",
  industry_context: null,
  key_stakeholders: [],
};

function parseIdentity(row: any): OrganizationalIdentity {
  return {
    id: row.id,
    organization_id: row.organization_id,
    vision_statement: row.vision_statement,
    mission_statement: row.mission_statement,
    core_values: Array.isArray(row.core_values) ? row.core_values : [],
    strategic_priorities: Array.isArray(row.strategic_priorities) ? row.strategic_priorities : [],
    risk_appetite: row.risk_appetite ?? "moderate",
    innovation_posture: row.innovation_posture ?? "balanced",
    decision_speed_preference: row.decision_speed_preference ?? "balanced",
    stakeholder_orientation: row.stakeholder_orientation ?? "balanced",
    decision_principles: Array.isArray(row.decision_principles) ? row.decision_principles : [],
    ethical_boundaries: Array.isArray(row.ethical_boundaries) ? row.ethical_boundaries : [],
    governance_model: row.governance_model ?? "collaborative",
    competitive_position: row.competitive_position,
    regulatory_environment: row.regulatory_environment,
    market_stage: row.market_stage ?? "growth",
    industry_context: row.industry_context,
    key_stakeholders: Array.isArray(row.key_stakeholders) ? row.key_stakeholders : [],
    updated_at: row.updated_at,
  };
}

export const useOrganizationalIdentity = (organizationId: string | null) => {
  const { user } = useAuth();
  const [identity, setIdentity] = useState<OrganizationalIdentity | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchIdentity = useCallback(async () => {
    if (!organizationId) {
      setIdentity(null);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("organizational_identity")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      console.error("Fetch org identity error:", error);
    }
    setIdentity(data ? parseIdentity(data) : null);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  const saveIdentity = useCallback(
    async (updates: IdentityUpdateInput) => {
      if (!organizationId || !user) throw new Error("Organization context required");
      setSaving(true);

      try {
        if (identity) {
          // Update existing
          const { error } = await (supabase as any)
            .from("organizational_identity")
            .update({ ...updates, updated_by: user.id })
            .eq("organization_id", organizationId);
          if (error) throw error;
        } else {
          // Insert new
          const { error } = await (supabase as any)
            .from("organizational_identity")
            .insert({
              organization_id: organizationId,
              ...updates,
              updated_by: user.id,
            });
          if (error) throw error;
        }
        await fetchIdentity();
      } finally {
        setSaving(false);
      }
    },
    [organizationId, user, identity, fetchIdentity]
  );

  /** Computed alignment score: how complete is the identity profile? */
  const completenessScore = identity
    ? computeCompleteness(identity)
    : 0;

  return { identity, loading, saving, saveIdentity, completenessScore, refresh: fetchIdentity };
};

function computeCompleteness(id: OrganizationalIdentity): number {
  const checks = [
    !!id.vision_statement,
    !!id.mission_statement,
    id.core_values.length > 0,
    id.strategic_priorities.length > 0,
    !!id.risk_appetite,
    id.decision_principles.length > 0,
    !!id.competitive_position,
    !!id.industry_context,
    id.key_stakeholders.length > 0,
    id.ethical_boundaries.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/**
 * Derives a mission-alignment relevance label for a decision.
 * Used by the decision engine to score alignment.
 */
export function assessMissionAlignment(
  identity: OrganizationalIdentity,
  decisionType: string,
  recommendation: string
): { score: number; alignment: string; factors: string[] } {
  const factors: string[] = [];
  let score = 50; // neutral baseline

  // Risk appetite alignment
  const riskMap: Record<string, string[]> = {
    conservative: ["risk_management", "cost_optimization", "retention_strategy"],
    moderate: ["operational_efficiency", "retention_strategy", "pricing_strategy"],
    aggressive: ["growth_strategy", "market_expansion", "investment_decision"],
    visionary: ["market_expansion", "growth_strategy", "investment_decision"],
  };
  if (riskMap[identity.risk_appetite]?.includes(decisionType)) {
    score += 15;
    factors.push(`Aligns with ${identity.risk_appetite} risk appetite`);
  }

  // Innovation posture alignment
  if (
    (identity.innovation_posture === "disruptor" || identity.innovation_posture === "explorer") &&
    (decisionType === "market_expansion" || decisionType === "growth_strategy")
  ) {
    score += 10;
    factors.push(`Matches ${identity.innovation_posture} innovation posture`);
  }

  // Values alignment — check if recommendation text mentions any core values
  const recLower = recommendation.toLowerCase();
  for (const value of identity.core_values) {
    if (recLower.includes(value.toLowerCase())) {
      score += 5;
      factors.push(`References core value: ${value}`);
    }
  }

  // Strategic priorities alignment
  for (const priority of identity.strategic_priorities) {
    if (recLower.includes(priority.toLowerCase())) {
      score += 10;
      factors.push(`Supports strategic priority: ${priority}`);
    }
  }

  // Ethical boundaries check
  for (const boundary of identity.ethical_boundaries) {
    if (recLower.includes(boundary.toLowerCase())) {
      score -= 20;
      factors.push(`⚠ Touches ethical boundary: ${boundary}`);
    }
  }

  // Decision principles alignment
  for (const principle of identity.decision_principles) {
    if (recLower.includes(principle.toLowerCase())) {
      score += 5;
      factors.push(`Upholds decision principle: ${principle}`);
    }
  }

  score = Math.max(0, Math.min(100, score));

  const alignment =
    score >= 75 ? "Strong alignment" :
    score >= 50 ? "Moderate alignment" :
    score >= 25 ? "Weak alignment" :
    "Misaligned";

  return { score, alignment, factors };
}
