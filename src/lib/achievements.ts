// Достижения: типы и палитра редкости.
export type Rarity = "common" | "rare" | "epic" | "legendary";

export type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  condition_type: string;
  condition_value: Record<string, unknown> | null;
  rarity: Rarity;
  glow_color: string; // HSL без hsl(), например "45 95% 55%"
  is_active: boolean;
  sort_order: number;
};

export type UserAchievement = {
  id: string;
  player_id: string;
  achievement_id: string;
  unlocked_at: string;
  progress: number;
};

export const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Обычное",
  rare: "Редкое",
  epic: "Эпическое",
  legendary: "Легендарное",
};

export const RARITY_RING: Record<Rarity, string> = {
  common: "ring-1 ring-hairline",
  rare: "ring-1 ring-[hsl(var(--ink)/0.2)]",
  epic: "ring-2 ring-[hsl(var(--ink)/0.35)]",
  legendary: "ring-2 ring-[hsl(var(--ink))]",
};

export const RARITY_ORDER: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

export const CONDITION_TYPES: { value: string; label: string; valueShape?: string }[] = [
  { value: "first_match",            label: "Первый матч" },
  { value: "win_streak",             label: "Серия побед подряд", valueShape: '{"n":3}' },
  { value: "tournament_place",       label: "Место в турнире (1/2/3)", valueShape: '{"place":1}' },
  { value: "tournaments_count",      label: "Сыграно турниров", valueShape: '{"n":10}' },
  { value: "tournaments_won_total",  label: "Выиграно турниров (всего)", valueShape: '{"n":5}' },
  { value: "tournament_streak",      label: "Турниров выиграно подряд", valueShape: '{"n":3}' },
  { value: "matches_per_day",        label: "Матчей за один день", valueShape: '{"n":6}' },
  { value: "locations_count",        label: "Разных локаций", valueShape: '{"n":3}' },
  { value: "win_at_location_kind",   label: "Победа в типе локации", valueShape: '{"kind":"bar"}' },
  { value: "beat_higher_rated",      label: "Победа над сильнее по рейтингу" },
  { value: "rating_growth",          label: "Рост рейтинга от 1000", valueShape: '{"n":100}' },
  { value: "manual",                 label: "Вручную (выдаёт админ)" },
];

export const LOCATION_KINDS: { value: string; label: string }[] = [
  { value: "bar",    label: "Бар" },
  { value: "park",   label: "Парк / улица" },
  { value: "club",   label: "Клуб" },
  { value: "hall",   label: "Зал" },
  { value: "office", label: "Офис" },
  { value: "other",  label: "Другое" },
];
