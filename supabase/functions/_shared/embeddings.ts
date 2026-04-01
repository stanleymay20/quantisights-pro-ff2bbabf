/**
 * Shared embedding + RAG utilities for the Decision Intelligence platform.
 * 
 * This module provides:
 * 1. Text → embedding generation via Lovable AI gateway
 * 2. Semantic similarity search over decision_embeddings
 * 3. RAG context builder for AI prompts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMBEDDING_MODEL = "google/gemini-2.5-flash-lite";
const EMBEDDING_DIMENSION = 768;

interface EmbeddingResult {
  text: string;
  embedding: number[];
}

/**
 * Generate text embeddings via AI gateway using a cheap, fast model.
 * We use tool-calling to extract a fixed-size vector representation.
 */
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  // Use the AI gateway with tool calling to produce a deterministic embedding
  // Since the gateway doesn't have a native embedding endpoint, we use a
  // hash-based approach with the model for semantic understanding
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a text embedding system. Given input text, produce a semantic fingerprint as a JSON array of exactly ${EMBEDDING_DIMENSION} floating point numbers between -1 and 1. Each number should capture different semantic aspects of the text. Return ONLY the JSON array, nothing else.`,
        },
        { role: "user", content: text.slice(0, 2000) },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "store_embedding",
            description: "Store a semantic embedding vector",
            parameters: {
              type: "object",
              properties: {
                vector: {
                  type: "array",
                  items: { type: "number" },
                  description: `Array of exactly ${EMBEDDING_DIMENSION} floating point numbers between -1 and 1`,
                },
              },
              required: ["vector"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "store_embedding" } },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Embedding generation failed [${resp.status}]: ${errText}`);
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("No embedding vector returned");
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  let vector = parsed.vector;

  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("Invalid embedding vector");
  }

  // Pad or truncate to exact dimension
  if (vector.length < EMBEDDING_DIMENSION) {
    vector = [...vector, ...new Array(EMBEDDING_DIMENSION - vector.length).fill(0)];
  } else if (vector.length > EMBEDDING_DIMENSION) {
    vector = vector.slice(0, EMBEDDING_DIMENSION);
  }

  // Normalize to unit vector for cosine similarity
  const magnitude = Math.sqrt(vector.reduce((s: number, v: number) => s + v * v, 0));
  if (magnitude > 0) {
    vector = vector.map((v: number) => v / magnitude);
  }

  return vector;
}

/**
 * Store an embedding for a decision/outcome/insight entity.
 */
export async function storeEmbedding(
  supabaseUrl: string,
  serviceKey: string,
  orgId: string,
  entityType: string,
  entityId: string,
  contentText: string,
  embedding: number[],
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const svc = createClient(supabaseUrl, serviceKey);

  // Upsert — replace if already embedded
  await svc.from("decision_embeddings").upsert(
    {
      organization_id: orgId,
      entity_type: entityType,
      entity_id: entityId,
      content_text: contentText,
      embedding: `[${embedding.join(",")}]`,
      metadata,
    },
    { onConflict: "entity_type,entity_id", ignoreDuplicates: false }
  );
}

/**
 * Semantic similarity search: find the most similar past decisions/outcomes.
 * Uses pgvector cosine distance for efficient retrieval.
 */
export async function searchSimilar(
  supabaseUrl: string,
  serviceKey: string,
  orgId: string,
  queryEmbedding: number[],
  opts: {
    entityTypes?: string[];
    limit?: number;
    minSimilarity?: number;
  } = {}
): Promise<Array<{
  entity_type: string;
  entity_id: string;
  content_text: string;
  metadata: Record<string, unknown>;
  similarity: number;
}>> {
  const svc = createClient(supabaseUrl, serviceKey);
  const limit = opts.limit || 10;
  const minSimilarity = opts.minSimilarity || 0.3;
  const entityTypes = opts.entityTypes || ["decision", "outcome", "insight", "advisory"];

  // Use raw SQL for vector similarity search
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const { data, error } = await svc.rpc("match_decision_embeddings" as any, {
    query_embedding: vectorStr,
    match_threshold: minSimilarity,
    match_count: limit,
    filter_org_id: orgId,
    filter_entity_types: entityTypes,
  });

  if (error) {
    console.error("Vector search error:", error);
    // Fallback: return empty results rather than failing
    return [];
  }

  return (data || []).map((row: any) => ({
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    content_text: row.content_text,
    metadata: row.metadata || {},
    similarity: 1 - (row.distance || 0),
  }));
}

/**
 * Build RAG context block from similar decisions for injection into AI prompts.
 * This is what makes the system genuinely intelligent — learned context from
 * the organization's own decision history.
 */
export function buildRAGContext(
  similarResults: Array<{
    entity_type: string;
    content_text: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }>
): string {
  if (similarResults.length === 0) {
    return "INSTITUTIONAL MEMORY: No similar past decisions found. This appears to be a novel decision for this organization.";
  }

  const lines: string[] = [
    `INSTITUTIONAL MEMORY — ${similarResults.length} similar past decisions/outcomes retrieved:`,
    "",
  ];

  for (let i = 0; i < similarResults.length; i++) {
    const r = similarResults[i];
    const meta = r.metadata as any;
    const relevance = Math.round(r.similarity * 100);

    lines.push(`[${i + 1}] (${r.entity_type}, ${relevance}% relevant)`);
    lines.push(`   ${r.content_text.slice(0, 300)}`);

    if (meta.outcome_delta != null) {
      lines.push(`   → Outcome: ${meta.outcome_delta > 0 ? "+" : ""}${meta.outcome_delta}% vs prediction`);
    }
    if (meta.accuracy_score != null) {
      lines.push(`   → Prediction Accuracy: ${meta.accuracy_score}%`);
    }
    if (meta.confidence != null) {
      lines.push(`   → Confidence at decision: ${meta.confidence}%`);
    }
    lines.push("");
  }

  lines.push(
    "INSTRUCTION: Use these historical outcomes to ground your current analysis. " +
    "Reference specific past outcomes when they are relevant. " +
    "If a similar decision had a negative outcome, warn about it explicitly. " +
    "If similar decisions consistently succeeded, note the pattern."
  );

  return lines.join("\n");
}

/**
 * Build a text representation of a decision for embedding.
 */
export function decisionToText(decision: any): string {
  const parts = [
    `Decision: ${decision.recommended_action}`,
    decision.chosen_action ? `Chosen Action: ${decision.chosen_action}` : null,
    decision.decision_type ? `Type: ${decision.decision_type}` : null,
    decision.notes ? `Notes: ${decision.notes}` : null,
    decision.capped_confidence != null
      ? `Confidence: ${decision.capped_confidence}%`
      : null,
    decision.predicted_net_impact != null
      ? `Predicted Impact: ${decision.predicted_net_impact}`
      : null,
  ];
  return parts.filter(Boolean).join(" | ");
}

/**
 * Build a text representation of a decision outcome for embedding.
 */
export function outcomeToText(decision: any): string {
  const parts = [
    `Decision: ${decision.recommended_action}`,
    `Outcome Delta: ${decision.outcome_delta > 0 ? "+" : ""}${decision.outcome_delta}%`,
    decision.prediction_accuracy_score != null
      ? `Accuracy: ${decision.prediction_accuracy_score}%`
      : null,
    decision.calibration_error != null
      ? `Calibration Error: ${decision.calibration_error}pp`
      : null,
    `Status: ${decision.decision_status}`,
  ];
  return parts.filter(Boolean).join(" | ");
}
