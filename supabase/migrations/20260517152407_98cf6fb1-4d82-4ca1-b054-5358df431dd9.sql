ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS has_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS migration_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_reset_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

UPDATE public.players
SET has_password = true,
    migration_completed = true,
    password_reset_required = false,
    password_changed_at = COALESCE(password_changed_at, updated_at, created_at),
    updated_at = now()
WHERE user_id IS NOT NULL
  AND (has_password = false OR migration_completed = false OR password_reset_required = true);

CREATE OR REPLACE FUNCTION public.mark_password_auth_completed()
RETURNS players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player public.players;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Не авторизован';
  END IF;

  UPDATE public.players
    SET has_password = true,
        migration_completed = true,
        password_reset_required = false,
        password_changed_at = now(),
        last_login_at = now(),
        updated_at = now()
    WHERE user_id = v_uid
    RETURNING * INTO v_player;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Игрок не найден';
  END IF;

  RETURN v_player;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_password_auth_completed() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_password_login_seen()
RETURNS players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player public.players;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Не авторизован';
  END IF;

  UPDATE public.players
    SET has_password = true,
        migration_completed = true,
        last_login_at = now(),
        updated_at = now()
    WHERE user_id = v_uid
    RETURNING * INTO v_player;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Игрок не найден';
  END IF;

  RETURN v_player;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_password_login_seen() TO authenticated;