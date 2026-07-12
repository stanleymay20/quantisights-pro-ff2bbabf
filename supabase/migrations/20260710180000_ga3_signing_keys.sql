-- ============================================
-- GA-3: Cryptographic Signing Key Metadata
--
-- Durable storage for signing-key METADATA and PUBLIC key material only.
-- This table never stores a raw private key. `private_key_reference` is a
-- nullable opaque reference (e.g. a Supabase Vault secret name or a KMS/HSM
-- key ARN) for a future production key provider to resolve private
-- signing material through — it is never itself private key bytes, and no
-- code in this repository writes signing bytes into it as of GA-3. Until a
-- real KMS/Vault-backed provider exists, rows are written by
-- InMemoryKeyProvider/EnvironmentKeyProvider-adjacent tooling only for
-- verification-key durability, never as a production signing source.
--
-- Pure runtime/security infrastructure: written exclusively by the
-- service-role runtime, never directly by end users. RLS is enabled with
-- no policies (deny-all for anon/authenticated; service_role bypasses RLS).
-- ============================================
CREATE TABLE public.signing_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_id text NOT NULL UNIQUE,
  purpose text NOT NULL CHECK (purpose IN ('decision_token', 'runtime_acknowledgement', 'evidence_pack', 'audit_manifest')),
  algorithm text NOT NULL CHECK (algorithm = 'Ed25519'),
  status text NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'RETIRED', 'REVOKED', 'EXPIRED')),
  -- Base64url-encoded SPKI public key. Never the private key.
  public_key text NOT NULL,
  -- Opaque reference to a future KMS/Vault secret holding the private key.
  -- Never populated with actual private key material.
  private_key_reference text,
  environment text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  activated_at timestamp with time zone,
  expires_at timestamp with time zone,
  retired_at timestamp with time zone,
  revoked_at timestamp with time zone,
  revocation_reason text,
  rotation_parent_key_id text REFERENCES public.signing_keys (key_id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Exactly one ACTIVE key per (purpose, environment).
CREATE UNIQUE INDEX idx_signing_keys_one_active_per_purpose_env
  ON public.signing_keys (purpose, environment)
  WHERE status = 'ACTIVE';

CREATE INDEX idx_signing_keys_purpose_env_status ON public.signing_keys (purpose, environment, status);
CREATE INDEX idx_signing_keys_rotation_parent ON public.signing_keys (rotation_parent_key_id);

ALTER TABLE public.signing_keys ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.signing_keys IS
  'GA-3 signing key metadata and PUBLIC key material only. private_key_reference is an opaque pointer to a future KMS/Vault secret and is never populated with raw private key bytes by any code in this repository as of GA-3.';
