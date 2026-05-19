ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;