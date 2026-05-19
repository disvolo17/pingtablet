// Pre-match win probability — classic ELO formula with handicap blend.
// Lets the user pick an opponent from a search list.
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Opp = { id: string; handle: string; name: string; rating: number; handicap: number; avatar_url: string | null };

function eloProbability(r1: number, r2: number) {
  return 1 / (1 + Math.pow(10, (r2 - r1) / 400));
}

export default function WinProbabilityCard({ player }: { player: { id: string; rating: number; handicap: number } }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Opp[]>([]);
  const [opp, setOpp] = useState<Opp | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    (async () => {
      const sb = supabase.from("players").select("id, handle, name, rating, handicap, avatar_url").neq("id", player.id);
      const { data } = q
        ? await sb.or(`name.ilike.%${q}%,handle.ilike.%${q}%`).order("rating", { ascending: false }).limit(8)
        : await sb.order("rating", { ascending: false }).limit(8);
      if (!cancelled) setResults((data as Opp[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [query, player.id]);

  const prob = useMemo(() => {
    if (!opp) return null;
    // Effective rating includes handicap (each handicap point ≈ 1 rating point of advantage).
    const r1 = player.rating + (player.handicap || 0);
    const r2 = opp.rating + (opp.handicap || 0);
    return Math.round(eloProbability(r1, r2) * 100);
  }, [player, opp]);

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти соперника…"
          className="w-full rounded-xl hairline bg-paper pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange/40"
        />
      </div>

      {/* Opponent list */}
      <div className="grid grid-cols-2 gap-2 mb-3 max-h-[180px] overflow-auto">
        {results.map((r) => {
          const active = opp?.id === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setOpp(r)}
              className={`text-left rounded-xl px-3 py-2 transition-colors ${
                active ? "bg-ink text-paper" : "hairline bg-paper hover:bg-card"
              }`}
            >
              <div className="text-xs font-medium truncate">{r.name}</div>
              <div className={`text-[10px] truncate ${active ? "text-paper/70" : "text-subtle"}`}>
                @{r.handle} · {r.rating}
              </div>
            </button>
          );
        })}
        {results.length === 0 && (
          <div className="col-span-2 text-xs text-subtle">Никого не нашли.</div>
        )}
      </div>

      {/* Probability gauge */}
      {opp && prob !== null ? (
        <div className="rounded-2xl hairline bg-paper p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-subtle inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-orange" /> Вероятность победы
            </div>
            <div className="text-[10px] text-subtle">vs <span className="text-ink font-medium">{opp.name}</span></div>
          </div>

          <div className="flex items-end justify-between mb-2">
            <motion.div
              key={prob}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 20 }}
              className="font-display text-5xl font-bold tracking-tight tabular-nums"
              style={{ color: prob >= 50 ? "hsl(var(--orange))" : "hsl(var(--ink))" }}
            >
              {prob}%
            </motion.div>
            <div className="text-right">
              <div className="text-[11px] text-subtle">Ты {player.rating}{player.handicap ? ` (${player.handicap >= 0 ? "+" : ""}${player.handicap})` : ""}</div>
              <div className="text-[11px] text-subtle">Соперник {opp.rating}{opp.handicap ? ` (${opp.handicap >= 0 ? "+" : ""}${opp.handicap})` : ""}</div>
            </div>
          </div>

          {/* Bar */}
          <div className="relative h-2 rounded-full bg-hairline overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${prob}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full"
              style={{ background: prob >= 50 ? "hsl(var(--orange))" : "hsl(var(--ink))" }}
            />
          </div>

          <p className="mt-3 text-xs text-subtle leading-snug">
            {prob >= 70 ? "Фаворит — но недооценивать соперника нельзя." :
             prob >= 50 ? "Лёгкое преимущество. Игра почти равная." :
             prob >= 30 ? "Соперник сильнее по рейтингу. Шанс на апсет есть." :
                          "Тёмная лошадка — победа здесь принесёт уважение."}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Выбери соперника, чтобы рассчитать шансы по ELO.</p>
      )}
    </div>
  );
}
