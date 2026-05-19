import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import type { Achievement, Rarity } from "@/lib/achievements";
import { RARITY_LABEL } from "@/lib/achievements";

type Props = {
  achievement: Achievement;
  unlockedAt?: string | null;
  onClick?: () => void;
};

const rarityIntensity: Record<Rarity, { glow: string; border: string; bg: string }> = {
  common:    { glow: "0 0 0 0 transparent",                                 border: "border-hairline",                       bg: "" },
  rare:      { glow: "0 0 24px -4px hsl(var(--glow)/0.35)",                 border: "border-[hsl(var(--glow)/0.4)]",         bg: "bg-[hsl(var(--glow)/0.04)]" },
  epic:      { glow: "0 0 32px -2px hsl(var(--glow)/0.55), 0 0 60px -10px hsl(var(--glow)/0.35)", border: "border-[hsl(var(--glow)/0.55)]", bg: "bg-[hsl(var(--glow)/0.07)]" },
  legendary: { glow: "0 0 40px -2px hsl(var(--glow)/0.7), 0 0 90px -10px hsl(var(--glow)/0.45), inset 0 0 24px -8px hsl(var(--glow)/0.4)", border: "border-[hsl(var(--glow)/0.7)]", bg: "bg-[hsl(var(--glow)/0.1)]" },
};

export default function AchievementCard({ achievement: a, unlockedAt, onClick }: Props) {
  const unlocked = !!unlockedAt;
  const r = rarityIntensity[a.rarity];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={unlocked ? { y: -3, scale: 1.02 } : { scale: 1.01 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      style={{ ["--glow" as string]: a.glow_color }}
      className={`relative text-left pt-card overflow-hidden p-4 border ${r.border} ${unlocked ? r.bg : "opacity-60"} transition-all`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ boxShadow: unlocked ? r.glow : "none" }}
      />
      {/* Shine for legendary */}
      {unlocked && a.rarity === "legendary" && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-x-10 -top-10 h-24 rotate-12 bg-gradient-to-r from-transparent via-[hsl(var(--paper)/0.6)] to-transparent"
          initial={{ x: "-120%" }}
          animate={{ x: "220%" }}
          transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut", repeatDelay: 1.5 }}
        />
      )}

      <div className="relative flex items-start gap-3">
        <div
          className={`shrink-0 inline-flex items-center justify-center rounded-xl border ${r.border} h-12 w-12 text-2xl ${
            unlocked ? "bg-card" : "bg-secondary grayscale"
          }`}
          style={unlocked && a.rarity !== "common" ? { boxShadow: `0 0 20px -4px hsl(var(--glow)/0.5)` } : undefined}
        >
          {unlocked ? a.icon : <Lock className="h-4 w-4 text-subtle" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`font-display font-bold text-sm leading-tight truncate ${unlocked ? "text-ink" : "text-subtle"}`}>
              {a.title}
            </h3>
            <span
              className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${r.border} ${
                unlocked ? "" : "text-subtle"
              }`}
            >
              {RARITY_LABEL[a.rarity]}
            </span>
          </div>
          <p className={`text-xs mt-1 line-clamp-2 ${unlocked ? "text-muted-foreground" : "text-subtle"}`}>
            {a.description}
          </p>
          {unlocked && unlockedAt && (
            <p className="text-[10px] text-subtle mt-1.5 font-mono">
              {new Date(unlockedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      </div>
    </motion.button>
  );
}
