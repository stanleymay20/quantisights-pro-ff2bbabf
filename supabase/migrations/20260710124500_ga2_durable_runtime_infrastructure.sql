-- ============================================
-- GA-2: Durable Runtime Infrastructure
--
-- Replaces the in-memory AG-3D (Runtime Queue), AG-3E (Runtime Persistence),
-- and AG-3C (Idempotency Store) adapters with durable Postgres-backed
-- storage. These tables are pure runtime infrastructure: they are written
-- exclusively by the service-role runtime (edge functions), never directly
-- by end users, so RLS is enabled with no policies (deny-all for anon and
-- authenticated roles; service_role bypasses RLS by default).
-- ============================================

-- ============================================
-- 1. Runtime Executions (AG-3E)
-- ============================================
CREATE TABLE public.runtime_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id text NOT NULL,
  correlation_id text NOT NULL,
  request_hash text NOT NULL,
  idempotency_key text NOT NULL,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  status text NOT NULL,
  runtime_version text NOT NULL,
  gateway_version text NOT NULL,
  schema_version text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error jsonb,
  execution_hash text NOT NULL,
  UNIQUE (tenant_id, execution_id)
);

CREATE INDEX idx_runtime_executions_tenant_status ON public.runtime_executions (tenant_id, status);
CREATE INDEX idx_runtime_executions_org ON public.runtime_executions (organization_id);
CREATE INDEX idx_runtime_executions_correlation ON public.runtime_executions (correlation_id);
CREATE INDEX idx_runtime_executions_completed_at ON public.runtime_executions (status, completed_at);

ALTER TABLE public.runtime_executions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Runtime Events (AG-3E) — append-only
-- ============================================
CREATE TABLE public.runtime_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL,
  execution_id text NOT NULL,
  correlation_id text NOT NULL,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  event_type text NOT NULL,
  sequence_number integer NOT NULL,
  occurred_at timestamp with time zone NOT NULL,
  payload_hash text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  runtime_version text NOT NULL,
  UNIQUE (tenant_id, execution_id, sequence_number)
);

CREATE INDEX idx_runtime_events_execution ON public.runtime_events (tenant_id, execution_id, sequence_number);

ALTER TABLE public.runtime_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Runtime Audit Records (AG-3E) — append-only, hash-chained
--
-- The (tenant_id, previous_audit_hash) uniqueness constraint plus the
-- partial "one root per tenant" index make the hash chain append-safe
-- under concurrent writers: only one record can ever chain from a given
-- previous hash, and only one record can ever be the first in a tenant's
-- chain. A concurrent writer racing to extend the same chain position
-- fails with a unique-violation instead of silently forking the chain.
-- ============================================
CREATE TABLE public.runtime_audit_records (
  seq bigserial NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id text NOT NULL,
  execution_id text NOT NULL,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  actor text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  occurred_at timestamp with time zone NOT NULL,
  audit_hash text NOT NULL,
  previous_audit_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, previous_audit_hash)
);

CREATE UNIQUE INDEX idx_runtime_audit_root_per_tenant ON public.runtime_audit_records (tenant_id) WHERE previous_audit_hash IS NULL;
CREATE INDEX idx_runtime_audit_tenant_seq ON public.runtime_audit_records (tenant_id, seq);
CREATE INDEX idx_runtime_audit_execution ON public.runtime_audit_records (execution_id);

ALTER TABLE public.runtime_audit_records ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. Runtime Queue Snapshots (AG-3E)
-- ============================================
CREATE TABLE public.runtime_queue_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id text NOT NULL,
  tenant_id text NOT NULL,
  captured_at timestamp with time zone NOT NULL,
  runtime_version text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot_hash text NOT NULL
);

CREATE INDEX idx_runtime_queue_snapshots_tenant_captured ON public.runtime_queue_snapshots (tenant_id, captured_at DESC);

ALTER TABLE public.runtime_queue_snapshots ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Runtime Queue Messages (AG-3D) — durable queue
--
-- visible_at implements a visibility timeout: when a message is claimed
-- (status -> PROCESSING) it is given a deadline. If the consumer crashes
-- before ack/retry/deadLetter, claim_runtime_queue_message() reclaims it
-- back to QUEUED once that deadline passes, giving crash recovery without
-- requiring the crashed consumer's cooperation.
-- ============================================
CREATE TABLE public.runtime_queue_messages (
  queue_message_id text NOT NULL PRIMARY KEY,
  correlation_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  payload_reference text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  available_at timestamp with time zone NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'QUEUED',
  priority integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone NOT NULL,
  visible_at timestamp with time zone,
  retry_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  failure_reason text,
  dead_letter_reason text,
  acked_at timestamp with time zone,
  completion_reason text
);

CREATE INDEX idx_runtime_queue_messages_claim ON public.runtime_queue_messages (status, priority DESC, created_at ASC)
  WHERE status IN ('QUEUED', 'RETRY');
CREATE INDEX idx_runtime_queue_messages_tenant ON public.runtime_queue_messages (tenant_id);
CREATE INDEX idx_runtime_queue_messages_visibility ON public.runtime_queue_messages (status, visible_at)
  WHERE status = 'PROCESSING';

ALTER TABLE public.runtime_queue_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. Runtime Idempotency Keys (AG-3C)
-- ============================================
CREATE TABLE public.runtime_idempotency_keys (
  idempotency_key text NOT NULL PRIMARY KEY,
  request_hash text NOT NULL,
  correlation_id text NOT NULL,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL,
  status text NOT NULL,
  gateway_version text NOT NULL,
  schema_version text NOT NULL,
  runtime_version text NOT NULL
);

CREATE INDEX idx_runtime_idempotency_hash ON public.runtime_idempotency_keys (request_hash);
CREATE INDEX idx_runtime_idempotency_tenant ON public.runtime_idempotency_keys (tenant_id, status);
CREATE INDEX idx_runtime_idempotency_expires ON public.runtime_idempotency_keys (expires_at);

ALTER TABLE public.runtime_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. Atomic queue claim (dequeue)
--
-- FOR UPDATE SKIP LOCKED lets multiple concurrent runtime workers safely
-- dequeue from the same table without racing on the same row — this is
-- not expressible through the plain PostgREST client, hence the RPC.
-- ============================================
CREATE OR REPLACE FUNCTION public.claim_runtime_queue_message(p_now timestamptz, p_visible_ms integer DEFAULT 30000)
RETURNS SETOF public.runtime_queue_messages
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id text;
BEGIN
  -- Crash recovery: a PROCESSING message whose visibility timeout elapsed
  -- was claimed by a worker that never acked/retried/dead-lettered it.
  UPDATE public.runtime_queue_messages
  SET status = 'QUEUED', visible_at = NULL
  WHERE status = 'PROCESSING' AND visible_at IS NOT NULL AND visible_at <= p_now;

  UPDATE public.runtime_queue_messages
  SET status = 'EXPIRED'
  WHERE status IN ('QUEUED', 'RETRY') AND expires_at <= p_now;

  SELECT queue_message_id INTO v_id
  FROM public.runtime_queue_messages
  WHERE status IN ('QUEUED', 'RETRY') AND available_at <= p_now AND expires_at > p_now
  ORDER BY priority DESC, created_at ASC, queue_message_id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.runtime_queue_messages
  SET status = 'PROCESSING',
      attempt_count = attempt_count + 1,
      visible_at = p_now + make_interval(secs => p_visible_ms / 1000.0)
  WHERE queue_message_id = v_id
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_runtime_queue_message(timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_runtime_queue_message(timestamptz, integer) TO service_role;

-- ============================================
-- 8. Maintenance sweep (visibility timeout + TTL expiry) for read paths
-- (peek / stats) that must not silently skip reclaimed/expired messages.
-- ============================================
CREATE OR REPLACE FUNCTION public.expire_runtime_queue_messages(p_now timestamptz)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH reclaimed AS (
    UPDATE public.runtime_queue_messages
    SET status = 'QUEUED', visible_at = NULL
    WHERE status = 'PROCESSING' AND visible_at IS NOT NULL AND visible_at <= p_now
    RETURNING 1
  ), expired AS (
    UPDATE public.runtime_queue_messages
    SET status = 'EXPIRED'
    WHERE status IN ('QUEUED', 'RETRY') AND expires_at <= p_now
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM reclaimed) + (SELECT count(*) FROM expired);
$$;

REVOKE ALL ON FUNCTION public.expire_runtime_queue_messages(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_runtime_queue_messages(timestamptz) TO service_role;
