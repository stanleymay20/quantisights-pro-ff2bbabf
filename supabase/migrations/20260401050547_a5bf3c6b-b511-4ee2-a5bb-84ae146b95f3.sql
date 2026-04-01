-- Fix is_dataset_workspace_member: dataset not found should DENY instead of ALLOW
CREATE OR REPLACE FUNCTION public.is_dataset_workspace_member(_user_id uuid, _dataset_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _dataset_id IS NULL THEN true
    ELSE COALESCE(
      (SELECT
        CASE
          WHEN d.workspace_id IS NULL THEN true
          ELSE EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = d.workspace_id
              AND wm.user_id = _user_id
          )
        END
      FROM public.datasets d WHERE d.id = _dataset_id),
      false  -- dataset not found = DENY (previously allowed)
    )
  END
$function$;