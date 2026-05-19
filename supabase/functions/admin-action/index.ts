// ПИНГ ТАБЛЕТ — единая защищённая точка для админских действий.
// Аутентификация: header `x-admin-code` должен совпадать с секретом ADMIN_SECRET_CODE.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-code",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Action =
  | { type: "verify" }
  | {
      type: "create_tournament";
      payload: { name: string; location?: string; location_kind?: string; starts_at?: string; ends_at?: string; description?: string; cover_url?: string };
    }
  | { type: "update_tournament"; payload: { id: string; status?: "registration" | "live" | "finished"; name?: string; location?: string; location_kind?: string | null; starts_at?: string | null; ends_at?: string | null; description?: string | null; cover_url?: string | null } }
  | { type: "delete_tournament"; payload: { id: string } }
  | { type: "update_player"; payload: { id: string; handle?: string; name?: string; rating?: number; wins?: number; losses?: number; status?: string; bio?: string | null; avatar_url?: string | null; handicap?: number } }
  | { type: "delete_player"; payload: { id: string } }
  | { type: "generate_bracket"; payload: { tournament_id: string } }
  | { type: "set_winner"; payload: { match_id: string; winner_id: string } }
  | { type: "undo_match"; payload: { match_id: string } }
  // Achievements
  | { type: "achievement.create"; payload: AchievementInput }
  | { type: "achievement.update"; payload: AchievementInput & { id: string } }
  | { type: "achievement.delete"; payload: { id: string } }
  | { type: "achievement.grant"; payload: { player_id: string; achievement_id: string } }
  | { type: "achievement.revoke"; payload: { player_id: string; achievement_id: string } }
  | { type: "achievement.recompute_all"; payload?: Record<string, never> }
  | { type: "reset_player_password"; payload: { id: string } }
  | { type: "get_player_auth_info"; payload: { id: string } }
  | { type: "sticker.grant_shards"; payload: { player_id: string; amount: number } }
  | { type: "sticker.grant_pack"; payload: { player_id: string } }
  | { type: "sticker.grant_card"; payload: { player_id: string; card_id: string } }
  | { type: "tournament.add_player"; payload: { tournament_id: string; player_id: string } }
  | { type: "tournament.add_guest"; payload: { tournament_id: string; name: string } }
  | { type: "tournament.remove_player"; payload: { tournament_id: string; player_id: string } };

type AchievementInput = {
  code?: string;
  title?: string;
  description?: string;
  icon?: string;
  condition_type?: string;
  condition_value?: Record<string, unknown>;
  rarity?: "common" | "rare" | "epic" | "legendary";
  glow_color?: string;
  is_active?: boolean;
  sort_order?: number;
};

const VALID_LOCATION_KINDS = ["bar", "park", "club", "hall", "office", "other"];
const VALID_RARITIES = ["common", "rare", "epic", "legendary"];
const VALID_CONDITION_TYPES = [
  "first_match", "win_streak", "tournament_place", "tournaments_count",
  "tournaments_won_total", "tournament_streak", "matches_per_day",
  "locations_count", "win_at_location_kind", "beat_higher_rated",
  "rating_growth", "manual",
];

function normalizeAchievement(p: AchievementInput, mode: "create" | "update") {
  const patch: Record<string, unknown> = {};
  if (p.code !== undefined) {
    const c = String(p.code).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 60);
    if (mode === "create" && !c) throw new Error("Нужен код достижения");
    if (c) patch.code = c;
  }
  if (p.title !== undefined) {
    const t = String(p.title).trim().slice(0, 80);
    if (mode === "create" && !t) throw new Error("Нужно название");
    patch.title = t;
  }
  if (p.description !== undefined) patch.description = String(p.description).trim().slice(0, 280);
  if (p.icon !== undefined) patch.icon = String(p.icon).trim().slice(0, 16) || "🏓";
  if (p.condition_type !== undefined) {
    if (!VALID_CONDITION_TYPES.includes(p.condition_type)) throw new Error("Неверный тип условия");
    patch.condition_type = p.condition_type;
  }
  if (p.condition_value !== undefined) {
    if (p.condition_value && typeof p.condition_value !== "object") throw new Error("Параметры условия должны быть объектом");
    patch.condition_value = p.condition_value ?? {};
  }
  if (p.rarity !== undefined) {
    if (!VALID_RARITIES.includes(p.rarity)) throw new Error("Неверная редкость");
    patch.rarity = p.rarity;
  }
  if (p.glow_color !== undefined) patch.glow_color = String(p.glow_color).trim().slice(0, 40) || "0 0% 50%";
  if (p.is_active !== undefined) patch.is_active = !!p.is_active;
  if (p.sort_order !== undefined) patch.sort_order = Math.max(0, Math.round(Number(p.sort_order) || 0));
  return patch;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(p, 2);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Метод не поддерживается" });

  const ADMIN = Deno.env.get("ADMIN_SECRET_CODE");
  if (!ADMIN) return json(500, { error: "Секретный код администратора не настроен" });

  const provided = req.headers.get("x-admin-code");
  if (!provided || provided !== ADMIN) return json(401, { error: "Неверный код администратора" });

  let body: Action;
  try {
    body = (await req.json()) as Action;
  } catch {
    return json(400, { error: "Некорректные данные" });
  }

  // verify-only: handshake to validate the code on the client
  if (body.type === "verify") return json(200, { ok: true });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (body.type) {
      case "create_tournament": {
        const { name, location, location_kind, starts_at, ends_at, description, cover_url } = body.payload || ({} as any);
        if (!name || typeof name !== "string" || name.trim().length === 0)
          return json(400, { error: "Нужно название турнира" });
        if (location_kind && !VALID_LOCATION_KINDS.includes(location_kind))
          return json(400, { error: "Неверный тип локации" });
        const { data, error } = await supabase
          .from("tournaments")
          .insert({
            name: name.trim().slice(0, 120),
            location: location?.trim().slice(0, 200) ?? null,
            location_kind: location_kind || null,
            starts_at: starts_at ?? null,
            ends_at: ends_at ?? null,
            description: description?.trim().slice(0, 1000) ?? null,
            cover_url: cover_url?.trim().slice(0, 1000) || null,
          })
          .select()
          .single();
        if (error) throw error;
        return json(200, { tournament: data });
      }

      case "update_tournament": {
        const { id, ...rest } = body.payload;
        if (!id) return json(400, { error: "Не указан турнир" });
        const patch: Record<string, unknown> = {};
        if (rest.status) patch.status = rest.status;
        if (rest.name) patch.name = rest.name.trim().slice(0, 120);
        if (rest.location !== undefined) patch.location = rest.location?.trim().slice(0, 200) ?? null;
        if (rest.location_kind !== undefined) {
          if (rest.location_kind && !VALID_LOCATION_KINDS.includes(rest.location_kind))
            return json(400, { error: "Неверный тип локации" });
          patch.location_kind = rest.location_kind || null;
        }
        if (rest.starts_at !== undefined) patch.starts_at = rest.starts_at ?? null;
        if (rest.ends_at !== undefined) patch.ends_at = rest.ends_at ?? null;
        if (rest.description !== undefined) patch.description = rest.description?.trim().slice(0, 1000) ?? null;
        if (rest.cover_url !== undefined) patch.cover_url = rest.cover_url?.trim().slice(0, 1000) || null;
        const { data, error } = await supabase
          .from("tournaments")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return json(200, { tournament: data });
      }

      case "delete_tournament": {
        const { id } = body.payload;
        if (!id) return json(400, { error: "Не указан турнир" });
        const { error } = await supabase.from("tournaments").delete().eq("id", id);
        if (error) throw error;
        return json(200, { ok: true });
      }

      case "update_player": {
        const { id, ...rest } = body.payload;
        if (!id) return json(400, { error: "Не указан игрок" });
        const patch: Record<string, unknown> = {};
        if (rest.handle !== undefined) {
          const handle = rest.handle.trim().toLowerCase();
          if (!/^[a-zA-Z0-9_]{3,20}$/.test(handle)) return json(400, { error: "Ник: 3–20 символов, латиница/цифры/_" });
          patch.handle = handle;
        }
        if (rest.name !== undefined) {
          const name = rest.name.trim();
          if (name.length < 1 || name.length > 40) return json(400, { error: "Имя: от 1 до 40 символов" });
          patch.name = name;
        }
        if (rest.rating !== undefined) patch.rating = Math.max(0, Math.round(Number(rest.rating) || 0));
        if (rest.wins !== undefined) patch.wins = Math.max(0, Math.round(Number(rest.wins) || 0));
        if (rest.losses !== undefined) patch.losses = Math.max(0, Math.round(Number(rest.losses) || 0));
        if (rest.status !== undefined) patch.status = rest.status.trim().slice(0, 40) || "Игрок";
        if (rest.bio !== undefined) patch.bio = rest.bio?.trim().slice(0, 500) || null;
        if (rest.avatar_url !== undefined) patch.avatar_url = rest.avatar_url?.trim().slice(0, 1000) || null;
        if (rest.handicap !== undefined) {
          const h = Math.round(Number(rest.handicap));
          if (!Number.isFinite(h) || h < -50 || h > 50) return json(400, { error: "Фора должна быть от -50 до 50" });
          patch.handicap = h;
        }
        const { data, error } = Object.keys(patch).length
          ? await supabase.from("players").update(patch).eq("id", id).select("id, handle, name, rating, wins, losses, status, bio, avatar_url, handicap").single()
          : await supabase.from("players").select("id, handle, name, rating, wins, losses, status, bio, avatar_url, handicap").eq("id", id).single();
        if (error) throw error;
        return json(200, { player: data });
      }

      case "delete_player": {
        const { id } = body.payload;
        if (!id) return json(400, { error: "Не указан игрок" });
        const { error } = await supabase.from("players").delete().eq("id", id);
        if (error) throw error;
        return json(200, { ok: true });
      }

      case "generate_bracket": {
        const { tournament_id } = body.payload;
        if (!tournament_id) return json(400, { error: "Не указан турнир" });

        // Wipe existing matches (idempotent regenerate)
        await supabase.from("matches").delete().eq("tournament_id", tournament_id);

        const { data: regs, error: regsErr } = await supabase
          .from("registrations")
          .select("player_id")
          .eq("tournament_id", tournament_id);
        if (regsErr) throw regsErr;
        if (!regs || regs.length < 2) return json(400, { error: "Нужно минимум 2 игрока" });

        const players = shuffle(regs.map((r) => r.player_id as string));
        const size = nextPow2(players.length);
        const byes = size - players.length;
        // Pad with nulls (BYEs) at the end
        const slots: (string | null)[] = [...players, ...Array(byes).fill(null)];

        // Build first round matches
        const firstRound: {
          tournament_id: string;
          round: number;
          position: number;
          player1_id: string | null;
          player2_id: string | null;
          winner_id: string | null;
          is_bye: boolean;
        }[] = [];
        const numFirstMatches = size / 2;
        for (let i = 0; i < numFirstMatches; i++) {
          const p1 = slots[i * 2];
          const p2 = slots[i * 2 + 1];
          const isBye = p1 === null || p2 === null;
          const winner = isBye ? p1 ?? p2 : null;
          firstRound.push({
            tournament_id,
            round: 1,
            position: i,
            player1_id: p1,
            player2_id: p2,
            winner_id: winner,
            is_bye: isBye,
          });
        }

        // Subsequent rounds — empty placeholders
        const allMatches = [...firstRound];
        let prevCount = numFirstMatches;
        let round = 2;
        while (prevCount > 1) {
          const cnt = prevCount / 2;
          for (let i = 0; i < cnt; i++) {
            allMatches.push({
              tournament_id,
              round,
              position: i,
              player1_id: null,
              player2_id: null,
              winner_id: null,
              is_bye: false,
            });
          }
          prevCount = cnt;
          round++;
        }

        const { error: insErr } = await supabase.from("matches").insert(allMatches);
        if (insErr) throw insErr;

        // Auto-advance BYE winners into round 2 slots
        for (const m of firstRound) {
          if (m.is_bye && m.winner_id) {
            const nextPos = Math.floor(m.position / 2);
            const slot = m.position % 2 === 0 ? "player1_id" : "player2_id";
            await supabase
              .from("matches")
              .update({ [slot]: m.winner_id })
              .eq("tournament_id", tournament_id)
              .eq("round", 2)
              .eq("position", nextPos);
          }
        }

        await supabase.from("tournaments").update({ status: "live" }).eq("id", tournament_id);

        return json(200, { ok: true, size, byes });
      }

      case "set_winner": {
        const { match_id, winner_id } = body.payload;
        if (!match_id || !winner_id) return json(400, { error: "Нужно выбрать матч и победителя" });

        const { data: match, error: mErr } = await supabase
          .from("matches")
          .select("*")
          .eq("id", match_id)
          .single();
        if (mErr) throw mErr;
        if (![match.player1_id, match.player2_id].includes(winner_id))
          return json(400, { error: "Победитель должен быть участником матча" });

        const loser_id = winner_id === match.player1_id ? match.player2_id : match.player1_id;
        const previousWinner = match.winner_id;

        // Update match
        const { error: upErr } = await supabase
          .from("matches")
          .update({ winner_id, rating_applied: true })
          .eq("id", match_id);
        if (upErr) throw upErr;

        // Apply rating delta — undo previous if needed, apply new
        if (previousWinner && previousWinner !== winner_id) {
          // Undo previous rating
          const prevLoser = previousWinner === match.player1_id ? match.player2_id : match.player1_id;
          await adjustRating(supabase, previousWinner, -25, "win");
          if (prevLoser) await adjustRating(supabase, prevLoser, +25, "loss");
          // Also clear previous winner from next match slot
          await clearNextSlot(supabase, match);
        }

        if (previousWinner !== winner_id) {
          await adjustRating(supabase, winner_id, +25, "win");
          if (loser_id) await adjustRating(supabase, loser_id, -25, "loss");
        }

        // Propagate winner to next round
        await propagateWinner(supabase, match, winner_id);

        // If this is the final and no further round exists → finish tournament
        const { data: nextRoundCheck } = await supabase
          .from("matches")
          .select("id")
          .eq("tournament_id", match.tournament_id)
          .gt("round", match.round)
          .limit(1);
        if (!nextRoundCheck || nextRoundCheck.length === 0) {
          await supabase
            .from("tournaments")
            .update({ status: "finished" })
            .eq("id", match.tournament_id);
        }

        return json(200, { ok: true });
      }

      case "undo_match": {
        const { match_id } = body.payload;
        if (!match_id) return json(400, { error: "Не указан матч" });

        const { data: match, error: mErr } = await supabase
          .from("matches")
          .select("*")
          .eq("id", match_id)
          .single();
        if (mErr) throw mErr;
        if (!match.winner_id) return json(400, { error: "В этом матче ещё нет победителя" });

        const winner = match.winner_id;
        const loser = winner === match.player1_id ? match.player2_id : match.player1_id;

        // Reverse rating
        await adjustRating(supabase, winner, -25, "win");
        if (loser) await adjustRating(supabase, loser, +25, "loss");

        // Clear winner from this match
        await supabase.from("matches").update({ winner_id: null, rating_applied: false }).eq("id", match_id);

        // Clear winner from next match slot (and recursively further if propagated)
        await clearNextSlot(supabase, match);

        // Re-open tournament if it was finished
        await supabase
          .from("tournaments")
          .update({ status: "live" })
          .eq("id", match.tournament_id)
          .eq("status", "finished");

        return json(200, { ok: true });
      }

      // ---- Achievements ----
      case "achievement.create": {
        const patch = normalizeAchievement(body.payload, "create");
        if (!patch.code) return json(400, { error: "Нужен код достижения" });
        if (!patch.title) return json(400, { error: "Нужно название" });
        if (!patch.condition_type) patch.condition_type = "manual";
        const { data, error } = await supabase.from("achievements").insert(patch).select().single();
        if (error) throw error;
        return json(200, { achievement: data });
      }

      case "achievement.update": {
        const { id, ...rest } = body.payload;
        if (!id) return json(400, { error: "Не указано достижение" });
        const patch = normalizeAchievement(rest, "update");
        const { data, error } = Object.keys(patch).length
          ? await supabase.from("achievements").update(patch).eq("id", id).select().single()
          : await supabase.from("achievements").select("*").eq("id", id).single();
        if (error) throw error;
        return json(200, { achievement: data });
      }

      case "achievement.delete": {
        const { id } = body.payload;
        if (!id) return json(400, { error: "Не указано достижение" });
        const { error } = await supabase.from("achievements").delete().eq("id", id);
        if (error) throw error;
        return json(200, { ok: true });
      }

      case "achievement.grant": {
        const { player_id, achievement_id } = body.payload;
        if (!player_id || !achievement_id) return json(400, { error: "Нужны игрок и достижение" });
        const { data, error } = await supabase.rpc("admin_grant_achievement", { _player_id: player_id, _achievement_id: achievement_id });
        if (error) throw error;
        return json(200, { user_achievement: data });
      }

      case "achievement.revoke": {
        const { player_id, achievement_id } = body.payload;
        if (!player_id || !achievement_id) return json(400, { error: "Нужны игрок и достижение" });
        const { error } = await supabase.rpc("admin_revoke_achievement", { _player_id: player_id, _achievement_id: achievement_id });
        if (error) throw error;
        return json(200, { ok: true });
      }

      case "achievement.recompute_all": {
        const { data: players, error: pErr } = await supabase.from("players").select("id");
        if (pErr) throw pErr;
        let granted = 0;
        for (const p of (players ?? []) as { id: string }[]) {
          const { data: rows } = await supabase.rpc("evaluate_player_achievements", { _player_id: p.id });
          granted += Array.isArray(rows) ? rows.length : 0;
        }
        return json(200, { ok: true, granted, players: (players ?? []).length });
      }

      case "racket_item.upsert": {
        const p = (body as unknown as { payload: Record<string, unknown> }).payload || {};
        const valid_cat = ["blade", "rubber", "handle", "effect", "sticker"];
        const valid_rar = ["common", "rare", "epic", "legendary", "mythic"];
        const patch: Record<string, unknown> = {};
        if (p.code !== undefined) patch.code = String(p.code).trim().toLowerCase().slice(0, 60);
        if (p.name !== undefined) patch.name = String(p.name).trim().slice(0, 80);
        if (p.category !== undefined) {
          if (!valid_cat.includes(String(p.category))) return json(400, { error: "Неверная категория" });
          patch.category = p.category;
        }
        if (p.rarity !== undefined) {
          if (!valid_rar.includes(String(p.rarity))) return json(400, { error: "Неверная редкость" });
          patch.rarity = p.rarity;
        }
        if (p.price !== undefined) patch.price = Math.max(0, Math.round(Number(p.price) || 0));
        if (p.unlock_condition !== undefined) patch.unlock_condition = p.unlock_condition;
        if (p.material_params !== undefined) patch.material_params = p.material_params;
        if (p.effect_params !== undefined) patch.effect_params = p.effect_params;
        if (p.preview_color !== undefined) patch.preview_color = String(p.preview_color).slice(0, 16);
        if (p.is_active !== undefined) patch.is_active = !!p.is_active;
        if (p.sort_order !== undefined) patch.sort_order = Math.max(0, Math.round(Number(p.sort_order) || 0));

        if (p.id) {
          const { data, error } = await supabase.from("racket_items").update(patch).eq("id", p.id).select().single();
          if (error) throw error;
          return json(200, { item: data });
        } else {
          if (!patch.code || !patch.name || !patch.category) return json(400, { error: "Нужны код, название и категория" });
          const { data, error } = await supabase.from("racket_items").insert(patch).select().single();
          if (error) throw error;
          return json(200, { item: data });
        }
      }

      case "racket_item.delete": {
        const id = (body as unknown as { payload: { id: string } }).payload?.id;
        if (!id) return json(400, { error: "Не указан предмет" });
        const { error } = await supabase.from("racket_items").delete().eq("id", id);
        if (error) throw error;
        return json(200, { ok: true });
      }

      case "racket.recompute_points": {
        // Sync balances from achievements (in case of drift)
        const { data: counts, error } = await supabase
          .from("user_achievements")
          .select("player_id");
        if (error) throw error;
        const map: Record<string, number> = {};
        for (const r of (counts ?? []) as { player_id: string }[]) map[r.player_id] = (map[r.player_id] ?? 0) + 1;
        const entries = Object.entries(map);
        for (const [pid, n] of entries) {
          await supabase.from("achievement_points").upsert({
            player_id: pid,
            balance: n * 3,
            lifetime_earned: n * 3,
            lifetime_spent: 0,
          }, { onConflict: "player_id" });
        }
        return json(200, { ok: true, players: entries.length });
      }

      case "get_player_auth_info": {
        const { id } = body.payload;
        if (!id) return json(400, { error: "Не указан игрок" });
        const { data: player } = await supabase.from("players").select("user_id").eq("id", id).single();
        if (!player?.user_id) return json(200, { has_account: false });
        const { data: u, error } = await supabase.auth.admin.getUserById(player.user_id);
        if (error) throw error;
        const meta = (u.user?.user_metadata ?? {}) as Record<string, unknown>;
        return json(200, {
          has_account: true,
          email: u.user?.email ?? null,
          last_sign_in_at: u.user?.last_sign_in_at ?? null,
          created_at: u.user?.created_at ?? null,
          must_change_password: !!meta.must_change_password,
          has_password: meta.has_password !== false,
          migration_completed: meta.migration_completed === true || meta.has_password === true,
        });
      }

      case "reset_player_password": {
        const { id } = body.payload;
        if (!id) return json(400, { error: "Не указан игрок" });
        const { data: player } = await supabase.from("players").select("user_id, handle").eq("id", id).single();
        if (!player?.user_id) return json(400, { error: "У игрока нет привязанного аккаунта" });

        // Generate a strong temp password (12 chars, mixed)
        const temp = generateTempPassword(12);

        // Preserve existing metadata, set a one-time must-change flag. Never store plaintext passwords.
        const { data: u } = await supabase.auth.admin.getUserById(player.user_id);
        const meta = {
          ...(u.user?.user_metadata ?? {}),
          has_password: true,
          migration_completed: true,
          password_reset_required: true,
          must_change_password: true,
          password_reset_at: new Date().toISOString(),
        };

        const { error } = await supabase.auth.admin.updateUserById(player.user_id, {
          password: temp,
          user_metadata: meta,
        });
        if (error) throw error;

        await supabase.from("players").update({
          has_password: true,
          migration_completed: true,
          password_reset_required: true,
          updated_at: new Date().toISOString(),
        }).eq("id", id);

        // Invalidate active sessions so user must re-login with temp password
        try { await supabase.auth.admin.signOut(player.user_id, "global"); } catch { /* best effort */ }

        return json(200, { temp_password: temp, handle: player.handle });
      }

      case "sticker.grant_shards": {
        const { player_id, amount } = body.payload;
        if (!player_id) return json(400, { error: "Не указан игрок" });
        const amt = Math.round(Number(amount));
        if (!Number.isFinite(amt) || amt === 0) return json(400, { error: "Сумма должна быть ненулевой" });
        const { data, error } = await supabase.rpc("admin_sticker_grant_shards", { _player_id: player_id, _amount: amt });
        if (error) throw error;
        return json(200, { wallet: data });
      }

      case "sticker.grant_pack": {
        const { player_id } = body.payload;
        if (!player_id) return json(400, { error: "Не указан игрок" });
        const { data, error } = await supabase.rpc("admin_sticker_grant_pack", { _player_id: player_id });
        if (error) throw error;
        return json(200, { stickers: data ?? [] });
      }

      case "sticker.grant_card": {
        const { player_id, card_id } = body.payload;
        if (!player_id || !card_id) return json(400, { error: "Нужны игрок и наклейка" });
        const { data, error } = await supabase.rpc("admin_sticker_grant_card", { _player_id: player_id, _card_id: card_id });
        if (error) throw error;
        return json(200, { sticker: data });
      }

      case "tournament.add_player": {
        const { tournament_id, player_id } = body.payload;
        if (!tournament_id || !player_id) return json(400, { error: "Нужны турнир и игрок" });
        const { data: t } = await supabase.from("tournaments").select("status").eq("id", tournament_id).single();
        if (!t) return json(404, { error: "Турнир не найден" });
        if (t.status !== "registration") return json(400, { error: "Регистрация уже закрыта" });
        const { data: existing } = await supabase
          .from("registrations").select("id")
          .eq("tournament_id", tournament_id).eq("player_id", player_id).maybeSingle();
        if (existing) return json(400, { error: "Игрок уже зарегистрирован" });
        const { error } = await supabase.from("registrations").insert({ tournament_id, player_id });
        if (error) throw error;
        return json(200, { ok: true });
      }

      case "tournament.add_guest": {
        const { tournament_id, name } = body.payload;
        if (!tournament_id) return json(400, { error: "Не указан турнир" });
        const cleanName = String(name ?? "").trim().slice(0, 40);
        if (cleanName.length < 1) return json(400, { error: "Нужно имя гостя" });
        const { data: t } = await supabase.from("tournaments").select("status").eq("id", tournament_id).single();
        if (!t) return json(404, { error: "Турнир не найден" });
        if (t.status !== "registration") return json(400, { error: "Регистрация уже закрыта" });

        // Build unique handle: guest_<random>
        const base = "guest_" + Math.random().toString(36).slice(2, 8);
        let handle = base;
        let suffix = 0;
        // ensure uniqueness
        while (true) {
          const { data: exists } = await supabase.from("players").select("id").eq("handle", handle).maybeSingle();
          if (!exists) break;
          suffix += 1;
          handle = base + suffix.toString();
        }

        const { data: guest, error: gErr } = await supabase
          .from("players")
          .insert({
            handle,
            name: cleanName,
            rating: 1000,
            wins: 0,
            losses: 0,
            status: "Гость",
            is_guest: true,
          })
          .select("id")
          .single();
        if (gErr) throw gErr;

        const { error: rErr } = await supabase
          .from("registrations")
          .insert({ tournament_id, player_id: guest.id });
        if (rErr) throw rErr;

        return json(200, { ok: true, player_id: guest.id });
      }

      case "tournament.remove_player": {
        const { tournament_id, player_id } = body.payload;
        if (!tournament_id || !player_id) return json(400, { error: "Нужны турнир и игрок" });
        const { data: t } = await supabase.from("tournaments").select("status").eq("id", tournament_id).single();
        if (!t) return json(404, { error: "Турнир не найден" });
        if (t.status !== "registration") return json(400, { error: "Регистрация уже закрыта" });
        const { error } = await supabase
          .from("registrations").delete()
          .eq("tournament_id", tournament_id).eq("player_id", player_id);
        if (error) throw error;

        // Best-effort cleanup: if guest player isn't used elsewhere, remove it
        const { data: pl } = await supabase.from("players").select("is_guest").eq("id", player_id).single();
        if (pl?.is_guest) {
          const { count } = await supabase
            .from("registrations").select("id", { count: "exact", head: true })
            .eq("player_id", player_id);
          if (!count || count === 0) {
            await supabase.from("players").delete().eq("id", player_id);
          }
        }
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: "Неизвестное действие" });
    }
  } catch (e) {
    console.error("admin-action error", e);
    const message = e instanceof Error ? e.message : "Внутренняя ошибка";
    return json(500, { error: message });
  }
});

// ---- helpers ----
function generateTempPassword(len = 12): string {
  // No ambiguous chars (0/O/1/l/I) for easy reading
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  // Inject a symbol to satisfy strong-password policies
  const symbols = "!@#$%&*";
  const sb = new Uint8Array(1); crypto.getRandomValues(sb);
  const pos = sb[0] % len;
  return out.slice(0, pos) + symbols[sb[0] % symbols.length] + out.slice(pos + 1);
}

async function adjustRating(
  supabase: ReturnType<typeof createClient>,
  player_id: string,
  delta: number,
  kind: "win" | "loss",
) {
  const { data: p } = await supabase.from("players").select("rating, wins, losses").eq("id", player_id).single();
  if (!p) return;
  const patch: Record<string, unknown> = { rating: (p.rating ?? 1000) + delta };
  if (kind === "win") patch.wins = Math.max(0, (p.wins ?? 0) + (delta > 0 ? 1 : -1));
  if (kind === "loss") patch.losses = Math.max(0, (p.losses ?? 0) + (delta < 0 ? 1 : -1));
  await supabase.from("players").update(patch).eq("id", player_id);
}

async function propagateWinner(
  supabase: ReturnType<typeof createClient>,
  match: { tournament_id: string; round: number; position: number },
  winner_id: string,
) {
  const nextRound = match.round + 1;
  const nextPos = Math.floor(match.position / 2);
  const slot = match.position % 2 === 0 ? "player1_id" : "player2_id";
  await supabase
    .from("matches")
    .update({ [slot]: winner_id })
    .eq("tournament_id", match.tournament_id)
    .eq("round", nextRound)
    .eq("position", nextPos);
}

async function clearNextSlot(
  supabase: ReturnType<typeof createClient>,
  match: { tournament_id: string; round: number; position: number },
) {
  const nextRound = match.round + 1;
  const nextPos = Math.floor(match.position / 2);
  const slot = match.position % 2 === 0 ? "player1_id" : "player2_id";

  // Get the next match — if it already has a winner, recursively undo
  const { data: next } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", match.tournament_id)
    .eq("round", nextRound)
    .eq("position", nextPos)
    .maybeSingle();

  if (!next) return;

  if (next.winner_id) {
    // Reverse downstream rating then clear
    const w = next.winner_id;
    const l = w === next.player1_id ? next.player2_id : next.player1_id;
    await adjustRating(supabase, w, -25, "win");
    if (l) await adjustRating(supabase, l, +25, "loss");
    await supabase
      .from("matches")
      .update({ winner_id: null, rating_applied: false, [slot]: null })
      .eq("id", next.id);
    await clearNextSlot(supabase, next);
  } else {
    await supabase.from("matches").update({ [slot]: null }).eq("id", next.id);
  }
}
