// Pixel-art collectible card for a single player sticker.
import { motion } from "framer-motion";
import type { PlayerLite, StickerCard } from "@/lib/stickers";
import { rarityColor, RARITY_LABEL } from "@/lib/stickers";

type Props = {
  card: StickerCard;
  player: PlayerLite | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  faded?: boolean;     // for locked/silhouette state
  silhouette?: boolean;
  count?: number;
  onClick?: () => void;
  className?: string;
  shine?: boolean;
};

const SIZE_W = { xs: 64, sm: 92, md: 128, lg: 176 } as const;

export default function PixelStickerCard({
  card, player, size = "md", faded, silhouette, count, onClick, className, shine = true,
}: Props) {
  const w = SIZE_W[size];
  const h = Math.round(w * 4 / 3);
  const accent = rarityColor(card.rarity, 58);
  const accentDark = rarityColor(card.rarity, 32);
  const isHolo = card.variant === "holo";
  const isGold = card.variant === "gold";
  const isSigned = card.variant === "signed";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={onClick ? { y: -3, scale: 1.02 } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={`relative inline-block select-none ${onClick ? "cursor-pointer" : "cursor-default"} ${className ?? ""}`}
      style={{ width: w, height: h }}
      aria-label={player ? `@${player.handle}` : "Locked sticker"}
    >
      {/* Outer pixel border, rarity glow */}
      <div
        className="absolute inset-0 rounded-[6px]"
        style={{
          background: `linear-gradient(180deg, ${accent}, ${accentDark})`,
          boxShadow: silhouette
            ? "inset 0 0 0 2px hsl(var(--hairline))"
            : `0 0 0 2px hsl(0 0% 0% / 0.65), 0 0 22px -4px ${accent}, inset 0 -4px 0 0 hsl(0 0% 0% / 0.45), inset 0 3px 0 0 hsl(0 0% 100% / 0.25)`,
          opacity: faded ? 0.35 : 1,
        }}
      />

      {/* Inner card panel */}
      <div
        className="absolute rounded-[3px] overflow-hidden"
        style={{
          inset: 4,
          background: silhouette
            ? "hsl(var(--card))"
            : `linear-gradient(180deg, hsl(0 0% 96%), hsl(0 0% 88%))`,
        }}
      >
        {/* Avatar zone */}
        <div
          className="relative flex items-center justify-center"
          style={{ height: "62%", background: silhouette ? "hsl(var(--secondary))" : `${accent}22` }}
        >
          {silhouette || !player ? (
            <span
              className="font-display font-bold text-subtle"
              style={{ fontSize: w * 0.36 }}
              aria-hidden
            >?</span>
          ) : player.avatar_url ? (
            <img
              src={player.avatar_url}
              alt=""
              className="h-full w-full object-cover"
              style={{ imageRendering: "pixelated" as const, filter: faded ? "grayscale(1)" : undefined }}
            />
          ) : (
            <span
              className="font-display font-bold text-ink"
              style={{ fontSize: w * 0.42 }}
            >{(player.name || player.handle).slice(0, 1).toUpperCase()}</span>
          )}

          {/* Holographic shimmer */}
          {!silhouette && isHolo && shine && (
            <span
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "conic-gradient(from 0deg, hsl(0 100% 70% / 0.5), hsl(60 100% 70% / 0.5), hsl(120 100% 70% / 0.5), hsl(200 100% 70% / 0.5), hsl(280 100% 70% / 0.5), hsl(340 100% 70% / 0.5), hsl(0 100% 70% / 0.5))",
                mixBlendMode: "color-dodge",
                animation: "holo-spin 6s linear infinite",
                opacity: 0.55,
              }}
            />
          )}
          {!silhouette && isGold && shine && (
            <span
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(110deg, transparent 30%, hsl(45 100% 70% / 0.65) 45%, hsl(50 100% 85% / 0.85) 50%, hsl(45 100% 70% / 0.65) 55%, transparent 70%)",
                backgroundSize: "200% 100%",
                animation: "gold-shimmer 2.4s linear infinite",
                mixBlendMode: "screen",
              }}
            />
          )}
        </div>

        {/* Name strip */}
        <div
          className="absolute left-0 right-0 bottom-0 flex flex-col items-center justify-center text-center"
          style={{ height: "38%", padding: w * 0.04, background: silhouette ? "transparent" : "hsl(0 0% 8%)" }}
        >
          {silhouette ? (
            <div className="text-[8px] uppercase tracking-[0.18em] text-subtle">Locked</div>
          ) : (
            <>
              <div
                className="font-display font-bold leading-tight truncate w-full"
                style={{ fontSize: Math.max(9, w * 0.12), color: "hsl(0 0% 96%)" }}
              >
                {player?.name ?? "—"}
              </div>
              <div
                className="uppercase tracking-[0.22em] truncate w-full"
                style={{ fontSize: Math.max(7, w * 0.072), color: accent, marginTop: 1 }}
              >
                @{player?.handle ?? "?"}
              </div>
              <div className="flex items-center justify-between w-full mt-auto pt-1">
                <span className="font-mono tabular-nums" style={{ fontSize: Math.max(7, w * 0.07), color: "hsl(0 0% 70%)" }}>
                  {player ? player.rating : "—"}
                </span>
                <span className="font-mono uppercase tracking-widest" style={{ fontSize: Math.max(6, w * 0.06), color: accent }}>
                  {RARITY_LABEL[card.rarity]}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Signed mark */}
        {!silhouette && isSigned && (
          <span
            aria-hidden
            className="absolute font-display italic"
            style={{
              right: w * 0.06,
              top: h * 0.42,
              fontSize: w * 0.18,
              color: "hsl(var(--orange))",
              transform: "rotate(-12deg)",
              textShadow: "0 1px 0 hsl(0 0% 0% / 0.6)",
              pointerEvents: "none",
            }}
          >✎</span>
        )}
      </div>

      {/* Duplicate count badge */}
      {count && count > 1 && !silhouette && (
        <span
          className="absolute -top-1.5 -right-1.5 font-display font-bold rounded-full px-1.5 py-0.5 text-[10px]"
          style={{
            background: "hsl(var(--orange))",
            color: "hsl(0 0% 100%)",
            boxShadow: "0 0 0 2px hsl(0 0% 0%), 0 4px 10px -2px hsl(var(--orange) / 0.5)",
          }}
        >×{count}</span>
      )}
    </motion.button>
  );
}
