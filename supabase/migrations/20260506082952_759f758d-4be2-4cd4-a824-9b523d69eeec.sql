-- Add Telegram fields
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS telegram_username TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE public.players ALTER COLUMN pin_hash DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_players_telegram_id ON public.players(telegram_id);

-- Upsert by telegram_id. Generates a unique handle from username/first name if missing.
CREATE OR REPLACE FUNCTION public.telegram_upsert_player(
  _telegram_id BIGINT,
  _first_name TEXT,
  _last_name TEXT,
  _username TEXT,
  _photo_url TEXT
) RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  player_row public.players;
  base_handle TEXT;
  candidate TEXT;
  suffix INT := 0;
  full_name TEXT;
BEGIN
  IF _telegram_id IS NULL THEN
    RAISE EXCEPTION 'Не передан Telegram ID';
  END IF;

  full_name := trim(coalesce(_first_name, '') || ' ' || coalesce(_last_name, ''));
  IF full_name = '' THEN
    full_name := coalesce(_username, 'Игрок ' || _telegram_id::text);
  END IF;
  full_name := substring(full_name from 1 for 40);

  -- Existing player?
  SELECT * INTO player_row FROM public.players WHERE telegram_id = _telegram_id LIMIT 1;
  IF FOUND THEN
    UPDATE public.players
      SET name = full_name,
          telegram_username = NULLIF(_username, ''),
          photo_url = NULLIF(_photo_url, ''),
          avatar_url = COALESCE(avatar_url, NULLIF(_photo_url, '')),
          updated_at = now()
      WHERE id = player_row.id
      RETURNING * INTO player_row;
    player_row.pin_hash := NULL;
    RETURN player_row;
  END IF;

  -- Build handle base
  base_handle := lower(regexp_replace(coalesce(NULLIF(_username, ''), _first_name, 'player'), '[^a-zA-Z0-9_]', '', 'g'));
  IF base_handle IS NULL OR length(base_handle) < 3 THEN
    base_handle := 'player' || _telegram_id::text;
  END IF;
  base_handle := substring(base_handle from 1 for 16);

  candidate := base_handle;
  WHILE EXISTS(SELECT 1 FROM public.players WHERE lower(handle) = lower(candidate)) LOOP
    suffix := suffix + 1;
    candidate := substring(base_handle from 1 for 16) || suffix::text;
  END LOOP;

  INSERT INTO public.players (handle, name, telegram_id, telegram_username, photo_url, avatar_url, rating, wins, losses, status)
  VALUES (
    candidate,
    full_name,
    _telegram_id,
    NULLIF(_username, ''),
    NULLIF(_photo_url, ''),
    NULLIF(_photo_url, ''),
    1000, 0, 0, 'Игрок'
  ) RETURNING * INTO player_row;

  player_row.pin_hash := NULL;
  RETURN player_row;
END;
$$;