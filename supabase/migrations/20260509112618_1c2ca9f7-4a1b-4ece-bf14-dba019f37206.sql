
-- 1. Tournaments: location_kind
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS location_kind text;

-- 2. achievements catalog
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🏓',
  condition_type text NOT NULL DEFAULT 'manual',
  condition_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  rarity text NOT NULL DEFAULT 'common',
  glow_color text NOT NULL DEFAULT '0 0% 50%',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER achievements_touch BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY achievements_select_all ON public.achievements FOR SELECT USING (true);
-- INSERT/UPDATE/DELETE: only via service-role / SECURITY DEFINER (no policies → denied)

-- 3. user_achievements
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  progress int NOT NULL DEFAULT 0,
  UNIQUE (player_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS user_achievements_player_idx ON public.user_achievements(player_id);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_achievements_select_all ON public.user_achievements FOR SELECT USING (true);
-- Mutations only via SECURITY DEFINER functions / service role.

-- 4. Realtime
ALTER TABLE public.achievements REPLICA IDENTITY FULL;
ALTER TABLE public.user_achievements REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'achievements';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.achievements';
  END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_achievements';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_achievements';
  END IF;
END $$;

-- 5. Helper: longest current trailing win streak for a player
CREATE OR REPLACE FUNCTION public._player_current_win_streak(_player_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ordered AS (
    SELECT
      m.created_at,
      (m.winner_id = _player_id) AS won
    FROM public.matches m
    WHERE m.is_bye = false
      AND m.winner_id IS NOT NULL
      AND (m.player1_id = _player_id OR m.player2_id = _player_id)
    ORDER BY m.created_at DESC
  ),
  marked AS (
    SELECT won, ROW_NUMBER() OVER () AS rn FROM ordered
  )
  SELECT COALESCE(
    (SELECT rn - 1 FROM marked WHERE NOT won ORDER BY rn LIMIT 1),
    (SELECT COUNT(*)::int FROM marked)
  );
$$;

-- 6. Helper: did the player finish in a given place in any finished tournament?
-- place 1: winner of final (round = max round of that tournament, position 0)
-- place 2: loser of final
-- place 3: loser of semifinal (round = max - 1)
CREATE OR REPLACE FUNCTION public._player_has_place(_player_id uuid, _place int)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found boolean := false;
BEGIN
  IF _place = 1 THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.tournaments t
      JOIN public.matches m ON m.tournament_id = t.id
      WHERE t.status = 'finished'
        AND m.round = (SELECT MAX(round) FROM public.matches WHERE tournament_id = t.id)
        AND m.position = 0
        AND m.winner_id = _player_id
    ) INTO found;
  ELSIF _place = 2 THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.tournaments t
      JOIN public.matches m ON m.tournament_id = t.id
      WHERE t.status = 'finished'
        AND m.round = (SELECT MAX(round) FROM public.matches WHERE tournament_id = t.id)
        AND m.position = 0
        AND m.is_bye = false
        AND m.winner_id IS NOT NULL
        AND m.winner_id <> _player_id
        AND (_player_id IN (m.player1_id, m.player2_id))
    ) INTO found;
  ELSIF _place = 3 THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.tournaments t
      JOIN public.matches m ON m.tournament_id = t.id
      WHERE t.status = 'finished'
        AND m.round = (SELECT MAX(round) FROM public.matches WHERE tournament_id = t.id) - 1
        AND m.is_bye = false
        AND m.winner_id IS NOT NULL
        AND m.winner_id <> _player_id
        AND (_player_id IN (m.player1_id, m.player2_id))
    ) INTO found;
  END IF;
  RETURN found;
END;
$$;

-- 7. Main evaluator
CREATE OR REPLACE FUNCTION public.evaluate_player_achievements(_player_id uuid)
RETURNS SETOF public.achievements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ach RECORD;
  cv jsonb;
  ok boolean;
  n int;
  pl_rating int;
  newly uuid[] := ARRAY[]::uuid[];
  matches_today int;
  tour_count int;
  tour_won_total int;
  consec_won int;
  loc_count int;
  loc_kind text;
BEGIN
  IF _player_id IS NULL THEN RETURN; END IF;

  SELECT rating INTO pl_rating FROM public.players WHERE id = _player_id;
  IF NOT FOUND THEN RETURN; END IF;

  FOR ach IN
    SELECT a.* FROM public.achievements a
    WHERE a.is_active
      AND NOT EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.player_id = _player_id AND ua.achievement_id = a.id)
  LOOP
    cv := COALESCE(ach.condition_value, '{}'::jsonb);
    ok := false;

    CASE ach.condition_type
      WHEN 'first_match' THEN
        SELECT EXISTS (
          SELECT 1 FROM public.matches m
          WHERE m.is_bye = false AND m.winner_id IS NOT NULL
            AND (m.player1_id = _player_id OR m.player2_id = _player_id)
        ) INTO ok;

      WHEN 'win_streak' THEN
        n := COALESCE((cv->>'n')::int, 3);
        SELECT public._player_current_win_streak(_player_id) >= n INTO ok;

      WHEN 'tournament_place' THEN
        n := COALESCE((cv->>'place')::int, 1);
        ok := public._player_has_place(_player_id, n);

      WHEN 'tournaments_count' THEN
        n := COALESCE((cv->>'n')::int, 1);
        SELECT COUNT(*) INTO tour_count FROM public.registrations WHERE player_id = _player_id;
        ok := tour_count >= n;

      WHEN 'tournaments_won_total' THEN
        n := COALESCE((cv->>'n')::int, 1);
        SELECT COUNT(*) INTO tour_won_total
          FROM public.tournaments t
          JOIN public.matches m ON m.tournament_id = t.id
          WHERE t.status = 'finished'
            AND m.round = (SELECT MAX(round) FROM public.matches WHERE tournament_id = t.id)
            AND m.position = 0
            AND m.winner_id = _player_id;
        ok := tour_won_total >= n;

      WHEN 'tournament_streak' THEN
        n := COALESCE((cv->>'n')::int, 3);
        -- Last N finished tournaments where player was registered, all won by player
        WITH last_t AS (
          SELECT t.id, t.created_at,
            EXISTS (
              SELECT 1 FROM public.matches m
              WHERE m.tournament_id = t.id
                AND m.round = (SELECT MAX(round) FROM public.matches WHERE tournament_id = t.id)
                AND m.position = 0 AND m.winner_id = _player_id
            ) AS won
          FROM public.tournaments t
          JOIN public.registrations r ON r.tournament_id = t.id AND r.player_id = _player_id
          WHERE t.status = 'finished'
          ORDER BY t.created_at DESC
          LIMIT n
        )
        SELECT COUNT(*) = n AND BOOL_AND(won) INTO ok FROM last_t;

      WHEN 'matches_per_day' THEN
        n := COALESCE((cv->>'n')::int, 6);
        SELECT MAX(c) INTO matches_today FROM (
          SELECT date_trunc('day', m.created_at) d, COUNT(*) c
          FROM public.matches m
          WHERE m.is_bye = false AND m.winner_id IS NOT NULL
            AND (m.player1_id = _player_id OR m.player2_id = _player_id)
          GROUP BY 1
        ) s;
        ok := COALESCE(matches_today, 0) >= n;

      WHEN 'locations_count' THEN
        n := COALESCE((cv->>'n')::int, 3);
        SELECT COUNT(DISTINCT NULLIF(LOWER(TRIM(t.location)), '')) INTO loc_count
          FROM public.registrations r
          JOIN public.tournaments t ON t.id = r.tournament_id
          WHERE r.player_id = _player_id AND t.location IS NOT NULL;
        ok := COALESCE(loc_count, 0) >= n;

      WHEN 'win_at_location_kind' THEN
        loc_kind := cv->>'kind';
        IF loc_kind IS NOT NULL THEN
          SELECT EXISTS (
            SELECT 1
            FROM public.tournaments t
            JOIN public.matches m ON m.tournament_id = t.id
            WHERE t.status = 'finished'
              AND t.location_kind = loc_kind
              AND m.round = (SELECT MAX(round) FROM public.matches WHERE tournament_id = t.id)
              AND m.position = 0
              AND m.winner_id = _player_id
          ) INTO ok;
        END IF;

      WHEN 'beat_higher_rated' THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.matches m
          JOIN public.players opp ON opp.id = (CASE WHEN m.player1_id = _player_id THEN m.player2_id ELSE m.player1_id END)
          WHERE m.is_bye = false
            AND m.winner_id = _player_id
            AND opp.rating > pl_rating
        ) INTO ok;

      WHEN 'rating_growth' THEN
        n := COALESCE((cv->>'n')::int, 100);
        ok := (pl_rating - 1000) >= n;

      ELSE
        ok := false; -- manual or unknown
    END CASE;

    IF ok THEN
      INSERT INTO public.user_achievements (player_id, achievement_id)
      VALUES (_player_id, ach.id)
      ON CONFLICT DO NOTHING;
      newly := array_append(newly, ach.id);
    END IF;
  END LOOP;

  RETURN QUERY SELECT a.* FROM public.achievements a WHERE a.id = ANY(newly);
END;
$$;

-- 8. Admin grant/revoke (called via service role from edge fn)
CREATE OR REPLACE FUNCTION public.admin_grant_achievement(_player_id uuid, _achievement_id uuid)
RETURNS public.user_achievements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.user_achievements;
BEGIN
  INSERT INTO public.user_achievements (player_id, achievement_id)
  VALUES (_player_id, _achievement_id)
  ON CONFLICT (player_id, achievement_id) DO UPDATE SET unlocked_at = public.user_achievements.unlocked_at
  RETURNING * INTO row;
  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_achievement(_player_id uuid, _achievement_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.user_achievements WHERE player_id = _player_id AND achievement_id = _achievement_id;
$$;

-- 9. Triggers: re-evaluate on relevant changes
CREATE OR REPLACE FUNCTION public._evaluate_after_match() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.winner_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.winner_id IS DISTINCT FROM OLD.winner_id) THEN
    IF NEW.player1_id IS NOT NULL THEN PERFORM public.evaluate_player_achievements(NEW.player1_id); END IF;
    IF NEW.player2_id IS NOT NULL THEN PERFORM public.evaluate_player_achievements(NEW.player2_id); END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS matches_evaluate_achievements ON public.matches;
CREATE TRIGGER matches_evaluate_achievements
AFTER INSERT OR UPDATE OF winner_id ON public.matches
FOR EACH ROW EXECUTE FUNCTION public._evaluate_after_match();

CREATE OR REPLACE FUNCTION public._evaluate_after_tournament() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec RECORD;
BEGIN
  IF NEW.status = 'finished' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    FOR rec IN SELECT player_id FROM public.registrations WHERE tournament_id = NEW.id LOOP
      PERFORM public.evaluate_player_achievements(rec.player_id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tournaments_evaluate_achievements ON public.tournaments;
CREATE TRIGGER tournaments_evaluate_achievements
AFTER INSERT OR UPDATE OF status ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public._evaluate_after_tournament();

-- 10. Seed 20 achievements (idempotent on code)
INSERT INTO public.achievements (code, title, description, icon, condition_type, condition_value, rarity, glow_color, sort_order)
VALUES
  ('first_match',         'Первый матч',          'Сыграй свой первый матч',                              '🏓', 'first_match',          '{}'::jsonb,                              'common',    '0 0% 50%',     10),
  ('streak_x3',           'Серия x3',             'Победи 3 раза подряд',                                  '🔥', 'win_streak',           '{"n":3}'::jsonb,                         'rare',      '20 95% 55%',   20),
  ('tournament_champion', 'Чемпион турнира',      'Займи 1 место в турнире',                              '👑', 'tournament_place',     '{"place":1}'::jsonb,                     'epic',      '45 95% 55%',   30),
  ('almost_champion',     'Почти чемпион',        'Займи 2 место',                                         '🥈', 'tournament_place',     '{"place":2}'::jsonb,                     'rare',      '210 10% 70%',  40),
  ('bronze_hero',         'Бронзовый герой',      'Займи 3 место',                                         '🥉', 'tournament_place',     '{"place":3}'::jsonb,                     'rare',      '30 60% 50%',   50),
  ('tactician',           'Тактик',               'Победи игрока выше тебя по рейтингу',                  '🧠', 'beat_higher_rated',    '{}'::jsonb,                              'rare',      '270 70% 60%',  60),
  ('rookie',              'Новичок в деле',       'Прими участие в первом турнире',                       '🚀', 'tournaments_count',    '{"n":1}'::jsonb,                         'common',    '200 80% 55%',  70),
  ('tournament_beast',    'Турнирный зверь',      'Сыграй в 10 турнирах',                                  '🏟', 'tournaments_count',    '{"n":10}'::jsonb,                        'epic',      '0 0% 30%',     80),
  ('ping_traveler',       'Пинг-путешественник',  'Сыграй турниры в 3 разных локациях',                   '🌍', 'locations_count',      '{"n":3}'::jsonb,                         'rare',      '160 70% 45%',  90),
  ('bar_champion',        'Барный чемпион',       'Выиграй турнир в баре',                                 '🍻', 'win_at_location_kind', '{"kind":"bar"}'::jsonb,                  'epic',      '40 95% 55%',  100),
  ('street_legend',       'Уличная легенда',      'Выиграй турнир на улице или в парке',                  '🌳', 'win_at_location_kind', '{"kind":"park"}'::jsonb,                 'epic',      '120 60% 40%', 110),
  ('favorite_killer',     'Убийца фаворитов',     'Выбей из турнира первого сеяного',                     '💀', 'manual',               '{}'::jsonb,                              'epic',      '0 80% 50%',   120),
  ('on_the_rise',         'На подъёме',           'Подними рейтинг на 100 очков',                          '📈', 'rating_growth',        '{"n":100}'::jsonb,                       'rare',      '140 70% 45%', 130),
  ('win_machine',         'Машина побед',         'Выиграй 10 матчей подряд',                              '😈', 'win_streak',           '{"n":10}'::jsonb,                        'legendary', '0 90% 55%',   140),
  ('vip_player',          'VIP игрок',            'Получи приглашение на закрытый турнир',                '🕶', 'manual',               '{}'::jsonb,                              'legendary', '280 80% 60%', 150),
  ('arena_legend',        'Легенда площадки',     'Выиграй 5 турниров',                                    '🌟', 'tournaments_won_total','{"n":5}'::jsonb,                         'legendary', '50 100% 55%', 160),
  ('absolute_champion',   'Абсолютный чемпион',   'Выиграй 3 турнира подряд',                              '🏆', 'tournament_streak',    '{"n":3}'::jsonb,                         'legendary', '40 95% 55%',  170),
  ('energy_drink',        'Энергетик',            'Сыграй 6 матчей за один день',                          '🧃', 'matches_per_day',      '{"n":6}'::jsonb,                         'rare',      '90 70% 45%',  180),
  ('dark_horse',          'Тёмная лошадка',       'Выиграй турнир с низким рейтингом',                    '🎭', 'manual',               '{}'::jsonb,                              'epic',      '260 50% 50%', 190),
  ('goat',                'GOAT',                 'Стань игроком №1 сезона',                              '🐐', 'manual',               '{}'::jsonb,                              'legendary', '45 100% 50%', 200)
ON CONFLICT (code) DO NOTHING;
