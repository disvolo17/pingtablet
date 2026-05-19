REVOKE EXECUTE ON FUNCTION public.register_player(text, text, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.login_player(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_player(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.login_player(text, text) TO service_role;

DROP POLICY IF EXISTS registrations_insert_anyone ON public.registrations;
CREATE POLICY registrations_insert_registered_player
ON public.registrations
FOR INSERT
TO public
WITH CHECK (
  EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id)
  AND EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = tournament_id
      AND t.status = 'registration'
  )
);