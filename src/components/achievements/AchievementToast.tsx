import { AnimatePresence, motion } from "framer-motion";
import type { Achievement, Rarity } from "@/lib/achievements";
import { RARITY_LABEL } from "@/lib/achievements";
import { Sparkles, X } from "lucide-react";

type Props = {
  queue: Achievement[];
  onDismiss: () => void;
};

const rarityRing: Record<Rarity, string> = {
  common:    "border-hairline",
  rare:      "border-[hsl(var(--glow)/0.5)]",
  epic:      "border-[hsl(var(--glow)/0.7)]",
  legendary: "border-[hsl(var(--glow))]",
};

const rarityShadow: Record<Rarity, string> = {
  common:    "0 20px 40px -12px hsl(0 0% 0% / 0.2)",
  rare:      "0 0 30px -2px hsl(var(--glow)/0.45), 0 20px 40px -12px hsl(0 0% 0% / 0.25)",
  epic:      "0 0 50px -4px hsl(var(--glow)/0.6), 0 25px 60px -15px hsl(0 0% 0% / 0.3)",
  legendary: "0 0 70px -4px hsl(var(--glow)/0.8), 0 30px 80px -10px hsl(0 0% 0% / 0.35), inset 0 0 30px -6px hsl(var(--glow)/0.4)",
};

export default function AchievementToast({ queue, onDismiss }: Props) {
  const a = queue[0];

  return (
    <div className="fixed top-4 right-4 z-[100] pointer-events-none w-[min(92vw,360px)]">
      <AnimatePresence mode="wait">
        {a && (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, x: 80, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95, transition: { duration: 0.25 } }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            style={{
              ["--glow" as string]: a.glow_color,
              boxShadow: rarityShadow[a.rarity],
            }}
            className={`pointer-events-auto rounded-2xl border ${rarityRing[a.rarity]} bg-card/90 backdrop-blur-xl p-4 relative overflow-hidden`}
          >
            {/* shimmer */}
            <motion.div
              aria-hidden
              className="absolute -inset-y-2 -inset-x-10 rotate-12 bg-gradient-to-r from-transparent via-[hsl(var(--paper)/0.5)] to-transparent"
              initial={{ x: "-120%" }}
              animate={{ x: "220%" }}
              transition={{ duration: 1.6, ease: "easeOut" }}
            />

            <button
              onClick={onDismiss}
              aria-label="Закрыть"
              className="absolute top-2 right-2 text-subtle hover:text-ink p-1 rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="relative flex items-start gap-3">
              <motion.div
                initial={{ scale: 0.5, rotate: -20 }}
                animate={{ scale: [0.5, 1.15, 1], rotate: [-20, 8, 0] }}
                transition={{ duration: 0.7 }}
                className="shrink-0 inline-flex items-center justify-center rounded-2xl h-14 w-14 text-3xl bg-background border border-[hsl(var(--glow)/0.5)]"
                style={{ boxShadow: `0 0 24px -4px hsl(var(--glow)/0.7)` }}
              >
                {a.icon}
              </motion.div>
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-subtle mb-0.5">
                  <Sparkles className="h-3 w-3" />
                  Достижение · {RARITY_LABEL[a.rarity]}
                </div>
                <div className="font-display font-bold text-base leading-tight">{a.title}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</div>
                {queue.length > 1 && (
                  <div className="text-[10px] text-subtle mt-2">+{queue.length - 1} ещё в очереди</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
