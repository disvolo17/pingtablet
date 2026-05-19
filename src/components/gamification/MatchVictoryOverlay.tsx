// Global match-victory celebration. Listens to matches realtime;
// when current player wins, shows animated result screen with rating delta.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer } from "@/lib/currentPlayer";
import { RATING_DELTA, getLeague, leagueProgress } from "@/lib/gamification";
import RatingCounter from "./RatingCounter";

type Victory = {
  id: string;
  oppName: string;
  oppHandle?: string;
  prevRating: number;
  newRating: number;
};

function burst() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const t0 = now + i * 0.07;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.55);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch { /* ignore */ }
}

export default function MatchVictoryOverlay() {
  const [me] = useCurrentPlayer();
  const [victory, setVictory] = useState<Victory | null>(null);

  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase
      .channel(`victory-${me.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        async (payload) => {
          const m = payload.new as { id: string; player1_id: string | null; player2_id: string | null; winner_id: string | null; is_bye: boolean };
          const old = payload.old as { winner_id: string | null };
          if (m.is_bye || !m.winner_id || old?.winner_id === m.winner_id) return;
          if (m.winner_id !== me.id) return;
          const oppId = m.player1_id === me.id ? m.player2_id : m.player1_id;
          const [{ data: opp }, { data: player }] = await Promise.all([
            oppId ? supabase.from("players").select("name, handle").eq("id", oppId).maybeSingle() : Promise.resolve({ data: null }),
            supabase.from("players").select("rating").eq("id", me.id).maybeSingle(),
          ]);
          const newRating = (player as { rating: number } | null)?.rating ?? (me.rating ?? 1000);
          const prevRating = newRating - RATING_DELTA;
          setVictory({
            id: m.id,
            oppName: (opp as { name: string } | null)?.name ?? "Соперник",
            oppHandle: (opp as { handle: string } | null)?.handle,
            prevRating,
            newRating,
          });
          burst();
          if (navigator.vibrate) navigator.vibrate([14, 40, 18]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me?.id, me?.rating]);

  return (
    <AnimatePresence>
      {victory && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "hsl(var(--background) / 0.7)", backdropFilter: "blur(14px)" }}
          onClick={() => setVictory(null)}
        >
          {/* Confetti rays */}
          <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 18 }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ y: "60vh", x: `${(i / 18) * 100}vw`, opacity: 0, rotate: 0 }}
                animate={{ y: "-20vh", opacity: [0, 1, 1, 0], rotate: 360 }}
                transition={{ duration: 2.4, delay: i * 0.04, repeat: Infinity, repeatDelay: 0.6 }}
                className="absolute h-2 w-2 rounded-sm"
                style={{ background: i % 2 ? "hsl(var(--orange))" : "hsl(var(--ink))" }}
              />
            ))}
          </div>

          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="relative w-full max-w-sm pt-card pt-pad text-center"
            style={{ boxShadow: "0 30px 80px -20px hsl(var(--orange) / 0.5)" }}
          >
            <button
              onClick={() => setVictory(null)}
              aria-label="Закрыть"
              className="absolute top-3 right-3 h-7 w-7 inline-flex items-center justify-center rounded-full hairline bg-paper text-subtle hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.05 }}
              className="mx-auto h-16 w-16 rounded-full bg-orange/15 flex items-center justify-center mb-3"
              style={{ boxShadow: "0 0 40px -10px hsl(var(--orange))" }}
            >
              <Trophy className="h-8 w-8 text-orange" />
            </motion.div>

            <div className="text-[10px] uppercase tracking-[0.2em] text-subtle">Победа</div>
            <h2 className="font-display text-3xl font-bold tracking-tight mt-1">
              Ты победил {victory.oppName}
            </h2>

            {/* Rating delta */}
            <div className="mt-5 flex items-center justify-center gap-3">
              <span className="font-display text-2xl font-bold text-subtle line-through tabular-nums">
                {victory.prevRating}
              </span>
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 240, damping: 16 }}
                className="font-display text-4xl font-bold tabular-nums"
              >
                <RatingCounter value={victory.newRating} duration={1100} />
              </motion.span>
              <motion.span
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="rounded-full bg-orange/15 text-orange px-2 py-0.5 text-xs font-bold"
              >
                +{RATING_DELTA}
              </motion.span>
            </div>

            <div className="text-[11px] text-subtle mt-1">Рейтинг ELO</div>

            {/* League progress */}
            {(() => {
              const lp = leagueProgress(victory.newRating);
              const tint = `hsl(${lp.league.hue} 70% 55%)`;
              return (
                <div className="mt-5">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span style={{ color: tint }} className="font-medium">{lp.league.name}</span>
                    <span className="text-subtle">
                      {lp.toNext > 0 ? `+${lp.toNext} до следующей` : "Высшая лига"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-hairline overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: tint }}
                      initial={{ width: 0 }}
                      animate={{ width: `${lp.pct}%` }}
                      transition={{ duration: 1.1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              );
            })()}

            <button
              onClick={() => setVictory(null)}
              className="mt-6 w-full rounded-full bg-ink text-paper font-medium py-3 hover:opacity-90 transition-opacity"
            >
              Продолжить
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
