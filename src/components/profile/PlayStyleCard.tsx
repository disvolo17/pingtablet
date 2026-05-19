// AI-style insights & play style — derived from match data, no LLM call needed.
import { useMemo } from "react";
import { Brain, Flame, Shield, Sparkles, Swords, Target, Zap } from "lucide-react";

type Match = {
  id: string; created_at: string; winner_id: string | null;
  player1_id: string | null; player2_id: string | null; is_bye: boolean;
};

type Opp = { rating: number };

export default function PlayStyleCard({ player, matches, opponents }: {
  player: { id: string; rating: number; wins: number; losses: number };
  matches: Match[];
  opponents: Record<string, Opp>;
}) {
  const insight = useMemo(() => {
    const played = matches.filter((m) => !m.is_bye && m.winner_id);
    const total = played.length;
    const wins = played.filter((m) => m.winner_id === player.id).length;
    const wr = total ? wins / total : 0;

    let upsets = 0;
    let dominance = 0;
    for (const m of played) {
      const oppId = m.player1_id === player.id ? m.player2_id : m.player1_id;
      const opp = oppId ? opponents[oppId] : null;
      if (!opp) continue;
      if (m.winner_id === player.id && opp.rating > player.rating) upsets++;
      if (m.winner_id === player.id && opp.rating < player.rating - 100) dominance++;
    }

    let curStreak = 0;
    for (const m of played.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())) {
      if (m.winner_id === player.id) curStreak++; else break;
    }

    // Style label
    let style: { name: string; icon: typeof Brain; tint: string; desc: string };
    if (curStreak >= 3) style = { name: "Финишёр", icon: Flame, tint: "text-orange", desc: "В ударе — серия побед держится." };
    else if (upsets >= 2) style = { name: "Мастер апсетов", icon: Zap, tint: "text-orange", desc: "Бьёт игроков выше своего рейтинга." };
    else if (wr >= 0.65 && total >= 8) style = { name: "Стабильный", icon: Shield, tint: "text-ink", desc: "Высокий win-rate на длинной дистанции." };
    else if (dominance >= 3) style = { name: "Доминатор", icon: Swords, tint: "text-ink", desc: "Уверенно закрывает соперников ниже." };
    else if (total >= 6 && wr >= 0.45) style = { name: "Боец", icon: Target, tint: "text-subtle", desc: "Играет много, борется в каждом матче." };
    else style = { name: "Универсал", icon: Sparkles, tint: "text-subtle", desc: "Рисунок игры формируется." };

    // Quick insights
    const insights: string[] = [];
    if (curStreak >= 3) insights.push(`🔥 Серия из ${curStreak} побед — продолжай в том же духе.`);
    if (upsets >= 1) insights.push(`⚡ Обыграл ${upsets} ${upsets === 1 ? "соперника" : "соперников"} с более высоким рейтингом.`);
    if (total >= 5 && wr >= 0.6) insights.push(`📈 Win-rate ${Math.round(wr * 100)}% — сильнее среднего.`);
    if (dominance >= 2) insights.push(`👑 ${dominance} уверенных побед против слабее на 100+ рейтинга.`);
    if (insights.length === 0) insights.push("📊 Сыграй несколько матчей — появятся персональные инсайты.");

    return { style, insights, total, wr, curStreak, upsets };
  }, [player, matches, opponents]);

  const StyleIcon = insight.style.icon;

  return (
    <div>
      {/* Style banner */}
      <div className="relative rounded-2xl hairline bg-paper p-4 mb-3 overflow-hidden">
        <div aria-hidden className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-card hairline">
            <StyleIcon className={`h-5 w-5 ${insight.style.tint}`} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] text-subtle">Стиль игры</div>
            <div className="font-display text-xl font-bold tracking-tight">{insight.style.name}</div>
            <div className="text-xs text-subtle truncate">{insight.style.desc}</div>
          </div>
        </div>
      </div>

      {/* AI insights list */}
      <div className="rounded-2xl hairline bg-paper p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-3.5 w-3.5 text-orange" />
          <span className="text-[10px] uppercase tracking-[0.14em] text-subtle">AI инсайты</span>
        </div>
        <ul className="flex flex-col gap-2">
          {insight.insights.map((line, i) => (
            <li key={i} className="text-sm leading-snug text-foreground">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
