// Sticker Journal — collection album + inventory + pack purchase.
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Sparkles, Trash2, X, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer } from "@/lib/currentPlayer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PixelStickerCard from "@/components/stickers/PixelStickerCard";
import {
  RARITY_ORDER, RARITY_LABEL, dustValue, PACK_PRICE,
  type StickerCard, type StickerInventoryRow, type StickerJournalRow, type PlayerLite, type Rarity,
} from "@/lib/stickers";

export default function Journal() {
  const { handle: handleParam } = useParams<{ handle: string }>();
  const [me] = useCurrentPlayer();
  const navigate = useNavigate();
  const [owner, setOwner] = useState<PlayerLite | null>(null);
  const [cards, setCards] = useState<StickerCard[]>([]);
  const [players, setPlayers] = useState<Record<string, PlayerLite>>({});
  const [journal, setJournal] = useState<StickerJournalRow[]>([]);
  const [inventory, setInventory] = useState<StickerInventoryRow[]>([]);
  const [points, setPoints] = useState<number>(0);
  const [shards, setShards] = useState<number>(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [opening, setOpening] = useState<StickerInventoryRow[] | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [activeRarity, setActiveRarity] = useState<Rarity | "all">("all");

  const targetHandle = handleParam ?? me?.handle;
  const isMine = !!me && !!owner && owner.id === me.id;

  const reloadCollection = async (ownerId: string) => {
    await supabase.rpc("sticker_ensure_all_cards");
    const [{ data: allCards }, { data: allPlayers }, { data: jr }, { data: pts }] = await Promise.all([
      supabase.from("sticker_cards").select("*"),
      supabase.from("players").select("id, handle, name, rating, avatar_url"),
      supabase.from("sticker_journal").select("*").eq("owner_id", ownerId),
      supabase.from("achievement_points").select("balance").eq("player_id", ownerId).maybeSingle(),
    ]);
    const map: Record<string, PlayerLite> = {};
    ((allPlayers as PlayerLite[]) ?? []).forEach((x) => { map[x.id] = x; });
    const cardsList = ((allCards as unknown as StickerCard[]) ?? []).filter((c) => map[c.player_id]);
    setCards(cardsList);
    setPlayers(map);
    setJournal((jr as unknown as StickerJournalRow[]) ?? []);
    setPoints((pts as { balance: number } | null)?.balance ?? 0);
  };

  useEffect(() => {
    if (!targetHandle) return;
    let cancelled = false;
    (async () => {
      const { data: p } = await supabase
        .from("players").select("id, handle, name, rating, avatar_url")
        .ilike("handle", targetHandle).maybeSingle();
      if (!p || cancelled) return;
      const ownerLite = p as PlayerLite;
      setOwner(ownerLite);
      document.title = `Журнал @${ownerLite.handle} — ПИНГ ТАБЛЕТ`;
      await reloadCollection(ownerLite.id);
    })();
    return () => { cancelled = true; };
  }, [targetHandle]);

  useEffect(() => {
    if (!owner || !me || owner.id !== me.id) { setInventory([]); setShards(0); return; }
    let cancelled = false;
    const load = async () => {
      const [{ data: inv }, { data: w }] = await Promise.all([
        supabase.from("sticker_inventory").select("*").eq("owner_id", me.id).order("acquired_at", { ascending: false }),
        supabase.from("sticker_wallet").select("shards").eq("owner_id", me.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setInventory((inv as unknown as StickerInventoryRow[]) ?? []);
      setShards((w as { shards: number } | null)?.shards ?? 0);
    };
    load();
    const ch = supabase
      .channel(`journal-${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sticker_inventory", filter: `owner_id=eq.${me.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "sticker_journal", filter: `owner_id=eq.${me.id}` }, async () => {
        const { data: jr } = await supabase.from("sticker_journal").select("*").eq("owner_id", me.id);
        if (!cancelled) setJournal((jr as unknown as StickerJournalRow[]) ?? []);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "achievement_points", filter: `player_id=eq.${me.id}` }, async () => {
        const { data: pts } = await supabase.from("achievement_points").select("balance").eq("player_id", me.id).maybeSingle();
        if (!cancelled) setPoints((pts as { balance: number } | null)?.balance ?? 0);
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [owner, me]);

  const placedIds = useMemo(() => new Set(journal.map((j) => j.card_id)), [journal]);

  const cardsByRarity = useMemo(() => {
    const m: Record<Rarity, StickerCard[]> = { common: [], rare: [], epic: [], legendary: [], mythic: [] };
    for (const c of cards) m[c.rarity].push(c);
    return m;
  }, [cards]);

  const inventoryGrouped = useMemo(() => {
    const map = new Map<string, StickerInventoryRow[]>();
    for (const i of inventory) {
      const arr = map.get(i.card_id) ?? [];
      arr.push(i);
      map.set(i.card_id, arr);
    }
    return map;
  }, [inventory]);

  const filteredCards = useMemo(() => {
    if (activeRarity === "all") return cards;
    return cardsByRarity[activeRarity];
  }, [activeRarity, cards, cardsByRarity]);

  const placeSticker = async (invId: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("sticker_place", { _inventory_id: invId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Наклейка в журнале!");
    if (navigator.vibrate) navigator.vibrate([8, 30, 12]);
  };

  const dustSticker = async (invId: string) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("sticker_dust_duplicate", { _inventory_id: invId });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`+${data} осколков`);
  };

  const buyPack = async () => {
    if (busy) return;
    if (!me) { toast.error("Войди чтобы открывать паки"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("sticker_buy_pack");
      if (error) { toast.error(error.message); setBusy(false); return; }
      if (owner) await reloadCollection(owner.id);
      const items = (data as unknown as StickerInventoryRow[]) ?? [];
      if (items.length === 0) { toast.error("Пак пуст — попробуй позже"); setBusy(false); return; }
      setOpening(items);
      setRevealed(0);
    } catch (e: any) {
      toast.error(e?.message ?? "Ошибка");
    }
    setBusy(false);
  };

  if (!owner) {
    return (
      <div className="container max-w-4xl pt-section-tight">
        <div className="h-10 w-48 rounded-xl animate-pulse mb-4" style={{background: "rgba(255,255,255,0.62)", backdropFilter: "saturate(180%) blur(16px)", WebkitBackdropFilter: "saturate(180%) blur(16px)"}} />
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {Array.from({length: 12}).map((_, i) => (
            <div key={i} className="rounded-xl animate-pulse" style={{background: "#161616", aspectRatio: "3/4"}} />
          ))}
        </div>
      </div>
    );
  }

  const totalCards = cards.length;
  const placedCount = journal.length;
  const pct = totalCards > 0 ? Math.round((placedCount / totalCards) * 100) : 0;

  const RARITY_COLORS: Record<Rarity, string> = {
    common: "#9b9690",
    rare: "#60a5fa",
    epic: "#a78bfa",
    legendary: "#f59e0b",
    mythic: "#f43f5e",
  };

  return (
    <div className="container max-w-4xl pt-section-tight pb-28">

      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display text-[40px] leading-[0.95] tracking-[1px]" style={{color: "#1a1a2e"}}>
          {isMine ? "Мой журнал" : `@${owner.handle}`}
        </h1>
        <p className="mt-1 text-[12px] uppercase tracking-[0.8px]" style={{color: "#6b7280"}}>
          Коллекция наклеек
        </p>
      </div>

      {/* Stats + actions bar */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        {/* Progress */}
        <div className="flex items-center gap-4">
          <div>
            <div className="font-display text-[28px] leading-none" style={{color: "#1a1a2e"}}>{placedCount}<span className="text-[16px] ml-1" style={{color: "#6b7280"}}>/{totalCards}</span></div>
            <div className="text-[11px] mt-0.5" style={{color: "#6b7280"}}>Собрано · {pct}%</div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 w-32 rounded-full overflow-hidden" style={{background: "rgba(0,0,0,0.03)"}}>
            <motion.div
              className="h-full rounded-full"
              style={{background: "#e8572a"}}
              initial={{width: 0}}
              animate={{width: `${pct}%`}}
              transition={{duration: 0.8, ease: [0.22, 1, 0.36, 1]}}
            />
          </div>
        </div>

        {/* Wallet + buttons */}
        {isMine && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-3 rounded-xl px-3 py-2 border" style={{background: "#161616", borderColor: "rgba(255,255,255,0.85)"}}>
              <div className="text-center">
                <div className="font-display text-[18px] tabular-nums leading-none" style={{color: "#1a1a2e"}}>{points}</div>
                <div className="text-[10px] uppercase tracking-[0.8px]" style={{color: "#6b7280"}}>очков</div>
              </div>
              <div className="w-px h-8" style={{background: "rgba(255,255,255,0.07)"}} />
              <div className="text-center">
                <div className="font-display text-[18px] tabular-nums leading-none" style={{color: "#1a1a2e"}}>{shards}</div>
                <div className="text-[10px] uppercase tracking-[0.8px]" style={{color: "#6b7280"}}>осколков</div>
              </div>
            </div>
            <button
              onClick={buyPack}
              disabled={busy || !me}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-opacity disabled:opacity-40"
              style={{background: "#e8572a", color: "#fff"}}
            >
              <Package className="h-4 w-4" /> Открыть пак · {PACK_PRICE}
            </button>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-medium border transition-opacity hover:opacity-70"
              style={{background: "#161616", borderColor: "rgba(255,255,255,0.85)", color: "#f0ece4"}}
            >
              <Sparkles className="h-4 w-4" style={{color: "#e8572a"}} />
              Инвентарь · {inventory.length}
            </button>
          </div>
        )}
      </div>

      {/* Rarity filter tabs */}
      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-none">
        {(["all", ...RARITY_ORDER] as const).map((rar) => {
          const isActive = activeRarity === rar;
          const count = rar === "all" ? cards.length : cardsByRarity[rar].length;
          return (
            <button
              key={rar}
              onClick={() => setActiveRarity(rar)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-all border shrink-0"
              style={{
                background: isActive ? (rar === "all" ? "#e8572a" : RARITY_COLORS[rar]) : "#161616",
                borderColor: isActive ? "transparent" : "rgba(255,255,255,0.07)",
                color: isActive ? "#fff" : "#9b9690",
              }}
            >
              {rar === "all" ? "Все" : RARITY_LABEL[rar]}
              <span className="opacity-60 text-[10px]">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        <AnimatePresence mode="popLayout">
          {filteredCards.map((c) => {
            const placed = placedIds.has(c.id);
            const owned = isMine && inventoryGrouped.has(c.id);
            const player = players[c.player_id];
            return (
              <motion.div
                key={c.id}
                layout
                initial={{opacity: 0, scale: 0.9}}
                animate={{opacity: 1, scale: 1}}
                exit={{opacity: 0, scale: 0.9}}
                transition={{duration: 0.2}}
              >
                <PixelStickerCard
                  card={c}
                  player={player}
                  size="sm"
                  silhouette={!placed}
                  faded={!placed && !owned}
                  onClick={() => player && navigate(`/p/${player.handle}`)}
                />
                {/* Owned badge if in inventory but not placed */}
                {owned && !placed && (
                  <div className="mt-1 text-center text-[10px] font-medium" style={{color: "#e8572a"}}>
                    Есть!
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredCards.length === 0 && (
        <div className="py-20 text-center" style={{color: "#6b7280"}}>
          <Lock className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-[14px]">Нет карточек в этой категории</p>
        </div>
      )}

      {/* Inventory drawer */}
      <AnimatePresence>
        {drawerOpen && isMine && (
          <motion.div
            initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-6"
            style={{background: "rgba(0,0,0,0.35)", backdropFilter: "blur(12px)"}}
            onClick={() => setDrawerOpen(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{y: 60, opacity: 0}} animate={{y: 0, opacity: 1}} exit={{y: 40, opacity: 0}}
              transition={{type: "spring", stiffness: 280, damping: 28}}
              className="w-full max-w-2xl rounded-2xl border overflow-hidden max-h-[80vh] flex flex-col"
              style={{background: "#161616", borderColor: "rgba(255,255,255,0.85)"}}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{borderColor: "rgba(255,255,255,0.85)"}}>
                <div>
                  <h3 className="font-semibold text-[16px]" style={{color: "#1a1a2e"}}>Инвентарь</h3>
                  <p className="text-[12px]" style={{color: "#6b7280"}}>{inventory.length} наклеек</p>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-full border transition-opacity hover:opacity-70"
                  style={{borderColor: "rgba(255,255,255,0.85)", color: "#9b9690"}}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Drawer body */}
              <div className="overflow-auto p-5">
                {inventory.length === 0 ? (
                  <div className="py-16 text-center" style={{color: "#6b7280"}}>
                    <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-[14px]">Пока пусто. Сыграй матч или открой пак.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    {Array.from(inventoryGrouped.entries()).map(([cardId, items]) => {
                      const card = cards.find((c) => c.id === cardId);
                      const player = card ? players[card.player_id] : undefined;
                      if (!card) return null;
                      const isDup = placedIds.has(cardId);
                      const inv = items[0];
                      return (
                        <div key={cardId} className="flex flex-col items-center gap-2">
                          <PixelStickerCard card={card} player={player} size="sm" count={items.length} />
                          {isDup ? (
                            <button
                              disabled={busy}
                              onClick={() => dustSticker(inv.id)}
                              className="w-full flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium border transition-opacity hover:opacity-70 disabled:opacity-40"
                              style={{background: "#1e1e1e", borderColor: "rgba(255,255,255,0.85)", color: "#9b9690"}}
                            >
                              <Trash2 className="h-3 w-3" /> +{dustValue(card.rarity, card.variant)}
                            </button>
                          ) : (
                            <button
                              disabled={busy}
                              onClick={() => placeSticker(inv.id)}
                              className="w-full rounded-lg py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                              style={{background: "#e8572a", color: "#fff"}}
                            >
                              Наклеить
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pack opening overlay */}
      <AnimatePresence>
        {opening && (
          <motion.div
            initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            style={{background: "rgba(0,0,0,0.45)", backdropFilter: "blur(16px)"}}
          >
            <div className="w-full max-w-2xl text-center">
              <p className="text-[11px] uppercase tracking-[0.3em] mb-1 font-medium" style={{color: "#e8572a"}}>Пак открыт</p>
              <h3 className="font-display text-[36px] mb-6" style={{color: "#1a1a2e"}}>
                {opening.length} новых наклейки
              </h3>
              <div className="flex items-center justify-center gap-5 flex-wrap mb-8">
                {opening.map((inv, i) => {
                  const card = cards.find((c) => c.id === inv.card_id);
                  const player = card ? players[card.player_id] : undefined;
                  const shown = i < revealed;
                  return (
                    <motion.div
                      key={inv.id}
                      initial={{rotateY: 180, scale: 0.7, opacity: 0}}
                      animate={shown
                        ? {rotateY: 0, scale: 1, opacity: 1}
                        : {rotateY: 180, scale: 0.85, opacity: 0.5}}
                      transition={{type: "spring", stiffness: 220, damping: 22}}
                    >
                      {card ? <PixelStickerCard card={card} player={player} size="md" /> : null}
                    </motion.div>
                  );
                })}
              </div>
              {revealed < opening.length ? (
                <button
                  onClick={() => setRevealed((r) => r + 1)}
                  className="rounded-full px-8 py-3 text-[14px] font-semibold transition-opacity hover:opacity-80"
                  style={{background: "#e8572a", color: "#fff"}}
                >
                  Открыть ({revealed}/{opening.length})
                </button>
              ) : (
                <button
                  onClick={() => { setOpening(null); setRevealed(0); setDrawerOpen(true); }}
                  className="rounded-full px-8 py-3 text-[14px] font-semibold border transition-opacity hover:opacity-70"
                  style={{background: "#161616", borderColor: "rgba(255,255,255,0.85)", color: "#f0ece4"}}
                >
                  В инвентарь →
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
