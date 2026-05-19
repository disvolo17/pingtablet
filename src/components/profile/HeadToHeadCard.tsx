// Head-to-head: top opponents with W-L counts.
import { useMemo } from "react";
import { Link } from "react-router-dom";

type Match = { id: string; winner_id: string | null; player1_id: string | null; player2_id: string | null; is_bye: boolean };

export default function HeadToHeadCard({ playerId, matches, opponents }: {
  playerId: string;
  matches: Match[];
  opponents: Record<string, { name: string; handle: string }>;
}) {
  const stats = useMemo(() => {
    const map = new Map<string, { id: string; wins: number; losses: number }>();
    for (const m of matches) {
      if (m.is_bye || !m.winner_id) continue;
      const oppId = m.player1_id === playerId ? m.player2_id : m.player1_id;
      if (!oppId) continue;
      const cur = map.get(oppId) ?? { id: oppId, wins: 0, losses: 0 };
      if (m.winner_id === playerId) cur.wins++; else cur.losses++;
      map.set(oppId, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
      .slice(0, 6);
  }, [playerId, matches]);

  if (stats.length === 0) {
    return <p className="text-sm text-muted-foreground">Сыграй матчи — появится статистика против соперников.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {stats.map((s) => {
        const opp = opponents[s.id];
        const total = s.wins + s.losses;
        const wr = Math.round((s.wins / total) * 100);
        return (
          <Link
            key={s.id}
            to={opp ? `/p/${opp.handle}` : "#"}
            className="flex items-center justify-between gap-3 rounded-xl hairline bg-paper px-3 py-2.5 hover:bg-card transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{opp?.name ?? "Игрок"}</div>
              <div className="text-[11px] text-subtle truncate">@{opp?.handle ?? "—"} · {total} матчей</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-sm tabular-nums">
                <span className="text-ink">{s.wins}</span>
                <span className="text-subtle mx-0.5">—</span>
                <span className="text-subtle">{s.losses}</span>
              </span>
              <div className="w-14 text-right">
                <div className="text-[10px] text-subtle">winrate</div>
                <div className={`font-display text-sm font-bold tabular-nums ${wr >= 50 ? "text-orange" : "text-subtle"}`}>{wr}%</div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
