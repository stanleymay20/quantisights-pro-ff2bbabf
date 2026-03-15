
-- ==========================================================
-- Enterprise Auth Schema: auth_events, user_sessions, 
-- webauthn_credentials, scim_tokens, step_up_challenges
-- ==========================================================

-- 1. Auth Events - Structured auth event audit trail
CREATE TABLE public.auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  ip_address text,
  user_agent text,
  device_fingerprint text,
  metadata jsonb DEFAULT '{}'::jsonb,
  risk_score integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_events_user ON public.auth_events(user_id, created_at DESC);
CREATE INDEX idx_auth_events_org ON public.auth_events(organization_id, created_at DESC);
CREATE INDEX idx_auth_events_type ON public.auth_events(event_type, created_at DESC);

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

-- Admins/owners can read auth events for their org
CREATE POLICY "Admins can read auth events"
  ON public.auth_events FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- Service role inserts (edge functions)
CREATE POLICY "Service inserts auth events"
  ON public.auth_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2. User Sessions - Track active sessions with device info
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_token_hash text,
  ip_address text,
  user_agent text,
  device_name text,
  location_info jsonb,
  last_active_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  expires_at timestamptz
);

CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id, revoked_at NULLS FIRST);
CREATE INDEX idx_user_sessions_org ON public.user_sessions(organization_id);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can see their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all sessions in their org
CREATE POLICY "Admins can view org sessions"
  ON public.user_sessions FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- Users can insert their own sessions
CREATE POLICY "Users insert own sessions"
  ON public.user_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own sessions (for last_active_at)
CREATE POLICY "Users update own sessions"
  ON public.user_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Admins can revoke sessions in their org
CREATE POLICY "Admins can revoke org sessions"
  ON public.user_sessions FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- 3. WebAuthn Credentials - FIDO2 passkey storage
CREATE TABLE public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  sign_count bigint DEFAULT 0,
  device_name text NOT NULL DEFAULT 'Security Key',
  transports jsonb,
  aaguid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX idx_webauthn_user ON public.webauthn_credentials(user_id);
CREATE INDEX idx_webauthn_credential ON public.webauthn_credentials(credential_id);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own webauthn credentials"
  ON public.webauthn_credentials FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. WebAuthn Challenges - Temporary challenge storage
CREATE TABLE public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge text NOT NULL,
  ceremony_type text NOT NULL, -- 'registration' or 'authentication'
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  used_at timestamptz
);

CREATE INDEX idx_webauthn_challenges_user ON public.webauthn_challenges(user_id, expires_at);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own challenges"
  ON public.webauthn_challenges FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. SCIM Tokens - Bearer tokens for IdP SCIM provisioning
CREATE TABLE public.scim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  description text DEFAULT 'SCIM Token',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX idx_scim_tokens_org ON public.scim_tokens(organization_id);

ALTER TABLE public.scim_tokens ENABLE ROW LEVEL SECURITY;

-- Only owners can manage SCIM tokens
CREATE POLICY "Owners manage SCIM tokens"
  ON public.scim_tokens FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- 6. Step-up Auth Challenges - Short-lived re-auth verification
CREATE TABLE public.step_up_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  verified_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_step_up_user ON public.step_up_challenges(user_id, expires_at);

ALTER TABLE public.step_up_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own step-up challenges"
  ON public.step_up_challenges FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 7. Immutability: prevent deletion/update of auth_events (audit trail)
CREATE POLICY "No deletes on auth events"
  ON public.auth_events FOR DELETE TO authenticated
  USING (false);

CREATE POLICY "No updates on auth events"
  ON public.auth_events FOR UPDATE TO authenticated
  USING (false);
