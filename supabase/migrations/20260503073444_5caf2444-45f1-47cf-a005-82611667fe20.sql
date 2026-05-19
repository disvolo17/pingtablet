CREATE OR REPLACE FUNCTION public.login_player(_handle text, _pin text)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  player_row public.players;
BEGIN
  SELECT * INTO player_row FROM public.players WHERE lower(handle) = lower(trim(_handle)) LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Игрок с таким ником не найден';
  END IF;
  IF player_row.pin_hash IS NULL OR player_row.pin_hash <> extensions.crypt(_pin, player_row.pin_hash) THEN
    RAISE EXCEPTION 'Неверный PIN';
  END IF;
  player_row.pin_hash := NULL;
  RETURN player_row;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.login_player(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_player(text, text) TO service_role;