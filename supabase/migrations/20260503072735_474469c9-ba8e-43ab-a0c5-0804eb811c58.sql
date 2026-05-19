CREATE OR REPLACE FUNCTION public.admin_set_player_pin(_player_id uuid, _pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _player_id IS NULL THEN
    RAISE EXCEPTION 'Не указан игрок';
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'PIN должен быть из 4 цифр';
  END IF;

  UPDATE public.players
  SET pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf', 8))
  WHERE id = _player_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Игрок не найден';
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_set_player_pin(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_player_pin(uuid, text) TO service_role;