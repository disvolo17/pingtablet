// Sticker Journal — collection album + inventory + pack purchase.
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Sparkles, Trash2, X } from "lucide-react";
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

  const targetHandle = handleParam ?? me?.handle;
  const isMine = !!me && !!owner && owner.id === me.id;

  const reloadCollection = async (ownerId: string) => {
    // Ensure every player in the system has a sticker card
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

  // Load owner + cards + collection state
  useEffect(() => {
    if (!targetHandle) return;
    let cancelled = false;
    (async () => {
      const { data: p } = await supabase
        .from("players")
        .select("id, handle, name, rating, avatar_url")
        .ilike("handle", targetHandle)
        .maybeSingle();
      if (!p || cancelled) return;
      const ownerLite = p as PlayerLite;
      setOwner(ownerLite);
      document.title = `Журнал @${ownerLite.handle} — ПИНГ ТАБЛЕТ`;
      await reloadCollection(ownerLite.id);
    })();
    return () => { cancelled = true; };
  }, [targetHandle]);

  // Load inventory + wallet (only if mine)
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
    setBusy(true);
    const { data, error } = await supabase.rpc("sticker_buy_pack");
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (owner) await reloadCollection(owner.id);
    setOpening((data as unknown as StickerInventoryRow[]) ?? []);
    setRevealed(0);
  };

  if (!owner) {
    return <div className="container py-20 text-center text-subtle">Загрузка журнала…</div>;
  }

  const totalCards = cards.length;
  const placedCount = journal.length;
  const pct = totalCards > 0 ? Math.round((placedCount / totalCards) * 100) : 0;

  return (
    <div className="container max-w-5xl pt-page pb-24">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-subtle mb-1">
            {isMine ? "Твой" : `@${owner.handle} —`} журнал наклеек
          </p>
          <h1 className="pt-display text-3xl md:text-5xl">Коллекция</h1>
          <p className="text-sm text-subtle mt-1">
            {placedCount} / {totalCards} собрано · {pct}%
          </p>
          <div className="mt-3 h-2 w-64 max-w-full rounded-full bg-hairline overflow-hidden">
            <motion.div
              className="h-full bg-orange"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
        {isMine && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-right text-xs">
              <div className="font-display text-xl font-bold tabular-nums">{points}</div>
              <div className="text-[10px] text-subtle uppercase tracking-widest">очков</div>
            </div>
            <div className="text-right text-xs">
              <div className="font-display text-xl font-bold tabular-nums">{shards}</div>
              <div className="text-[10px] text-subtle uppercase tracking-widest">осколков</div>
            </div>
            <Button onClick={buyPack} disabled={busy || points < PACK_PRICE} className="rounded-full">
              <Package className="h-4 w-4 mr-1.5" /> Пак · {PACK_PRICE}
            </Button>
            <Button variant="outline" onClick={() => setDrawerOpen(true)} className="rounded-full">
              <Sparkles className="h-4 w-4 mr-1.5" /> Инвентарь · {inventory.length}
            </Button>
          </div>
        )}
      </div>

      {/* Album by rarity */}
      <div className="space-y-8">
        {RARITY_ORDER.map((rar) => {
          const list = cardsByRarity[rar];
          if (list.length === 0) return null;
          return (
            <section key={rar}>
              <h2 className="font-display text-sm uppercase tracking-[0.2em] text-subtle mb-3">
                {RARITY_LABEL[rar]} <span className="text-ink/50">· {list.filter(c => placedIds.has(c.id)).length}/{list.length}</span>
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
                {list.map((c) => {
                  const placed = placedIds.has(c.id);
                  const owned = isMine && inventoryGrouped.has(c.id);
                  const player = players[c.player_id];
                  return (
                    <PixelStickerCard
                      key={c.id}
                      card={c}
                      player={player}
                      size="sm"
                      silhouette={!placed}
                      faded={!placed && !owned}
                      onClick={() => player && navigate(`/p/${player.handle}`)}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Inventory drawer */}
      <AnimatePresence>
        {drawerOpen && isMine && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-6"
            style={{ background: "hsl(var(--background) / 0.7)", backdropFilter: "blur(10px)" }}
            onClick={() => setDrawerOpen(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="w-full max-w-2xl pt-card pt-pad max-h-[80vh] overflow-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-subtle">Инвентарь</p>
                  <h3 className="font-display text-xl font-bold">{inventory.length} наклеек</h3>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-full hairline">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {inventory.length === 0 ? (
                <p className="text-sm text-subtle py-12 text-center">Пока пусто. Сыграй матч или открой пак.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
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
                          <Button
                            size="sm" variant="outline" disabled={busy}
                            onClick={() => dustSticker(inv.id)}
                            className="w-full rounded-full text-[11px] h-7"
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> +{dustValue(card.rarity, card.variant)}
                          </Button>
                        ) : (
                          <Button
                            size="sm" disabled={busy}
                            onClick={() => placeSticker(inv.id)}
                            className="w-full rounded-full text-[11px] h-7 bg-orange hover:bg-orange/90"
                          >
                            Наклеить
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pack opening overlay */}
      <AnimatePresence>
        {opening && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            style={{ background: "hsl(0 0% 0% / 0.85)", backdropFilter: "blur(14px)" }}
          >
            <div className="w-full max-w-2xl text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] text-orange mb-1">Пак открыт</p>
              <h3 className="font-display text-3xl font-bold mb-6" style={{ color: "hsl(0 0% 96%)" }}>3 новые наклейки</h3>
              <div className="flex items-center justify-center gap-4 flex-wrap mb-8">
                {opening.map((inv, i) => {
                  const card = cards.find((c) => c.id === inv.card_id);
                  const player = card ? players[card.player_id] : undefined;
                  const shown = i < revealed;
                  return (
                    <motion.div
                      key={inv.id}
                      initial={{ rotateY: 180, scale: 0.7, opacity: 0 }}
                      animate={shown ? { rotateY: 0, scale: 1, opacity: 1 } : { rotateY: 180, scale: 0.85, opacity: 0.6 }}
                      transition={{ type: "spring", stiffness: 220, damping: 22, delay: shown ? 0 : 0 }}
                    >
                      {card ? (
                        <PixelStickerCard card={card} player={player} size="md" />
                      ) : null}
                    </motion.div>
                  );
                })}
              </div>
              {revealed < opening.length ? (
                <Button onClick={() => setRevealed((r) => r + 1)} className="rounded-full">
                  Открыть ({revealed}/{opening.length})
                </Button>
              ) : (
                <Button onClick={() => { setOpening(null); setRevealed(0); setDrawerOpen(true); }} className="rounded-full bg-orange hover:bg-orange/90">
                  В инвентарь
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
