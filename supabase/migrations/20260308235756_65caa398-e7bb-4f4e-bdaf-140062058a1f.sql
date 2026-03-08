-- Make profiles.organization_id NOT NULL
ALTER TABLE public.profiles
  ALTER COLUMN organization_id SET NOT NULL;

-- Change FK from SET NULL to CASCADE
ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_organization_id_fkey,
  ADD CONSTRAINT profiles_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;