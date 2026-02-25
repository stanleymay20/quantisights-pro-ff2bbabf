
-- Team invitations table
CREATE TABLE public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role org_role NOT NULL DEFAULT 'viewer',
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  UNIQUE(organization_id, email, status)
);

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Only org admins/owners can see invitations
CREATE POLICY "Org admins can view invitations"
ON public.team_invitations FOR SELECT
USING (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

CREATE POLICY "Org admins can create invitations"
ON public.team_invitations FOR INSERT
WITH CHECK (
  get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
  AND invited_by = auth.uid()
);

CREATE POLICY "Org admins can update invitations"
ON public.team_invitations FOR UPDATE
USING (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

CREATE POLICY "Org admins can delete invitations"
ON public.team_invitations FOR DELETE
USING (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

-- Function to accept invitation by token
CREATE OR REPLACE FUNCTION public.accept_invitation(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
BEGIN
  SELECT * INTO inv FROM public.team_invitations
  WHERE token = _token AND status = 'pending' AND expires_at > now();
  
  IF inv IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired invitation');
  END IF;
  
  -- Check if user email matches
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != inv.email THEN
    RETURN jsonb_build_object('error', 'Email mismatch');
  END IF;
  
  -- Check if already a member
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = inv.organization_id AND user_id = auth.uid()) THEN
    UPDATE public.team_invitations SET status = 'accepted', accepted_at = now() WHERE id = inv.id;
    RETURN jsonb_build_object('success', true, 'message', 'Already a member');
  END IF;
  
  -- Add member
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (inv.organization_id, auth.uid(), inv.role);
  
  -- Update invitation
  UPDATE public.team_invitations SET status = 'accepted', accepted_at = now() WHERE id = inv.id;
  
  RETURN jsonb_build_object('success', true, 'organization_id', inv.organization_id);
END;
$$;
