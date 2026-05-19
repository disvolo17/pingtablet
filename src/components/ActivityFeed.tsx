// Live realtime activity feed — social-style stream of matches, joins, achievements, tournaments.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Flame, Sparkles, Swords, Trophy, UserPlus, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type FeedKind = "match" | "join" | "achievement" | "tournament" | "streak";

type FeedItem = {
  id: string;
  kind: FeedKind;
  text: React.ReactNode;
  createdAt: string;
  href?: string;
  fresh?: boolean;
};

const ICONS: Record<FeedKind, React.ComponentType<{ className?: string }>> = {
  match: Swords,
  join: UserPlus,
  achievement: Trophy,
  tournament: Calendar,
  streak: Flame,
};

const KIND_TINT: Record<FeedKind, string> = {
  match: "text-ink",
  join: "text-subtle",
  achievement: "text-orange",
  tournament: "text-ink",
  streak: "text-orange",
};

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "только что";
  if (d < 3600) return `${Math.floor(d / 60)} мин`;
  if (d < 86400) return `${Math.floor(d / 3600)} ч`;
  return `${Math.floor(d / 86400)} дн`;
}

async function fetchPlayer(id: string | null | undefined) {
  if (!id) return null;
  const { data } = await supabase.from("players").select("id, handle, name").eq("id", id).maybeSingle();
  return data as { id: string; handle: string; name: string } | null;
}

async function fetchAchievement(id: string) {
  const { data } = await supabase.from("achievements").select("id, title, icon").eq("id", id).maybeSingle();
  return data as { id: string; title: string; icon: string } | null;
}

const PlayerLink = ({ p }: { p: { handle: string; name: string } | null }) =>
  p ? (
    <Link to={`/p/${p.handle}`} className="font-medium text-ink hover:underline underline-offset-2">
      {p.name}
    </Link>
  ) : (
    <span className="font-medium text-ink">Игрок</span>
  );

export default function ActivityFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  const push = (it: FeedItem) => {
    if (seenRef.current.has(it.id)) return;
    seenRef.current.add(it.id);
    setItems((prev) => [it, ...prev].slice(0, 25));
    if (it.fresh) {
      window.setTimeout(() => {
        setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, fresh: false } : x)));
      }, 2400);
    }
  };

  // Initial backfill
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [matchesRes, playersRes, tournamentsRes, achRes] = await Promise.all([
        supabase
          .from("matches")
          .select("id, player1_id, player2_id, winner_id, is_bye, created_at, tournament_id")
          .eq("is_bye", false)
          .not("winner_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("players")
          .select("id, handle, name, created_at")
          .order("created_at", { ascending: false })
          .limit(4),
        supabase
          .from("tournaments")
          .select("id, name, starts_at, location, status, created_at")
          .order("created_at", { ascending: false })
          .limit(4),
        supabase
          .from("user_achievements")
          .select("id, player_id, achievement_id, unlocked_at")
          .order("unlocked_at", { ascending: false })
          .limit(6),
      ]);

      if (cancelled) return;

      const out: FeedItem[] = [];

      for (const m of (matchesRes.data ?? []) as Array<{ id: string; player1_id: string; player2_id: string; winner_id: string; created_at: string; tournament_id: string }>) {
        const [w, l] = await Promise.all([
          fetchPlayer(m.winner_id),
          fetchPlayer(m.player1_id === m.winner_id ? m.player2_id : m.player1_id),
        ]);
        out.push({
          id: `m-${m.id}`,
          kind: "match",
          createdAt: m.created_at,
          href: `/t/${m.tournament_id}`,
          text: (
            <>
              <PlayerLink p={w} /> <span className="text-subtle">обыграл</span> <PlayerLink p={l} />
            </>
          ),
        });
      }

      for (const p of (playersRes.data ?? []) as Array<{ id: string; handle: string; name: string; created_at: string }>) {
        out.push({
          id: `p-${p.id}`,
          kind: "join",
          createdAt: p.created_at,
          href: `/p/${p.handle}`,
          text: (
            <>
              <PlayerLink p={p} /> <span className="text-subtle">присоединился к ПИНГ ТАБЛЕТ</span>
            </>
          ),
        });
      }

      for (const t of (tournamentsRes.data ?? []) as Array<{ id: string; name: string; starts_at: string | null; location: string | null; status: string; created_at: string }>) {
        const when = t.starts_at ? new Date(t.starts_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
        out.push({
          id: `t-${t.id}`,
          kind: "tournament",
          createdAt: t.created_at,
          href: `/t/${t.id}`,
          text: (
            <>
              <span className="text-subtle">Турнир</span>{" "}
              <Link to={`/t/${t.id}`} className="font-medium text-ink hover:underline underline-offset-2">{t.name}</Link>
              {when && <span className="text-subtle"> · {when}</span>}
              {t.location && <span className="text-subtle"> · {t.location}</span>}
            </>
          ),
        });
      }

      for (const ua of (achRes.data ?? []) as Array<{ id: string; player_id: string; achievement_id: string; unlocked_at: string }>) {
        const [pl, ach] = await Promise.all([fetchPlayer(ua.player_id), fetchAchievement(ua.achievement_id)]);
        if (!ach) continue;
        out.push({
          id: `a-${ua.id}`,
          kind: "achievement",
          createdAt: ua.unlocked_at,
          href: pl ? `/p/${pl.handle}` : undefined,
          text: (
            <>
              <PlayerLink p={pl} /> <span className="text-subtle">получил</span>{" "}
              <span className="font-medium text-ink">{ach.icon} {ach.title}</span>
            </>
          ),
        });
      }

      out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      out.forEach((i) => seenRef.current.add(i.id));
      setItems(out.slice(0, 20));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    const ch = supabase
      .channel("activity-feed")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        async (payload) => {
          const m = payload.new as { id: string; player1_id: string; player2_id: string; winner_id: string | null; is_bye: boolean; created_at: string; tournament_id: string };
          if (m.is_bye || !m.winner_id) return;
          const old = payload.old as { winner_id: string | null };
          if (old?.winner_id === m.winner_id) return;
          const [w, l] = await Promise.all([
            fetchPlayer(m.winner_id),
            fetchPlayer(m.player1_id === m.winner_id ? m.player2_id : m.player1_id),
          ]);
          push({
            id: `m-${m.id}`,
            kind: "match",
            createdAt: new Date().toISOString(),
            href: `/t/${m.tournament_id}`,
            fresh: true,
            text: (
              <>
                <PlayerLink p={w} /> <span className="text-subtle">обыграл</span> <PlayerLink p={l} />
              </>
            ),
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "players" },
        (payload) => {
          const p = payload.new as { id: string; handle: string; name: string; created_at: string };
          push({
            id: `p-${p.id}`,
            kind: "join",
            createdAt: p.created_at,
            href: `/p/${p.handle}`,
            fresh: true,
            text: (
              <>
                <PlayerLink p={p} /> <span className="text-subtle">присоединился к ПИНГ ТАБЛЕТ</span>
              </>
            ),
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tournaments" },
        (payload) => {
          const t = payload.new as { id: string; name: string; starts_at: string | null; location: string | null; created_at: string };
          const when = t.starts_at ? new Date(t.starts_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
          push({
            id: `t-${t.id}`,
            kind: "tournament",
            createdAt: t.created_at,
            href: `/t/${t.id}`,
            fresh: true,
            text: (
              <>
                <span className="text-subtle">Новый турнир</span>{" "}
                <Link to={`/t/${t.id}`} className="font-medium text-ink hover:underline underline-offset-2">{t.name}</Link>
                {when && <span className="text-subtle"> · {when}</span>}
              </>
            ),
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_achievements" },
        async (payload) => {
          const ua = payload.new as { id: string; player_id: string; achievement_id: string; unlocked_at: string };
          const [pl, ach] = await Promise.all([fetchPlayer(ua.player_id), fetchAchievement(ua.achievement_id)]);
          if (!ach) return;
          push({
            id: `a-${ua.id}`,
            kind: "achievement",
            createdAt: ua.unlocked_at,
            href: pl ? `/p/${pl.handle}` : undefined,
            fresh: true,
            text: (
              <>
                <PlayerLink p={pl} /> <span className="text-subtle">получил</span>{" "}
                <span className="font-medium text-ink">{ach.icon} {ach.title}</span>
              </>
            ),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <section className="container pt-section">
      <div className="flex items-end justify-between mb-5 md:mb-7">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl md:text-4xl font-display font-bold tracking-tight">Лента</h2>
          <span className="inline-flex items-center gap-1 rounded-full hairline bg-card/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-subtle">
            <span className="h-1.5 w-1.5 rounded-full bg-orange animate-pulse" />
            live
          </span>
        </div>
        <span className="text-sm text-subtle inline-flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5" /> в реальном времени
        </span>
      </div>

      {items.length === 0 ? (
        <div className="pt-card pt-pad-sm text-sm text-muted-foreground">
          <Zap className="h-4 w-4 inline mr-2 text-subtle" />
          Активности пока нет — будь первым.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {items.map((it) => {
              const Icon = ICONS[it.kind];
              const inner = (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 360, damping: 28 }}
                  className={`relative flex items-start gap-3 rounded-2xl hairline bg-card/60 px-3 py-2.5 md:px-4 md:py-3 transition-colors ${
                    it.fresh ? "ring-1 ring-orange/40 shadow-[0_0_24px_-8px_hsl(var(--orange)/0.6)]" : ""
                  }`}
                >
                  {it.fresh && (
                    <motion.span
                      aria-hidden
                      initial={{ opacity: 0.6 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 2.2 }}
                      className="absolute inset-0 rounded-2xl bg-orange/10 pointer-events-none"
                    />
                  )}
                  <div className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full hairline bg-paper ${KIND_TINT[it.kind]}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug text-foreground truncate-2">{it.text}</p>
                    <span className="mt-0.5 block text-[11px] text-subtle">{timeAgo(it.createdAt)}</span>
                  </div>
                </motion.div>
              );
              return (
                <motion.li key={it.id} layout className="list-none">
                  {it.href ? <Link to={it.href} className="block">{inner}</Link> : inner}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
