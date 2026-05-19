-- Drop legacy PIN-based functions
DROP FUNCTION IF EXISTS public.register_player(text, text, text);
DROP FUNCTION IF EXISTS public.login_player(text, text);
DROP FUNCTION IF EXISTS public.admin_set_player_pin(uuid, text);
DROP FUNCTION IF EXISTS public.set_player_avatar(uuid, text, text);
DROP FUNCTION IF EXISTS public.set_player_handicap(uuid, text, integer);

-- Drop the PIN column
ALTER TABLE public.players DROP COLUMN IF EXISTS pin_hash;

-- Recreate helpers without PIN
CREATE OR REPLACE FUNCTION public.set_player_avatar(_player_id uuid, _avatar_url text)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  player_row public.players;
BEGIN
  UPDATE public.players
    SET avatar_url = NULLIF(_avatar_url, ''),
        updated_at = now()
    WHERE id = _player_id
    RETURNING * INTO player_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Игрок не найден';
  END IF;
  RETURN player_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_player_handicap(_player_id uuid, _handicap integer)
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
  UPDATE public.players
    SET handicap = _handicap,
        updated_at = now()
    WHERE id = _player_id
    RETURNING * INTO player_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Игрок не найден';
  END IF;
  RETURN player_row;
END;
$$;