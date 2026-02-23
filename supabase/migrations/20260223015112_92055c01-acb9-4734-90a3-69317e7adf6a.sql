
-- Copilot sessions table
CREATE TABLE public.copilot_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  role_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.copilot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view copilot sessions"
  ON public.copilot_sessions FOR SELECT
  USING (is_org_member(auth.uid(), organization_id) AND user_id = auth.uid());

CREATE POLICY "Org members can create copilot sessions"
  ON public.copilot_sessions FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id) AND user_id = auth.uid());

CREATE POLICY "Users can delete own copilot sessions"
  ON public.copilot_sessions FOR DELETE
  USING (user_id = auth.uid());

-- Copilot messages table
CREATE TABLE public.copilot_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.copilot_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  structured_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session messages"
  ON public.copilot_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.copilot_sessions s
    WHERE s.id = copilot_messages.session_id
    AND s.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own session messages"
  ON public.copilot_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.copilot_sessions s
    WHERE s.id = copilot_messages.session_id
    AND s.user_id = auth.uid()
  ));

-- Copilot usage tracking
CREATE TABLE public.copilot_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  call_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(organization_id, date)
);

ALTER TABLE public.copilot_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view copilot usage"
  ON public.copilot_usage FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

-- Auto-cleanup: delete messages older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_copilot_messages()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.copilot_sessions
  WHERE updated_at < now() - interval '30 days';
$$;

-- Indexes for performance
CREATE INDEX idx_copilot_sessions_org_user ON public.copilot_sessions(organization_id, user_id);
CREATE INDEX idx_copilot_messages_session ON public.copilot_messages(session_id);
CREATE INDEX idx_copilot_usage_org_date ON public.copilot_usage(organization_id, date);

-- Update timestamp trigger for sessions
CREATE TRIGGER update_copilot_sessions_updated_at
  BEFORE UPDATE ON public.copilot_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
