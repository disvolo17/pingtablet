// Listens for new sticker drops in the current player's inventory and shows a celebratory reveal.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer } from "@/lib/currentPlayer";
import PixelStickerCard from "@/components/stickers/PixelStickerCard";
import type { StickerCard, StickerInventoryRow, PlayerLite } from "@/lib/stickers";

type Drop = { inv: StickerInventoryRow; card: StickerCard; player: PlayerLite | null };

export default function StickerDropOverlay() {
  const [me] = useCurrentPlayer();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Drop[]>([]);
  const current = queue[0];

  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase
      .channel(`stickerdrop-${me.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sticker_inventory", filter: `owner_id=eq.${me.id}` },
        async (payload) => {
          const inv = payload.new as StickerInventoryRow;
          if (inv.seen) return;
          const { data: card } = await supabase.from("sticker_cards").select("*").eq("id", inv.card_id).maybeSingle();
          if (!card) return;
          const { data: player } = await supabase
            .from("players").select("id, handle, name, rating, avatar_url").eq("id", (card as StickerCard).player_id).maybeSingle();
          setQueue((q) => [...q, { inv, card: card as StickerCard, player: (player as PlayerLite) ?? null }]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me?.id]);

  const close = async () => {
    if (current) {
      void supabase.rpc("sticker_mark_seen", { _ids: [current.inv.id] });
    }
    setQueue((q) => q.slice(1));
  };

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] flex items-center justify-center p-4"
          style={{ background: "hsl(0 0% 0% / 0.8)", backdropFilter: "blur(14px)" }}
          onClick={close}
        >
          <div className="text-center" onClick={(e) => e.stopPropagation()}>
            <motion.p
              initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
              className="text-[10px] uppercase tracking-[0.3em] text-orange mb-2 inline-flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3" /> NEW STICKER
            </motion.p>
            <motion.div
              initial={{ rotateY: 180, scale: 0.5, opacity: 0 }}
              animate={{ rotateY: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className="mb-6 inline-block"
            >
              <PixelStickerCard card={current.card} player={current.player ?? undefined} size="lg" />
            </motion.div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={close}
                className="rounded-full hairline bg-card text-ink px-5 py-2 text-sm hover:bg-secondary transition-colors"
              >
                В инвентарь
              </button>
              <button
                onClick={() => { close(); navigate(me ? `/journal/${me.handle}` : "/"); }}
                className="rounded-full bg-orange text-paper px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Открыть журнал
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
