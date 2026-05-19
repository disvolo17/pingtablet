// Realtime watcher for the current player's unlocks → toast queue.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer } from "@/lib/currentPlayer";
import type { Achievement } from "@/lib/achievements";
import AchievementToast from "./AchievementToast";

// Tiny synthesized chime via WebAudio — no external file.
function playChime() {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const notes = [880, 1175, 1568];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t0 = now + i * 0.08;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.5);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch { /* ignore */ }
}

export default function AchievementsProvider() {
  const [me] = useCurrentPlayer();
  const [queue, setQueue] = useState<Achievement[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const initLoadedRef = useRef(false);

  // Pop the head of the queue after a delay
  useEffect(() => {
    if (queue.length === 0) return;
    const t = window.setTimeout(() => {
      setQueue((q) => q.slice(1));
    }, queue[0]?.rarity === "legendary" ? 6500 : 4500);
    return () => window.clearTimeout(t);
  }, [queue]);

  useEffect(() => {
    if (!me?.id) {
      seenRef.current = new Set();
      initLoadedRef.current = false;
      setQueue([]);
      return;
    }
    let cancelled = false;

    // Prime "seen" set with the player's existing unlocks so we only toast new ones.
    (async () => {
      const { data } = await supabase
        .from("user_achievements")
        .select("achievement_id")
        .eq("player_id", me.id);
      if (cancelled) return;
      seenRef.current = new Set(((data as { achievement_id: string }[]) ?? []).map((r) => r.achievement_id));
      initLoadedRef.current = true;
    })();

    const ch = supabase
      .channel(`ach-${me.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_achievements", filter: `player_id=eq.${me.id}` },
        async (payload) => {
          if (!initLoadedRef.current) return;
          const row = payload.new as { achievement_id: string };
          if (seenRef.current.has(row.achievement_id)) return;
          seenRef.current.add(row.achievement_id);
          const { data: ach } = await supabase
            .from("achievements")
            .select("*")
            .eq("id", row.achievement_id)
            .maybeSingle();
          if (ach) {
            setQueue((q) => [...q, ach as unknown as Achievement]);
            playChime();
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [me?.id]);

  return <AchievementToast queue={queue} onDismiss={() => setQueue((q) => q.slice(1))} />;
}
