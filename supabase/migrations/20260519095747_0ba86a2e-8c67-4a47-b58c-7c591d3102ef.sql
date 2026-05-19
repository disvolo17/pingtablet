ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_players_is_guest ON public.players(is_guest);