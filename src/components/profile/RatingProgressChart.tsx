// Rating progress over time — area chart derived from match history.
// Note: matches table doesn't store rating snapshot, so we reconstruct
// chronologically: start from current rating and walk backwards by ±25 per match.
import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";

type Match = { id: string; created_at: string; winner_id: string | null; player1_id: string | null; player2_id: string | null; is_bye: boolean };

const DELTA = 25;

export default function RatingProgressChart({ playerId, currentRating, matches }: { playerId: string; currentRating: number; matches: Match[] }) {
  const data = useMemo(() => {
    const played = matches
      .filter((m) => !m.is_bye && m.winner_id && (m.player1_id === playerId || m.player2_id === playerId))
      .slice() // copy
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Walk backward from current rating to compute starting rating, then forward to build series.
    let cursor = currentRating;
    for (let i = played.length - 1; i >= 0; i--) {
      cursor -= played[i].winner_id === playerId ? DELTA : -DELTA;
    }
    const series: { t: string; rating: number; label: string }[] = [
      { t: "start", rating: cursor, label: "Старт" },
    ];
    for (const m of played) {
      cursor += m.winner_id === playerId ? DELTA : -DELTA;
      series.push({
        t: m.id,
        rating: cursor,
        label: new Date(m.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }),
      });
    }
    return series;
  }, [playerId, currentRating, matches]);

  if (data.length < 2) {
    return <p className="text-sm text-muted-foreground">Сыграй больше матчей — здесь появится график рейтинга.</p>;
  }

  const start = data[0].rating;
  const peak = Math.max(...data.map((d) => d.rating));
  const low = Math.min(...data.map((d) => d.rating));
  const delta = currentRating - start;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Mini label="Начало" value={start} />
        <Mini label="Пик" value={peak} accent />
        <Mini label="Минимум" value={low} />
      </div>
      <div className="flex items-center gap-2 mb-2 text-xs">
        {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-orange" /> : <TrendingDown className="h-3.5 w-3.5 text-subtle" />}
        <span className="text-subtle">Изменение: </span>
        <span className={`font-medium tabular-nums ${delta >= 0 ? "text-orange" : "text-subtle"}`}>
          {delta >= 0 ? "+" : ""}{delta}
        </span>
      </div>
      <div className="h-48 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--orange))" stopOpacity={0.45} />
                <stop offset="100%" stopColor="hsl(var(--orange))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--subtle))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis domain={["dataMin - 30", "dataMax + 30"]} tick={{ fontSize: 10, fill: "hsl(var(--subtle))" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--hairline))", borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: "hsl(var(--subtle))" }}
              formatter={(v: number) => [v, "Рейтинг"]}
            />
            <Area type="monotone" dataKey="rating" stroke="hsl(var(--orange))" strokeWidth={2} fill="url(#ratingFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl hairline bg-paper px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-subtle">{label}</div>
      <div className={`font-display text-lg font-bold tabular-nums ${accent ? "text-orange" : ""}`}>{value}</div>
    </div>
  );
}
