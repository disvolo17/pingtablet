
REVOKE EXECUTE ON FUNCTION public.admin_grant_achievement(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_achievement(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._player_current_win_streak(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._player_has_place(uuid, int) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._evaluate_after_match() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._evaluate_after_tournament() FROM anon, authenticated, public;
