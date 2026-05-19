CREATE OR REPLACE FUNCTION public.ensure_my_player(_name text, _handle text DEFAULT NULL)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player public.players;
  v_base text;
  v_candidate text;
  v_suffix int := 0;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Не авторизован';
  END IF;

  v_name := NULLIF(trim(COALESCE(_name, '')), '');
  IF v_name IS NULL THEN v_name := 'Игрок'; END IF;
  v_name := substring(v_name from 1 for 40);

  SELECT * INTO v_player FROM public.players WHERE user_id = v_uid LIMIT 1;
  IF FOUND THEN
    UPDATE public.players
      SET name = v_name, updated_at = now()
      WHERE id = v_player.id
      RETURNING * INTO v_player;
    RETURN v_player;
  END IF;

  v_base := lower(regexp_replace(COALESCE(_handle, _name, 'player'), '[^a-zA-Z0-9_]', '', 'g'));
  IF v_base IS NULL OR length(v_base) < 3 THEN
    v_base := 'player' || substr(replace(v_uid::text, '-', ''), 1, 6);
  END IF;
  v_base := substring(v_base from 1 for 16);
  v_candidate := v_base;
  WHILE EXISTS (SELECT 1 FROM public.players WHERE lower(handle) = lower(v_candidate)) LOOP
    v_suffix := v_suffix + 1;
    v_candidate := substring(v_base from 1 for 14) || v_suffix::text;
  END LOOP;

  INSERT INTO public.players (user_id, handle, name, rating, status, wins, losses)
  VALUES (v_uid, v_candidate, v_name, 1000, 'Игрок', 0, 0)
  RETURNING * INTO v_player;

  RETURN v_player;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_player(text, text) TO authenticated;