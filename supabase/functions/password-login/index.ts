// Secure nickname/password login bridge.
// Looks up the hidden auth email by player handle server-side, verifies the password,
// then returns a normal Supabase session without exposing emails or plaintext passwords.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type AuthMeta = Record<string, unknown> & {
  must_change_password?: boolean;
  password_reset_required?: boolean;
  has_password?: boolean;
  migration_completed?: boolean;
  password_reset_at?: string;
  password_changed_at?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Метод не поддерживается" });

  try {
    const body = await req.json().catch(() => ({}));
    const handle = String(body?.handle ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(handle)) return json(400, { error: "Неверный никнейм" });
    if (password.length < 6 || password.length > 72) return json(400, { error: "Неверный пароль" });

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const admin = createClient(url, serviceKey);
    const publicAuth = createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: player, error: playerErr } = await admin
      .from("players")
      .select("id, handle, name, rating, avatar_url, status, user_id, has_password, migration_completed, password_reset_required")
      .ilike("handle", handle)
      .maybeSingle();
    if (playerErr) throw playerErr;
    if (!player?.user_id) return json(401, { error: "Неверный никнейм или пароль" });

    const { data: authUser, error: userErr } = await admin.auth.admin.getUserById(player.user_id);
    if (userErr || !authUser.user?.email) return json(401, { error: "Неверный никнейм или пароль" });

    const { data: signIn, error: signInErr } = await publicAuth.auth.signInWithPassword({
      email: authUser.user.email,
      password,
    });
    if (signInErr || !signIn.session) return json(401, { error: "Неверный никнейм или пароль" });

    const meta = (authUser.user.user_metadata ?? {}) as AuthMeta;
    const resetAt = meta.password_reset_at ? Date.parse(meta.password_reset_at) : 0;
    const changedAt = meta.password_changed_at ? Date.parse(meta.password_changed_at) : 0;
    const completedAfterReset = !!changedAt && (!resetAt || changedAt >= resetAt);
    const resetStillRequired = player.password_reset_required === true && !completedAfterReset;

    const nextMeta: AuthMeta = {
      ...meta,
      has_password: true,
      migration_completed: true,
      password_reset_required: resetStillRequired,
      must_change_password: resetStillRequired,
    };

    if (!resetStillRequired && (meta.must_change_password || meta.password_reset_required || meta.has_password !== true || meta.migration_completed !== true)) {
      await admin.auth.admin.updateUserById(player.user_id, { user_metadata: nextMeta });
    }

    await admin.from("players").update({
      has_password: true,
      migration_completed: true,
      password_reset_required: resetStillRequired,
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", player.id);

    signIn.session.user.user_metadata = nextMeta;

    return json(200, {
      session: signIn.session,
      player: {
        id: player.id,
        handle: player.handle,
        name: player.name,
        rating: player.rating ?? 1000,
        avatar_url: player.avatar_url,
        status: player.status,
      },
    });
  } catch (e) {
    console.error("password-login error", e);
    return json(500, { error: e instanceof Error ? e.message : "Внутренняя ошибка" });
  }
});