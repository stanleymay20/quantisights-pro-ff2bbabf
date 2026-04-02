/**
 * similar-decisions — Retrieve similar past decisions using deterministic embeddings.
 * Returns similar decisions/outcomes with match quality tiers, rationale, and historical metadata.
 * 
 * v2: Adds match quality classification (strong/moderate/weak/none),
 *     keyword overlap analysis for match rationale, and domain category tagging.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, verifyOrgMembership } from "../_shared/auth-guard.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { generateEmbedding, searchSimilar } from "../_shared/embeddings.ts";

// ═══════════════════════════════════════════════════════
// MATCH QUALITY & RATIONALE
// ═══════════════════════════════════════════════════════

type MatchTier = "strong" | "moderate" | "weak";

const DOMAIN_CATEGORIES: Record<string, string[]> = {
  sales: ["sales", "revenue", "pipeline", "deal", "acv", "quota", "enterprise", "account", "ae", "booking"],
  retention: ["churn", "retention", "onboarding", "nps", "satisfaction", "renewal", "upsell", "expansion"],
  cost: ["cost", "infrastructure", "serverless", "migration", "optimization", "expense", "margin", "burn"],
  pricing: ["pricing", "tier", "price", "discount", "monetization", "arpu", "package"],
  risk: ["risk", "compliance", "threat", "vulnerability", "escalation", "audit", "governance"],
  growth: ["growth", "market", "expansion", "launch", "geographic", "product", "acquisition"],
  hr: ["employee", "compensation", "salary", "talent", "hiring", "team", "workforce", "recruiting"],
  operations: ["pipeline", "etl", "data", "engineering", "automation", "workflow", "integration"],
  finance: ["budget", "capital", "expenditure", "allocation", "forecast", "planning", "cashflow"],
  executive: ["board", "executive", "summary", "quarterly", "review", "reporting", "strategy"],
};

function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  const scores: [string, number][] = [];
  for (const [cat, keywords] of Object.entries(DOMAIN_CATEGORIES)) {
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > 0) scores.push([cat, score]);
  }
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0]?.[0] || "general";
}

function computeKeywordOverlap(query: string, match: string): string[] {
  const qWords = new Set(query.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(w => w.length > 3));
  const mWords = new Set(match.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(w => w.length > 3));
  return [...qWords].filter(w => mWords.has(w));
}

function classifyMatch(similarity: number, keywordOverlap: number, categoryMatch: boolean): MatchTier {
  if (similarity >= 0.55 && keywordOverlap >= 2) return "strong";
  if (similarity >= 0.45 && (keywordOverlap >= 1 || categoryMatch)) return "moderate";
  return "weak";
}

function buildMatchRationale(
  tier: MatchTier,
  similarity: number,
  overlappingKeywords: string[],
  queryCategory: string,
  matchCategory: string,
): string {
  const simPct = Math.round(similarity * 100);
  if (tier === "strong") {
    return `Strong match (${simPct}% similar) — shared keywords: ${overlappingKeywords.slice(0, 4).join(", ")}`;
  }
  if (tier === "moderate") {
    const reason = overlappingKeywords.length > 0
      ? `shared keywords: ${overlappingKeywords.slice(0, 3).join(", ")}`
      : queryCategory === matchCategory
        ? `same domain (${queryCategory})`
        : `related domain (${matchCategory})`;
    return `Moderate match (${simPct}%) — ${reason}`;
  }
  return `Weak match (${simPct}%) — limited overlap${queryCategory !== matchCategory ? `, different domain (${matchCategory} vs ${queryCategory})` : ""}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);
  const auth = await authenticateRequest(req);
  if (auth.response) return auth.response;

  try {
    const { organization_id, query_text } = await req.json();
    if (!organization_id || !query_text) {
      return new Response(JSON.stringify({ error: "organization_id and query_text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isMember = await verifyOrgMembership(auth.userId, organization_id);
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const queryEmbedding = await generateEmbedding(query_text);
    const queryCategory = detectCategory(query_text);

    // Use a lower floor to gather candidates, then classify quality
    const results = await searchSimilar(supabaseUrl, serviceKey, organization_id, queryEmbedding, {
      entityTypes: ["decision", "outcome", "insight", "advisory"],
      limit: 15,
      minSimilarity: 0.30,
    });

    // Enrich each result with match quality metadata
    const enriched = results.map(r => {
      const overlappingKeywords = computeKeywordOverlap(query_text, r.content_text);
      const matchCategory = detectCategory(r.content_text);
      const categoryMatch = queryCategory === matchCategory;
      const tier = classifyMatch(r.similarity, overlappingKeywords.length, categoryMatch);
      const rationale = buildMatchRationale(tier, r.similarity, overlappingKeywords, queryCategory, matchCategory);

      return {
        ...r,
        match_tier: tier,
        match_rationale: rationale,
        query_category: queryCategory,
        match_category: matchCategory,
        overlapping_keywords: overlappingKeywords,
      };
    });

    // Filter: only return strong + moderate by default; include weak only if no strong/moderate exist
    const strongOrModerate = enriched.filter(r => r.match_tier !== "weak");
    const finalResults = strongOrModerate.length > 0 ? strongOrModerate.slice(0, 10) : enriched.slice(0, 5);
    const hasStrongMatch = finalResults.some(r => r.match_tier === "strong");

    // Compute historical performance from outcomes (only from strong/moderate matches)
    const outcomes = finalResults.filter(r => r.entity_type === "outcome" && r.match_tier !== "weak");
    let historicalSuccessRate: number | null = null;
    let avgAccuracy: number | null = null;
    let confidenceAdjustment = 0;

    if (outcomes.length >= 2) {
      const successCount = outcomes.filter(r => {
        const delta = (r.metadata as any)?.outcome_delta;
        return delta != null && delta > 0;
      }).length;
      historicalSuccessRate = Math.round((successCount / outcomes.length) * 100);

      const accuracies = outcomes
        .map(r => (r.metadata as any)?.accuracy_score)
        .filter((a): a is number => a != null);
      if (accuracies.length > 0) {
        avgAccuracy = Math.round(accuracies.reduce((s, v) => s + v, 0) / accuracies.length);
        // Only adjust confidence if we have strong matches
        if (hasStrongMatch) {
          if (avgAccuracy < 50) confidenceAdjustment = -10;
          else if (avgAccuracy < 70) confidenceAdjustment = -5;
          else if (avgAccuracy > 85) confidenceAdjustment = 5;
        } else {
          // Weak evidence → halve any adjustment
          if (avgAccuracy < 50) confidenceAdjustment = -5;
          else if (avgAccuracy < 70) confidenceAdjustment = -2;
        }
      }
    }

    // Determine overall retrieval quality
    const retrievalQuality = hasStrongMatch
      ? "high"
      : strongOrModerate.length > 0
        ? "moderate"
        : finalResults.length > 0
          ? "low"
          : "none";

    return new Response(JSON.stringify({
      similar: finalResults,
      historical_success_rate: historicalSuccessRate,
      avg_accuracy: avgAccuracy,
      confidence_adjustment: confidenceAdjustment,
      retrieval_quality: retrievalQuality,
      query_category: queryCategory,
      match_summary: {
        total_candidates: results.length,
        strong: enriched.filter(r => r.match_tier === "strong").length,
        moderate: enriched.filter(r => r.match_tier === "moderate").length,
        weak: enriched.filter(r => r.match_tier === "weak").length,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
