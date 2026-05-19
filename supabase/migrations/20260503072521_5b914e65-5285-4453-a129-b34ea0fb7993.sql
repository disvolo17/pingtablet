CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Игрок';

CREATE OR REPLACE FUNCTION public.register_player(_handle text, _name text, _pin text)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_player public.players;
BEGIN
  IF _handle IS NULL OR length(trim(_handle)) < 3 OR length(trim(_handle)) > 20 THEN
    RAISE EXCEPTION 'Никнейм должен быть от 3 до 20 символов';
  END IF;
  IF _handle !~ '^[a-zA-Z0-9_]+$' THEN
    RAISE EXCEPTION 'Никнейм может содержать только латинские буквы, цифры и _';
  END IF;
  IF _name IS NULL OR length(trim(_name)) < 1 OR length(trim(_name)) > 40 THEN
    RAISE EXCEPTION 'Имя обязательно';
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'PIN должен быть из 4 цифр';
  END IF;

  IF EXISTS (SELECT 1 FROM public.players WHERE lower(handle) = lower(trim(_handle))) THEN
    RAISE EXCEPTION 'Этот ник уже занят';
  END IF;

  INSERT INTO public.players (handle, name, pin_hash, rating, wins, losses, status)
  VALUES (
    lower(trim(_handle)),
    trim(_name),
    extensions.crypt(_pin, extensions.gen_salt('bf', 8)),
    1000,
    0,
    0,
    'Игрок'
  )
  RETURNING * INTO new_player;

  new_player.pin_hash := NULL;
  RETURN new_player;
END;
$function$;

CREATE OR REPLACE FUNCTION public.login_player(_handle text, _pin text)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  found public.players;
BEGIN
  SELECT * INTO found FROM public.players WHERE lower(handle) = lower(trim(_handle)) LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Игрок с таким ником не найден';
  END IF;
  IF found.pin_hash IS NULL OR found.pin_hash <> extensions.crypt(_pin, found.pin_hash) THEN
    RAISE EXCEPTION 'Неверный PIN';
  END IF;
  found.pin_hash := NULL;
  RETURN found;
END;
$function$;