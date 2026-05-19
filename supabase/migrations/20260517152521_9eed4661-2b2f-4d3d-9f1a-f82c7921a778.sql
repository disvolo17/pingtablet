CREATE OR REPLACE FUNCTION public.telegram_upsert_player(_telegram_id bigint, _first_name text, _last_name text, _username text, _photo_url text)
RETURNS players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  SELECT * INTO player_row FROM public.players WHERE telegram_id = _telegram_id LIMIT 1;
  IF FOUND THEN
    UPDATE public.players
      SET name = full_name,
          telegram_username = NULLIF(_username, ''),
          photo_url = NULLIF(_photo_url, ''),
          avatar_url = COALESCE(avatar_url, NULLIF(_photo_url, '')),
          migration_completed = CASE WHEN has_password THEN true ELSE migration_completed END,
          password_reset_required = CASE WHEN has_password THEN false ELSE password_reset_required END,
          updated_at = now()
      WHERE id = player_row.id
      RETURNING * INTO player_row;
    player_row.pin_hash := NULL;
    RETURN player_row;
  END IF;

  base_handle := lower(regexp_replace(coalesce(NULLIF(_username, ''), _first_name, 'player'), '[^a-zA-Z0-9_]', '', 'g'));
  IF base_handle IS NOT NULL AND length(base_handle) >= 3 THEN
    base_handle := substring(base_handle from 1 for 16);
    SELECT * INTO player_row
    FROM public.players
    WHERE lower(handle) = lower(base_handle)
      AND telegram_id IS NULL
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.players
        SET telegram_id = _telegram_id,
            telegram_username = NULLIF(_username, ''),
            name = COALESCE(NULLIF(name, ''), full_name),
            photo_url = NULLIF(_photo_url, ''),
            avatar_url = COALESCE(avatar_url, NULLIF(_photo_url, '')),
            migration_completed = CASE WHEN has_password THEN true ELSE migration_completed END,
            password_reset_required = CASE WHEN has_password THEN false ELSE password_reset_required END,
            updated_at = now()
        WHERE id = player_row.id
        RETURNING * INTO player_row;
      player_row.pin_hash := NULL;
      RETURN player_row;
    END IF;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.ensure_my_player(_name text, _handle text DEFAULT NULL::text)
RETURNS players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      SET name = v_name,
          has_password = true,
          migration_completed = true,
          password_reset_required = false,
          last_login_at = now(),
          updated_at = now()
      WHERE id = v_player.id
      RETURNING * INTO v_player;
    RETURN v_player;
  END IF;

  v_base := lower(regexp_replace(COALESCE(_handle, _name, 'player'), '[^a-zA-Z0-9_]', '', 'g'));
  IF v_base IS NULL OR length(v_base) < 3 THEN
    v_base := 'player' || substr(replace(v_uid::text, '-', ''), 1, 6);
  END IF;
  v_base := substring(v_base from 1 for 16);

  SELECT * INTO v_player
  FROM public.players
  WHERE lower(handle) = lower(v_base)
    AND user_id IS NULL
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.players
      SET user_id = v_uid,
          name = COALESCE(NULLIF(name, ''), v_name),
          has_password = true,
          migration_completed = true,
          password_reset_required = false,
          password_changed_at = COALESCE(password_changed_at, now()),
          last_login_at = now(),
          updated_at = now()
      WHERE id = v_player.id
      RETURNING * INTO v_player;
    RETURN v_player;
  END IF;

  v_candidate := v_base;
  WHILE EXISTS (SELECT 1 FROM public.players WHERE lower(handle) = lower(v_candidate)) LOOP
    v_suffix := v_suffix + 1;
    v_candidate := substring(v_base from 1 for 14) || v_suffix::text;
  END LOOP;

  INSERT INTO public.players (user_id, handle, name, rating, status, wins, losses, has_password, migration_completed, password_reset_required, password_changed_at, last_login_at)
  VALUES (v_uid, v_candidate, v_name, 1000, 'Игрок', 0, 0, true, true, false, now(), now())
  RETURNING * INTO v_player;

  RETURN v_player;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.telegram_upsert_player(bigint, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_my_player(text, text) TO authenticated;