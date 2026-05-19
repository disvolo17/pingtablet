
-- ============ PLAYERS ============
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE, -- nullable: linked to auth.users when google sign-in used
  name TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1000,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_players_rating ON public.players(rating DESC);
CREATE INDEX idx_players_user_id ON public.players(user_id);

-- ============ TOURNAMENTS ============
CREATE TYPE public.tournament_status AS ENUM ('registration', 'live', 'finished');

CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  starts_at TIMESTAMPTZ,
  description TEXT,
  status public.tournament_status NOT NULL DEFAULT 'registration',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tournaments_status ON public.tournaments(status);

-- ============ REGISTRATIONS ============
CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  seed INTEGER, -- assigned at bracket generation
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, player_id)
);
CREATE INDEX idx_registrations_tournament ON public.registrations(tournament_id);

-- ============ MATCHES ============
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,            -- 1 = first round, 2 = next, ...
  position INTEGER NOT NULL,         -- 0..n within the round
  player1_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  player2_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  is_bye BOOLEAN NOT NULL DEFAULT false,
  rating_applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, round, position)
);
CREATE INDEX idx_matches_tournament ON public.matches(tournament_id);

-- ============ MESSAGES (chat) ============
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_tournament ON public.messages(tournament_id, created_at);

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_players_touch BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_tournaments_touch BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_matches_touch BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ ENABLE RLS ============
ALTER TABLE public.players       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
-- Public read on everything (this is a public tournament app, viewers don't need accounts)
CREATE POLICY "players_select_all"     ON public.players       FOR SELECT USING (true);
CREATE POLICY "tournaments_select_all" ON public.tournaments   FOR SELECT USING (true);
CREATE POLICY "registrations_select_all" ON public.registrations FOR SELECT USING (true);
CREATE POLICY "matches_select_all"     ON public.matches       FOR SELECT USING (true);
CREATE POLICY "messages_select_all"    ON public.messages      FOR SELECT USING (true);

-- Players: anyone may create/update their own player row.
-- name <= 40 chars, rating updates only allowed by service role (handled server-side).
CREATE POLICY "players_insert_anyone" ON public.players
  FOR INSERT WITH CHECK (
    char_length(trim(name)) BETWEEN 1 AND 40
    AND rating = 1000 AND wins = 0 AND losses = 0
  );

-- Allow a player to rename themselves only when linked via user_id (google sign-in)
CREATE POLICY "players_update_self" ON public.players
  FOR UPDATE USING (user_id IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (user_id IS NOT NULL AND auth.uid() = user_id);

-- Registrations: anyone with QR may register an existing player
CREATE POLICY "registrations_insert_anyone" ON public.registrations
  FOR INSERT WITH CHECK (true);

-- Messages: anyone may post to any tournament chat (open chat as requested)
CREATE POLICY "messages_insert_anyone" ON public.messages
  FOR INSERT WITH CHECK (
    char_length(trim(author_name)) BETWEEN 1 AND 40
    AND char_length(trim(content)) BETWEEN 1 AND 500
  );

-- Tournaments + matches: writes go through edge functions using service role.
-- (No INSERT/UPDATE/DELETE policies for anon → blocked by default RLS.)

-- ============ REALTIME ============
ALTER TABLE public.tournaments   REPLICA IDENTITY FULL;
ALTER TABLE public.registrations REPLICA IDENTITY FULL;
ALTER TABLE public.matches       REPLICA IDENTITY FULL;
ALTER TABLE public.messages      REPLICA IDENTITY FULL;
ALTER TABLE public.players       REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.registrations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
