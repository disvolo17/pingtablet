// Validates Telegram Mini App initData using HMAC-SHA256 with the bot token,
// then upserts the player and returns the public profile.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacSha256(keyBytes: Uint8Array, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return new Uint8Array(sig);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyInitData(initData: string, botToken: string): Promise<{ ok: boolean; data?: URLSearchParams; reason?: string }> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "Нет hash" };
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => [k, v] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = await hmacSha256(new TextEncoder().encode("WebAppData"), botToken);
  const sig = await hmacSha256(secretKey, dataCheckString);
  const computed = toHex(sig);
  if (computed !== hash) return { ok: false, reason: "Неверная подпись" };

  // Reject stale initData (>24h)
  const authDate = Number(params.get("auth_date") || "0");
  if (!authDate || Date.now() / 1000 - authDate > 86400) {
    return { ok: false, reason: "initData устарел" };
  }
  return { ok: true, data: params };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) return json(500, { error: "TELEGRAM_BOT_TOKEN не настроен" });

    const body = await req.json().catch(() => ({}));
    const initData = String((body as { initData?: string })?.initData || "");
    if (!initData) return json(400, { error: "Нет initData" });

    const v = await verifyInitData(initData, botToken);
    if (!v.ok || !v.data) return json(401, { error: v.reason || "Невалидный initData" });

    const userJson = v.data.get("user");
    if (!userJson) return json(400, { error: "В initData нет user" });
    const user = JSON.parse(userJson) as {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: player, error } = await supabase.rpc("telegram_upsert_player", {
      _telegram_id: user.id,
      _first_name: user.first_name ?? null,
      _last_name: user.last_name ?? null,
      _username: user.username ?? null,
      _photo_url: user.photo_url ?? null,
    });
    if (error) return json(500, { error: error.message });

    return json(200, { player });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Internal error" });
  }
});
