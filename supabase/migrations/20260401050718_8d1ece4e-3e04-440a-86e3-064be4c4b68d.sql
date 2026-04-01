-- Fix auth_events: restrict INSERT to service-role only (drop authenticated INSERT)
DROP POLICY IF EXISTS "Service inserts auth events" ON public.auth_events;
-- No new INSERT policy for authenticated = service-role only can insert (bypasses RLS)

-- Fix orchestration_runs: change SELECT from 'public' to 'authenticated', add write policies
DROP POLICY IF EXISTS "Org admins can view orchestration runs" ON public.orchestration_runs;

CREATE POLICY "Org admins can view orchestration runs" ON public.orchestration_runs
  FOR SELECT TO authenticated
  USING (get_user_org_role(auth.uid(), organization_id) IN ('owner', 'admin'));

-- No INSERT/UPDATE/DELETE for authenticated users = service-role only writes

-- Fix profiles: consolidate membership check to is_org_member
DROP POLICY IF EXISTS "Users in same org can view profiles" ON public.profiles;

CREATE POLICY "Users in same org can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));