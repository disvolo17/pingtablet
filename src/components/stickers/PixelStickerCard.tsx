// Pixel-art collectible card for a single player sticker.
import { motion } from "framer-motion";
import type { PlayerLite, StickerCard } from "@/lib/stickers";
import { RARITY_LABEL } from "@/lib/stickers";

type Props = {
  card: StickerCard;
  player: PlayerLite | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  faded?: boolean;
  silhouette?: boolean;
  count?: number;
  onClick?: () => void;
  className?: string;
  shine?: boolean;
};

const SIZE_W = { xs: 64, sm: 92, md: 128, lg: 176 } as const;

const RARITY_COLORS: Record<string, { border: string; glow: string; label: string }> = {
  common:    { border: "#6b6760", glow: "rgba(107,103,96,0.4)",  label: "#9b9690" },
  rare:      { border: "#3b82f6", glow: "rgba(59,130,246,0.45)", label: "#60a5fa" },
  epic:      { border: "#8b5cf6", glow: "rgba(139,92,246,0.45)", label: "#a78bfa" },
  legendary: { border: "#f59e0b", glow: "rgba(245,158,11,0.5)",  label: "#fbbf24" },
  mythic:    { border: "#f43f5e", glow: "rgba(244,63,94,0.5)",   label: "#fb7185" },
};

export default function PixelStickerCard({
  card, player, size = "md", faded, silhouette, count, onClick, className, shine = true,
}: Props) {
  const w = SIZE_W[size];
  const h = Math.round(w * 4 / 3);
  const rc = RARITY_COLORS[card.rarity] ?? RARITY_COLORS.common;
  const isHolo = card.variant === "holo";
  const isGold = card.variant === "gold";
  const isSigned = card.variant === "signed";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={onClick ? { y: -3, scale: 1.03 } : undefined}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={`relative inline-block select-none ${onClick ? "cursor-pointer" : "cursor-default"} ${className ?? ""}`}
      style={{ width: w, height: h }}
      aria-label={player ? `@${player.handle}` : "Locked sticker"}
    >
      {/* Card frame */}
      <div
        className="absolute inset-0 rounded-[8px]"
        style={{
          background: silhouette
            ? "#1e1e1e"
            : "linear-gradient(180deg, #1a1a1a 0%, #111 100%)",
          border: silhouette
            ? "1px solid rgba(255,255,255,0.07)"
            : `1px solid ${rc.border}`,
          boxShadow: silhouette
            ? "none"
            : `0 0 16px -4px ${rc.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
          opacity: faded ? 0.3 : 1,
        }}
      />

      {/* Inner content */}
      <div
        className="absolute rounded-[5px] overflow-hidden flex flex-col"
        style={{ inset: 3, bottom: 3 }}
      >
        {/* Avatar zone */}
        <div
          className="relative flex items-center justify-center flex-1"
          style={{
            background: silhouette
              ? "#161616"
              : `linear-gradient(180deg, ${rc.glow} 0%, #111 100%)`,
          }}
        >
          {silhouette || !player ? (
            <span
              className="font-display"
              style={{ fontSize: w * 0.38, color: "rgba(255,255,255,0.15)" }}
              aria-hidden
            >?</span>
          ) : player.avatar_url ? (
            <img
              src={player.avatar_url}
              alt=""
              className="h-full w-full object-cover"
              style={{
                imageRendering: "pixelated" as const,
                filter: faded ? "grayscale(1) brightness(0.5)" : undefined,
              }}
            />
          ) : (
            <span
              className="font-display font-bold"
              style={{ fontSize: w * 0.42, color: rc.label }}
            >{(player.name || player.handle).slice(0, 1).toUpperCase()}</span>
          )}

          {/* Rarity top bar */}
          {!silhouette && (
            <div
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{ background: rc.border }}
            />
          )}

          {/* Holo shimmer */}
          {!silhouette && isHolo && shine && (
            <span
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "conic-gradient(from 0deg, hsl(0 100% 70% / 0.4), hsl(60 100% 70% / 0.4), hsl(120 100% 70% / 0.4), hsl(200 100% 70% / 0.4), hsl(280 100% 70% / 0.4), hsl(0 100% 70% / 0.4))",
                mixBlendMode: "color-dodge",
                animation: "holo-spin 6s linear infinite",
                opacity: 0.5,
              }}
            />
          )}

          {/* Gold shimmer */}
          {!silhouette && isGold && shine && (
            <span
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(110deg, transparent 30%, rgba(255,215,0,0.5) 45%, rgba(255,240,150,0.75) 50%, rgba(255,215,0,0.5) 55%, transparent 70%)",
                backgroundSize: "200% 100%",
                animation: "gold-shimmer 2.4s linear infinite",
                mixBlendMode: "screen",
              }}
            />
          )}

          {/* Signed mark */}
          {!silhouette && isSigned && (
            <span
              aria-hidden
              className="absolute font-display italic"
              style={{
                right: w * 0.06,
                bottom: w * 0.08,
                fontSize: w * 0.18,
                color: "#e8572a",
                transform: "rotate(-12deg)",
                textShadow: "0 1px 0 rgba(0,0,0,0.6)",
                pointerEvents: "none",
              }}
            >✎</span>
          )}
        </div>

        {/* Name strip */}
        <div
          className="flex flex-col items-center justify-center text-center shrink-0"
          style={{
            height: "36%",
            padding: `${w * 0.04}px ${w * 0.06}px`,
            background: "#0d0d0d",
            borderTop: silhouette ? "1px solid rgba(255,255,255,0.05)" : `1px solid ${rc.border}44`,
          }}
        >
          {silhouette ? (
            <div
              className="uppercase tracking-[0.18em]"
              style={{ fontSize: Math.max(7, w * 0.075), color: "rgba(255,255,255,0.2)" }}
            >Locked</div>
          ) : (
            <>
              <div
                className="font-display font-bold leading-tight truncate w-full"
                style={{ fontSize: Math.max(9, w * 0.115), color: "#f0ece4" }}
              >
                {player?.name ?? "—"}
              </div>
              <div
                className="uppercase tracking-[0.18em] truncate w-full"
                style={{ fontSize: Math.max(7, w * 0.07), color: rc.label, marginTop: 1 }}
              >
                @{player?.handle ?? "?"}
              </div>
              <div className="flex items-center justify-between w-full mt-auto pt-0.5">
                <span
                  className="font-mono tabular-nums"
                  style={{ fontSize: Math.max(7, w * 0.07), color: "rgba(255,255,255,0.4)" }}
                >
                  {player ? player.rating : "—"}
                </span>
                <span
                  className="font-mono uppercase tracking-widest"
                  style={{ fontSize: Math.max(6, w * 0.06), color: rc.label }}
                >
                  {RARITY_LABEL[card.rarity]}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Count badge */}
      {count && count > 1 && !silhouette && (
        <span
          className="absolute -top-1.5 -right-1.5 font-display font-bold rounded-full px-1.5 py-0.5 text-[10px]"
          style={{
            background: "#e8572a",
            color: "#fff",
            boxShadow: "0 0 0 2px #0d0d0d, 0 4px 10px -2px rgba(232,87,42,0.5)",
          }}
        >×{count}</span>
      )}
    </motion.button>
  );
}
