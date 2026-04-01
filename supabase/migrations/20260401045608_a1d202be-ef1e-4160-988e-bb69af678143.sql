-- ═══════════════════════════════════════════════════════════════
-- FOUNDATION: Enable pgvector and create decision embeddings table
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Decision embeddings table — stores semantic representations of decisions,
-- outcomes, and insights for RAG retrieval
CREATE TABLE public.decision_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL, -- 'decision', 'outcome', 'insight', 'advisory'
  entity_id uuid NOT NULL,
  content_text text NOT NULL, -- the text that was embedded
  embedding extensions.vector(768) NOT NULL, -- Gemini embedding dimension
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast similarity search per org
CREATE INDEX idx_decision_embeddings_org ON public.decision_embeddings(organization_id);
CREATE INDEX idx_decision_embeddings_entity ON public.decision_embeddings(entity_type, entity_id);

-- HNSW index for fast vector similarity search (cosine distance)
CREATE INDEX idx_decision_embeddings_vector ON public.decision_embeddings
  USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

-- RLS
ALTER TABLE public.decision_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read embeddings"
ON public.decision_embeddings FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

-- No INSERT/UPDATE/DELETE for authenticated — service-role only via edge functions

-- ═══════════════════════════════════════════════════════════════
-- Outcome prediction scores — stores model predictions based on
-- historical decision-outcome pairs (not LLM guesses)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.outcome_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  decision_id uuid NOT NULL REFERENCES public.decision_ledger(id) ON DELETE CASCADE,
  predicted_success_probability numeric NOT NULL,
  similar_decisions_count integer NOT NULL DEFAULT 0,
  similar_decisions_avg_outcome numeric,
  similar_decisions_success_rate numeric,
  confidence_factors jsonb DEFAULT '[]'::jsonb,
  model_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_outcome_predictions_org ON public.outcome_predictions(organization_id);
CREATE INDEX idx_outcome_predictions_decision ON public.outcome_predictions(decision_id);

ALTER TABLE public.outcome_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read predictions"
ON public.outcome_predictions FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

-- Enable realtime for outcome_predictions
ALTER PUBLICATION supabase_realtime ADD TABLE public.outcome_predictions;