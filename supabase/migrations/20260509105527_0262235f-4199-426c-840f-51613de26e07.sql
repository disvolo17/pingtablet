ALTER TABLE public.players ADD COLUMN IF NOT EXISTS handicap integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.set_player_handicap(_player_id uuid, _pin text, _handicap integer)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  player_row public.players;
BEGIN
  IF _handicap IS NULL OR _handicap < -50 OR _handicap > 50 THEN
    RAISE EXCEPTION 'Фора должна быть от -50 до 50';
  END IF;
  SELECT * INTO player_row FROM public.players WHERE id = _player_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Игрок не найден';
  END IF;
  IF player_row.pin_hash IS NULL OR player_row.pin_hash <> extensions.crypt(_pin, player_row.pin_hash) THEN
    RAISE EXCEPTION 'Неверный PIN';
  END IF;
  UPDATE public.players SET handicap = _handicap, updated_at = now()
    WHERE id = _player_id RETURNING * INTO player_row;
  player_row.pin_hash := NULL;
  RETURN player_row;
END;
$$;