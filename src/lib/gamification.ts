// Pure gamification helpers — derive XP, level, league from existing data.
// No DB changes required: rating/wins/achievement_points already exist.

export const RATING_DELTA = 25; // win = +25, loss = -25 (см. core memory)

export type League = {
  key: "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master" | "champion";
  name: string;
  min: number;
  next: number | null;
  hue: number; // hsl hue for tinting
};

const LEAGUES: League[] = [
  { key: "bronze",   name: "Бронза",   min: 0,    next: 1000, hue: 25  },
  { key: "silver",   name: "Серебро",  min: 1000, next: 1100, hue: 220 },
  { key: "gold",     name: "Золото",   min: 1100, next: 1200, hue: 45  },
  { key: "platinum", name: "Платина",  min: 1200, next: 1300, hue: 190 },
  { key: "diamond",  name: "Алмаз",    min: 1300, next: 1450, hue: 200 },
  { key: "master",   name: "Мастер",   min: 1450, next: 1600, hue: 280 },
  { key: "champion", name: "Чемпион",  min: 1600, next: null, hue: 18  },
];

export function getLeague(rating: number): League {
  let res = LEAGUES[0];
  for (const l of LEAGUES) if (rating >= l.min) res = l;
  return res;
}

export function leagueProgress(rating: number) {
  const l = getLeague(rating);
  if (!l.next) return { league: l, pct: 100, toNext: 0 };
  const span = l.next - l.min;
  const pct = Math.max(0, Math.min(100, Math.round(((rating - l.min) / span) * 100)));
  return { league: l, pct, toNext: Math.max(0, l.next - rating) };
}

// XP combines wins, achievement points, rating gain over baseline.
export function calcXP(opts: { wins: number; achievementPoints?: number; rating: number }) {
  const { wins, achievementPoints = 0, rating } = opts;
  return wins * 100 + achievementPoints * 50 + Math.max(0, rating - 1000) * 2;
}

// Level curve — each level requires more XP. level n needs 250 * n*(n+1)/2 XP.
export function levelFromXP(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const curr = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const into = xp - curr;
  const span = next - curr;
  return {
    level,
    xp,
    intoLevel: into,
    spanLevel: span,
    pct: Math.max(0, Math.min(100, Math.round((into / span) * 100))),
    toNext: Math.max(0, next - xp),
  };
}

export function xpForLevel(n: number) {
  if (n <= 1) return 0;
  return 250 * ((n - 1) * n) / 2;
}
