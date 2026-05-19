-- Create public avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies: public read, open write (auth handled by RPC + custom PIN model)
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_public_insert" ON storage.objects;
CREATE POLICY "avatars_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_public_update" ON storage.objects;
CREATE POLICY "avatars_public_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_public_delete" ON storage.objects;
CREATE POLICY "avatars_public_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars');

-- RPC to set avatar with PIN verification
CREATE OR REPLACE FUNCTION public.set_player_avatar(_player_id uuid, _pin text, _avatar_url text)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  player_row public.players;
BEGIN
  SELECT * INTO player_row FROM public.players WHERE id = _player_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Игрок не найден';
  END IF;
  IF player_row.pin_hash IS NULL OR player_row.pin_hash <> extensions.crypt(_pin, player_row.pin_hash) THEN
    RAISE EXCEPTION 'Неверный PIN';
  END IF;

  UPDATE public.players
    SET avatar_url = NULLIF(_avatar_url, ''),
        updated_at = now()
    WHERE id = _player_id
    RETURNING * INTO player_row;

  player_row.pin_hash := NULL;
  RETURN player_row;
END;
$$;