ALTER TABLE public.datasets 
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS steward_user_id uuid;

COMMENT ON COLUMN public.datasets.owner_user_id IS 'Business owner of the dataset — may differ from uploader';
COMMENT ON COLUMN public.datasets.steward_user_id IS 'Data steward responsible for quality and governance of this dataset';

-- Default: backfill owner_user_id from uploaded_by for existing rows
UPDATE public.datasets SET owner_user_id = uploaded_by WHERE owner_user_id IS NULL;