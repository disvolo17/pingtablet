-- Add unique handle, pin hash, and avatar to players
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text;

-- Backfill handle for existing players (lowercased name + short id) to keep uniqueness
UPDATE public.players
SET handle = lower(regexp_replace(coalesce(name,'player'), '[^a-zA-Z0-9]+', '', 'g')) || '_' || substr(id::text, 1, 4)
WHERE handle IS NULL;

-- Make handle required and unique (case-insensitive)
ALTER TABLE public.players ALTER COLUMN handle SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS players_handle_lower_unique ON public.players (lower(handle));

-- Validation: handle format 3-20 chars, alphanumeric + underscore
ALTER TABLE public.players
  ADD CONSTRAINT players_handle_format
  CHECK (handle ~ '^[a-zA-Z0-9_]{3,20}$');

-- Tighten insert policy: require handle and pin_hash, prevent direct manipulation
DROP POLICY IF EXISTS players_insert_anyone ON public.players;

-- Block direct inserts from clients; we go through register_player function
CREATE POLICY players_no_direct_insert ON public.players
  FOR INSERT TO public
  WITH CHECK (false);

-- Helper: secure register function (creates player with hashed PIN)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.register_player(
  _handle text,
  _name text,
  _pin text
) RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_player public.players;
BEGIN
  IF _handle IS NULL OR length(trim(_handle)) < 3 OR length(trim(_handle)) > 20 THEN
    RAISE EXCEPTION 'Никнейм должен быть от 3 до 20 символов';
  END IF;
  IF _handle !~ '^[a-zA-Z0-9_]+$' THEN
    RAISE EXCEPTION 'Никнейм может содержать только буквы, цифры и _';
  END IF;
  IF _name IS NULL OR length(trim(_name)) < 1 OR length(trim(_name)) > 40 THEN
    RAISE EXCEPTION 'Имя обязательно';
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'PIN должен быть из 4 цифр';
  END IF;

  IF EXISTS (SELECT 1 FROM public.players WHERE lower(handle) = lower(_handle)) THEN
    RAISE EXCEPTION 'Этот ник уже занят';
  END IF;

  INSERT INTO public.players (handle, name, pin_hash, rating, wins, losses)
  VALUES (
    _handle,
    trim(_name),
    crypt(_pin, gen_salt('bf', 8)),
    1000, 0, 0
  )
  RETURNING * INTO new_player;

  -- Don't leak hash back to client
  new_player.pin_hash := NULL;
  RETURN new_player;
END;
$$;

-- Login: verify handle + pin
CREATE OR REPLACE FUNCTION public.login_player(
  _handle text,
  _pin text
) RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found public.players;
BEGIN
  SELECT * INTO found FROM public.players WHERE lower(handle) = lower(_handle) LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Игрок с таким ником не найден';
  END IF;
  IF found.pin_hash IS NULL OR found.pin_hash <> crypt(_pin, found.pin_hash) THEN
    RAISE EXCEPTION 'Неверный PIN';
  END IF;
  found.pin_hash := NULL;
  RETURN found;
END;
$$;

-- Allow anyone to call these RPCs
GRANT EXECUTE ON FUNCTION public.register_player(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_player(text, text) TO anon, authenticated;

-- Hide pin_hash from default selects by revoking column read on it
REVOKE SELECT (pin_hash) ON public.players FROM anon, authenticated, public;