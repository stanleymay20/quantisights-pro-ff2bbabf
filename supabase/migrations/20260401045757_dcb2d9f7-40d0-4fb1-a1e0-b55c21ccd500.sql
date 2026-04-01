-- Use plpgsql to properly reference the extensions schema
CREATE OR REPLACE FUNCTION public.match_decision_embeddings(
  query_embedding text,
  match_threshold float,
  match_count int,
  filter_org_id uuid,
  filter_entity_types text[]
)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  content_text text,
  metadata jsonb,
  distance float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT
      de.entity_type,
      de.entity_id,
      de.content_text,
      de.metadata,
      (1 - (de.embedding <=> $1::extensions.vector(768)))::float AS distance
    FROM public.decision_embeddings de
    WHERE de.organization_id = $2
      AND de.entity_type = ANY($3)
      AND (1 - (de.embedding <=> $1::extensions.vector(768))) > $4
    ORDER BY de.embedding <=> $1::extensions.vector(768)
    LIMIT $5'
  )
  USING query_embedding, filter_org_id, filter_entity_types, match_threshold, match_count;
END;
$$;

-- Add unique constraint for upsert support
ALTER TABLE public.decision_embeddings
  ADD CONSTRAINT uq_decision_embeddings_entity
  UNIQUE (entity_type, entity_id);