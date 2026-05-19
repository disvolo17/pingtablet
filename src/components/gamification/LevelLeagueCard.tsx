// Level + League card with animated XP/league progress bars.
import { motion } from "framer-motion";
import { Crown, Flame, Sparkles } from "lucide-react";
import { calcXP, getLeague, leagueProgress, levelFromXP } from "@/lib/gamification";
import RatingCounter from "./RatingCounter";

type Props = {
  rating: number;
  wins: number;
  achievementPoints?: number;
  streak?: number;
};

export default function LevelLeagueCard({ rating, wins, achievementPoints = 0, streak = 0 }: Props) {
  const xp = calcXP({ wins, achievementPoints, rating });
  const lvl = levelFromXP(xp);
  const lp = leagueProgress(rating);
  const league = getLeague(rating);
  const tint = `hsl(${league.hue} 70% 55%)`;

  return (
    <div className="pt-card pt-pad mb-8 overflow-hidden relative">
      {/* Ambient league tint */}
      <div
        aria-hidden
        className="absolute -top-20 -right-20 h-56 w-56 rounded-full blur-3xl opacity-30 pointer-events-none"
        style={{ background: tint }}
      />

      <div className="relative flex items-start justify-between gap-3 flex-wrap">
        {/* Level */}
        <div className="flex items-center gap-3 min-w-0">
          <motion.div
            initial={{ scale: 0.8, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 18 }}
            className="relative shrink-0 h-14 w-14 rounded-2xl hairline bg-paper flex items-center justify-center"
            style={{ boxShadow: `0 0 24px -8px ${tint}` }}
          >
            <span className="font-display text-xl font-bold tracking-tight">{lvl.level}</span>
            <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-orange" />
          </motion.div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] text-subtle">Уровень</div>
            <div className="font-display text-lg font-bold leading-tight truncate">
              <RatingCounter value={xp} /> <span className="text-subtle text-sm font-normal">XP</span>
            </div>
            <div className="text-[11px] text-subtle">До {lvl.level + 1} уровня · {lvl.toNext} XP</div>
          </div>
        </div>

        {/* League */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-right min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] text-subtle">Лига</div>
            <div className="font-display text-lg font-bold leading-tight truncate" style={{ color: tint }}>
              {league.name}
            </div>
            <div className="text-[11px] text-subtle">
              {lp.toNext > 0 ? `+${lp.toNext} рейтинга до следующей` : "Высшая лига"}
            </div>
          </div>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 18, delay: 0.05 }}
            className="shrink-0 h-14 w-14 rounded-2xl hairline bg-paper flex items-center justify-center"
            style={{ boxShadow: `0 0 24px -8px ${tint}` }}
          >
            <Crown className="h-6 w-6" style={{ color: tint }} />
          </motion.div>
        </div>
      </div>

      {/* XP bar */}
      <div className="relative mt-5">
        <div className="h-2 rounded-full bg-hairline overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-ink"
            initial={{ width: 0 }}
            animate={{ width: `${lvl.pct}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-subtle">
          <span>Lvl {lvl.level} · {lvl.intoLevel} / {lvl.spanLevel} XP</span>
          <span className="inline-flex items-center gap-1">
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 text-orange">
                <Flame className="h-3 w-3" /> Серия ×{streak}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* League bar */}
      <div className="relative mt-3">
        <div className="h-1.5 rounded-full bg-hairline overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: tint }}
            initial={{ width: 0 }}
            animate={{ width: `${lp.pct}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-subtle">
          <span>{league.name}</span>
          <span>Рейтинг {rating}</span>
        </div>
      </div>
    </div>
  );
}
