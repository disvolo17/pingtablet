// Sticker collection types and helpers.
export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";
export type Variant = "normal" | "holo" | "gold" | "signed";

export type StickerCard = {
  id: string;
  player_id: string;
  rarity: Rarity;
  variant: Variant;
  hue: number;
  created_at: string;
};

export type StickerInventoryRow = {
  id: string;
  owner_id: string;
  card_id: string;
  source: string;
  acquired_at: string;
  seen: boolean;
};

export type StickerJournalRow = {
  id: string;
  owner_id: string;
  card_id: string;
  placed_at: string;
};

export type StickerWallet = {
  owner_id: string;
  shards: number;
};

export type StickerTrade = {
  id: string;
  from_player_id: string;
  to_player_id: string;
  offered_inventory_id: string;
  requested_card_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
  responded_at: string | null;
};

export type PlayerLite = {
  id: string;
  handle: string;
  name: string;
  rating: number;
  avatar_url: string | null;
};

export const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary", "mythic"];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

export const RARITY_HUE: Record<Rarity, number> = {
  common: 0,
  rare: 220,
  epic: 280,
  legendary: 30,
  mythic: 340,
};

export function rarityColor(r: Rarity, lightness = 55, sat?: number) {
  const hue = RARITY_HUE[r];
  const s = sat ?? (r === "common" ? 0 : 78);
  return `hsl(${hue} ${s}% ${lightness}%)`;
}

export const PACK_PRICE = 10;

export const RARITY_DUST: Record<Rarity, number> = {
  common: 2,
  rare: 5,
  epic: 12,
  legendary: 30,
  mythic: 80,
};

export const VARIANT_MULT: Record<Variant, number> = {
  normal: 1,
  holo: 2,
  gold: 5,
  signed: 10,
};

export function dustValue(rarity: Rarity, variant: Variant) {
  return RARITY_DUST[rarity] * VARIANT_MULT[variant];
}
