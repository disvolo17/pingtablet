// Bridge between Supabase Auth (email/password) and our `players` table.
import { supabase } from "@/integrations/supabase/client";
import { setCurrentPlayer, type CurrentPlayer } from "@/lib/currentPlayer";

type PlayerRow = {
  id: string;
  handle: string;
  name: string;
  rating: number | null;
  avatar_url: string | null;
  status: string | null;
};

async function markPasswordLoginSeen(): Promise<void> {
  const rpc = supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  const { error } = await rpc("mark_password_login_seen");
  if (error) console.warn("mark_password_login_seen failed", error.message);
}

export async function markPasswordAuthCompleted(): Promise<void> {
  const rpc = supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  const { error } = await rpc("mark_password_auth_completed");
  if (error) throw new Error(error.message);
}

function toCurrent(p: PlayerRow): CurrentPlayer {
  return {
    id: p.id,
    handle: p.handle,
    name: p.name,
    rating: p.rating ?? 1000,
    avatar_url: p.avatar_url,
    status: p.status,
  };
}

/** Ensure a `players` row exists for the signed-in user and persist it as current player. */
export async function syncCurrentPlayerFromSession(fallbackName?: string): Promise<CurrentPlayer | null> {
  const { data: sess } = await supabase.auth.getSession();
  const user = sess.session?.user;
  if (!user) {
    setCurrentPlayer(null);
    return null;
  }

  // Try fast path: lookup existing player.
  const { data: existing } = await supabase
    .from("players")
    .select("id, handle, name, rating, avatar_url, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await markPasswordLoginSeen();
    const cp = toCurrent(existing as PlayerRow);
    setCurrentPlayer(cp);
    return cp;
  }

  // Otherwise create via RPC (safe handle generation server-side).
  const name =
    fallbackName ??
    (user.user_metadata?.name as string | undefined) ??
    (user.email ? user.email.split("@")[0] : "Игрок");

  const { data: created, error } = await supabase.rpc("ensure_my_player", {
    _name: name,
    _handle: null,
  });
  if (error) throw new Error(error.message);
  const cp = toCurrent(created as unknown as PlayerRow);
  setCurrentPlayer(cp);
  return cp;
}

export async function signOutEverywhere() {
  await supabase.auth.signOut();
  setCurrentPlayer(null);
}
