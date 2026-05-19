import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Achievement, Rarity, UserAchievement } from "@/lib/achievements";
import { RARITIES, RARITY_LABEL, RARITY_ORDER } from "@/lib/achievements";
import AchievementCard from "./AchievementCard";

type Props = {
  achievements: Achievement[];
  unlocks: UserAchievement[];
};

export default function AchievementsGrid({ achievements, unlocks }: Props) {
  const [filter, setFilter] = useState<Rarity | "all">("all");
  const [scope, setScope] = useState<"all" | "unlocked" | "locked">("all");

  const unlockedMap = useMemo(() => {
    const m: Record<string, string> = {};
    unlocks.forEach((u) => (m[u.achievement_id] = u.unlocked_at));
    return m;
  }, [unlocks]);

  const sorted = useMemo(() => {
    return [...achievements].sort((a, b) => {
      const au = unlockedMap[a.id] ? 1 : 0;
      const bu = unlockedMap[b.id] ? 1 : 0;
      if (au !== bu) return bu - au; // unlocked first
      const r = RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
      if (r !== 0) return r;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [achievements, unlockedMap]);

  const filtered = sorted.filter((a) => {
    if (filter !== "all" && a.rarity !== filter) return false;
    if (scope === "unlocked" && !unlockedMap[a.id]) return false;
    if (scope === "locked" && unlockedMap[a.id]) return false;
    return true;
  });

  const total = achievements.length;
  const unlockedCount = Object.keys(unlockedMap).length;

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-xs uppercase tracking-widest text-subtle">Достижения</h2>
          <p className="font-display text-2xl font-bold tabular-nums leading-none mt-1">
            {unlockedCount}<span className="text-subtle">/{total}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pills
            value={scope}
            onChange={(v) => setScope(v as typeof scope)}
            options={[
              ["all", "Все"],
              ["unlocked", "Получены"],
              ["locked", "Закрыты"],
            ]}
          />
          <Pills
            value={filter}
            onChange={(v) => setFilter(v as typeof filter)}
            options={[
              ["all", "★"],
              ...RARITIES.map((r) => [r, RARITY_LABEL[r]] as [string, string]),
            ]}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">По фильтрам ничего нет.</p>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {filtered.map((a, i) => (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.025, 0.4), duration: 0.35 }}
            >
              <AchievementCard achievement={a} unlockedAt={unlockedMap[a.id] ?? null} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function Pills({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="inline-flex rounded-full hairline bg-card p-0.5 text-xs">
      {options.map(([k, l]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`px-3 py-1 rounded-full transition-colors ${
            value === k ? "bg-ink text-paper" : "text-subtle hover:text-ink"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
