import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import LevelLeagueCard from "@/components/gamification/LevelLeagueCard";
import RatingCounter from "@/components/gamification/RatingCounter";
import ExpandableSection from "@/components/profile/ExpandableSection";
import RatingProgressChart from "@/components/profile/RatingProgressChart";
import HeadToHeadCard from "@/components/profile/HeadToHeadCard";
import PlayStyleCard from "@/components/profile/PlayStyleCard";
import WinProbabilityCard from "@/components/profile/WinProbabilityCard";
import { Activity, Brain, LineChart as LineChartIcon, Target, Users, Sticker, Share2 as ShareIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Layout";
import AvatarUpload from "@/components/AvatarUpload";
import AchievementsGrid from "@/components/achievements/AchievementsGrid";
import MobileStickyCTA from "@/components/MobileStickyCTA";
import PixelStickerCard from "@/components/stickers/PixelStickerCard";
import type { StickerCard } from "@/lib/stickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, TrendingUp, Share2, Medal, Swords, Scale, Save, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { getCurrentPlayer } from "@/lib/currentPlayer";
import type { Achievement, UserAchievement } from "@/lib/achievements";

type PointsRow = { player_id: string; balance: number; lifetime_earned: number; lifetime_spent: number };


type Player = {
  id: string;
  handle: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  status: string;
  avatar_url: string | null;
  bio: string | null;
  handicap: number;
  created_at: string;
};

type MatchRow = {
  id: string;
  tournament_id: string;
  round: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  is_bye: boolean;
  created_at: string;
};

type TourMap = Record<string, { name: string; status: string }>;

export default function Profile() {
  const { handle } = useParams<{ handle: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [oppNames, setOppNames] = useState<Record<string, string>>({});
  const [oppData, setOppData] = useState<Record<string, { name: string; handle: string; rating: number }>>({});
  const [tours, setTours] = useState<TourMap>({});
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlocks, setUnlocks] = useState<UserAchievement[]>([]);
  const [stickerCard, setStickerCard] = useState<StickerCard | null>(null);
  const [journalCount, setJournalCount] = useState<number>(0);
  const [totalCards, setTotalCards] = useState<number>(0);
  const [points, setPoints] = useState<PointsRow | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!handle) return;
    const load = async () => {
      const { data: p } = await supabase
        .from("players")
        .select("id, handle, name, rating, wins, losses, status, avatar_url, bio, handicap, created_at")
        .ilike("handle", handle)
        .maybeSingle();
      if (!p) {
        setPlayer(null);
        return;
      }
      setPlayer(p as Player);
      document.title = `@${(p as Player).handle} — ПИНГ ТАБЛЕТ`;

      const [{ data: ms }, { count }] = await Promise.all([
        supabase
          .from("matches")
          .select("id, tournament_id, round, player1_id, player2_id, winner_id, is_bye, created_at")
          .or(`player1_id.eq.${(p as Player).id},player2_id.eq.${(p as Player).id}`)
          .eq("is_bye", false)
          .not("winner_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("players").select("id", { count: "exact", head: true }).gt("rating", (p as Player).rating),
      ]);

      const matchRows = (ms as MatchRow[]) ?? [];
      setMatches(matchRows);
      setGlobalRank((count ?? 0) + 1);

      const oppIds = Array.from(
        new Set(
          matchRows.flatMap((m) => [m.player1_id, m.player2_id]).filter((x): x is string => !!x && x !== (p as Player).id),
        ),
      );
      const tourIds = Array.from(new Set(matchRows.map((m) => m.tournament_id)));
      const [{ data: opps }, { data: ts }] = await Promise.all([
        oppIds.length
          ? supabase.from("players").select("id, name, handle, rating").in("id", oppIds)
          : Promise.resolve({ data: [] as { id: string; name: string; handle: string; rating: number }[] }),
        tourIds.length
          ? supabase.from("tournaments").select("id, name, status").in("id", tourIds)
          : Promise.resolve({ data: [] as { id: string; name: string; status: string }[] }),
      ]);
      const om: Record<string, string> = {};
      const od: Record<string, { name: string; handle: string; rating: number }> = {};
      (opps ?? []).forEach((o) => {
        om[o.id] = o.name;
        od[o.id] = { name: o.name, handle: o.handle, rating: o.rating };
      });
      setOppNames(om);
      setOppData(od);
      const tm: TourMap = {};
      (ts ?? []).forEach((t) => (tm[t.id] = { name: t.name, status: t.status }));
      setTours(tm);

      // Achievements
      const [{ data: achs }, { data: ua }] = await Promise.all([
        supabase.from("achievements").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("user_achievements").select("*").eq("player_id", (p as Player).id),
      ]);
      setAchievements((achs as unknown as Achievement[]) ?? []);
      setUnlocks((ua as unknown as UserAchievement[]) ?? []);

      // Sticker collection data
      const [{ data: card }, { count: jcount }, { count: tcount }, { data: pts }] = await Promise.all([
        supabase.from("sticker_cards").select("*").eq("player_id", (p as Player).id).maybeSingle(),
        supabase.from("sticker_journal").select("id", { count: "exact", head: true }).eq("owner_id", (p as Player).id),
        supabase.from("sticker_cards").select("id", { count: "exact", head: true }),
        supabase.from("achievement_points").select("*").eq("player_id", (p as Player).id).maybeSingle(),
      ]);
      setStickerCard((card as unknown as StickerCard) ?? null);
      setJournalCount(jcount ?? 0);
      setTotalCards(tcount ?? 0);
      setPoints((pts as unknown as PointsRow) ?? null);
    };
    load();
  }, [handle]);

  // Realtime: refresh unlocks when this player's achievements change
  useEffect(() => {
    if (!player?.id) return;
    const ch = supabase.channel(`profile-ach-${player.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "user_achievements", filter: `player_id=eq.${player.id}` },
        async () => {
          const { data: ua } = await supabase.from("user_achievements").select("*").eq("player_id", player.id);
          setUnlocks((ua as unknown as UserAchievement[]) ?? []);
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "achievement_points", filter: `player_id=eq.${player.id}` },
        async () => {
          const { data } = await supabase.from("achievement_points").select("*").eq("player_id", player.id).maybeSingle();
          if (data) setPoints(data as unknown as PointsRow);
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "sticker_journal", filter: `owner_id=eq.${player.id}` },
        async () => {
          const { count: jcount } = await supabase.from("sticker_journal").select("id", { count: "exact", head: true }).eq("owner_id", player.id);
          setJournalCount(jcount ?? 0);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [player?.id]);

  if (!handle) return null;
  if (player === null) {
    return (
      <div className="container max-w-2xl py-20 text-center">
        <p className="text-muted-foreground">Игрок @{handle} не найден.</p>
      </div>
    );
  }
  if (!player) return <div className="container py-20 text-muted-foreground">Загрузка…</div>;

  const total = player.wins + player.losses;
  const winRate = total > 0 ? Math.round((player.wins / total) * 100) : 0;
  

  const shareProfile = async () => {
    const url = `${window.location.origin}/p/${player.handle}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `@${player.handle}`, text: `Рейтинг ${player.rating} на ПИНГ ТАБЛЕТ`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Ссылка скопирована");
      }
    } catch { /* cancelled */ }
  };

  return (
    <div className="container max-w-3xl pt-page">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 sm:gap-4 mb-6 md:mb-10 min-w-0">
        <Avatar player={player} size={64} />
        {stickerCard && (
          <div className="shrink-0">
            <PixelStickerCard
              card={stickerCard}
              player={{ id: player.id, handle: player.handle, name: player.name, rating: player.rating, avatar_url: player.avatar_url }}
              size="sm"
              onClick={() => navigate(`/journal/${player.handle}`)}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <h1 className="pt-display text-2xl sm:text-3xl md:text-5xl truncate">{player.name}</h1>
            <p className="text-subtle text-xs sm:text-sm truncate">@{player.handle} · {player.status || "Игрок"}</p>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {getCurrentPlayer()?.id === player.id && (
              <AvatarUpload
                playerId={player.id}
                handle={player.handle}
                onChanged={(url) => setPlayer({ ...player, avatar_url: url })}
              />
            )}
            <Button variant="outline" size="sm" onClick={shareProfile} className="rounded-full h-8">
              <Share2 className="h-3.5 w-3.5 mr-1.5" /> Поделиться
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Sticker Journal block */}
      <Link
        to={`/journal/${player.handle}`}
        className="mb-8 block pt-card pt-pad hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-orange/15 text-orange shrink-0">
            <Sticker className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-subtle">Журнал наклеек</div>
            <div className="font-display text-xl md:text-2xl font-bold mt-0.5 truncate">
              {journalCount} <span className="text-subtle font-normal text-base">/ {totalCards} собрано</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-hairline overflow-hidden">
              <div
                className="h-full bg-orange transition-all"
                style={{ width: `${totalCards > 0 ? Math.round((journalCount / totalCards) * 100) : 0}%` }}
              />
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-2xl font-bold tabular-nums">{points?.balance ?? 0}</div>
            <div className="text-[10px] text-subtle uppercase tracking-widest">очков</div>
          </div>
        </div>
      </Link>


      {/* Gamification: level + league + XP */}
      <LevelLeagueCard
        rating={player.rating}
        wins={player.wins}
        achievementPoints={points?.lifetime_earned ?? 0}
        streak={(() => {
          let s = 0;
          for (const m of matches) {
            if (m.winner_id === player.id) s++; else break;
          }
          return s;
        })()}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Рейтинг" valueNode={<RatingCounter value={player.rating} />} icon={TrendingUp} />
        <Stat label="В мире" value={globalRank ? `#${globalRank}` : "—"} icon={Trophy} />
        <Stat label="Побед" value={String(player.wins)} icon={Swords} />
        <Stat label="Победы %" value={total ? `${winRate}%` : "—"} icon={Medal} />
      </div>

      {/* Handicap (Фора) */}
      <HandicapCard
        player={player}
        canEdit={getCurrentPlayer()?.id === player.id}
        onChanged={(h) => setPlayer({ ...player, handicap: h })}
      />

      {/* Premium expandable sections */}
      <div className="mb-8">
        <ExpandableSection
          title="График прогресса"
          eyebrow="Динамика"
          icon={<LineChartIcon className="h-4 w-4 text-orange" />}
          defaultOpen
        >
          <RatingProgressChart playerId={player.id} currentRating={player.rating} matches={matches} />
        </ExpandableSection>

        <ExpandableSection
          title="Стиль игры и AI инсайты"
          eyebrow="Аналитика"
          icon={<Brain className="h-4 w-4 text-orange" />}
        >
          <PlayStyleCard player={player} matches={matches} opponents={oppData} />
        </ExpandableSection>

        <ExpandableSection
          title="Вероятность победы"
          eyebrow="Перед матчем"
          icon={<Target className="h-4 w-4 text-orange" />}
        >
          <WinProbabilityCard player={player} />
        </ExpandableSection>

        <ExpandableSection
          title="Против соперников"
          eyebrow="Head-to-head"
          icon={<Users className="h-4 w-4 text-orange" />}
        >
          <HeadToHeadCard
            playerId={player.id}
            matches={matches}
            opponents={Object.fromEntries(
              Object.entries(oppData).map(([id, v]) => [id, { name: v.name, handle: v.handle }]),
            )}
          />
        </ExpandableSection>
      </div>

      {/* Achievements */}
      <div className="mb-10">
        <AchievementsGrid achievements={achievements} unlocks={unlocks} />
      </div>

      {/* Match history */}
      <ExpandableSection
        title="История матчей"
        eyebrow="Все игры"
        icon={<Activity className="h-4 w-4 text-orange" />}
        defaultOpen
        rightSlot={<span className="text-[11px] text-subtle">{matches.length}</span>}
      >
        <MatchHistory player={player} matches={matches} oppNames={oppNames} tours={tours} />
      </ExpandableSection>

      {getCurrentPlayer()?.id === player.id ? (
        <MobileStickyCTA
          label="Открыть журнал"
          icon={<Sticker className="h-4 w-4" />}
          onClick={() => navigate(`/journal/${player.handle}`)}
        />
      ) : (
        <MobileStickyCTA
          label="Поделиться профилем"
          icon={<ShareIcon className="h-4 w-4" />}
          variant="outline"
          onClick={shareProfile}
        />
      )}
    </div>
  );
}

function MatchHistory({
  player,
  matches,
  oppNames,
  tours,
}: {
  player: Player;
  matches: MatchRow[];
  oppNames: Record<string, string>;
  tours: TourMap;
}) {
  const [tourFilter, setTourFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<"all" | "win" | "loss">("all");

  const tourOptions = Object.entries(tours);
  const filtered = matches.filter((m) => {
    if (tourFilter !== "all" && m.tournament_id !== tourFilter) return false;
    const won = m.winner_id === player.id;
    if (resultFilter === "win" && !won) return false;
    if (resultFilter === "loss" && won) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-xs uppercase tracking-widest text-subtle">История матчей</h2>
        <span className="text-[11px] text-subtle">{filtered.length} из {matches.length}</span>
      </div>

      {matches.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="inline-flex rounded-full hairline bg-card p-0.5 text-xs">
            {([
              ["all", "Все"],
              ["win", "Победы"],
              ["loss", "Поражения"],
            ] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setResultFilter(k)}
                className={`px-3 py-1 rounded-full transition-colors ${
                  resultFilter === k ? "bg-ink text-paper" : "text-subtle hover:text-ink"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          {tourOptions.length > 1 && (
            <select
              value={tourFilter}
              onChange={(e) => setTourFilter(e.target.value)}
              className="text-xs rounded-full hairline bg-card px-3 py-1 outline-none cursor-pointer max-w-[60vw]"
            >
              <option value="all">Все турниры</option>
              {tourOptions.map(([id, t]) => (
                <option key={id} value={id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {matches.length === 0 ? (
        <p className="text-muted-foreground text-sm">Сыгранных матчей пока нет.</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">По фильтрам ничего не найдено.</p>
      ) : (
        <div className="pt-card divide-y divide-hairline overflow-hidden">
          {filtered.map((m) => {
            const opp = m.player1_id === player.id ? m.player2_id : m.player1_id;
            const won = m.winner_id === player.id;
            const oppName = opp ? oppNames[opp] ?? "—" : "—";
            const tour = tours[m.tournament_id];
            const shareMatch = async (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              const url = `${window.location.origin}/t/${m.tournament_id}`;
              const text = won
                ? `🏓 Победа над ${oppName} на «${tour?.name ?? "турнире"}» — @${player.handle} (${player.rating})`
                : `🏓 Бой с ${oppName} на «${tour?.name ?? "турнире"}» — @${player.handle} (${player.rating})`;
              try {
                if (navigator.share) await navigator.share({ title: "ПИНГ ТАБЛЕТ", text, url });
                else {
                  await navigator.clipboard.writeText(`${text}\n${url}`);
                  toast.success("Скопировано");
                }
              } catch { /* cancelled */ }
            };
            return (
              <Link
                key={m.id}
                to={`/t/${m.tournament_id}`}
                className="flex items-center justify-between p-4 hover:bg-secondary/40 transition-colors"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <span
                    className={`shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full text-[10px] font-display font-bold ${
                      won ? "bg-ink text-paper" : "hairline bg-card text-subtle"
                    }`}
                  >
                    {won ? "П" : "ПР"}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm truncate">
                      {won ? "Победа над" : "Поражение от"} <span className="font-medium">{oppName}</span>
                    </div>
                    <div className="text-[11px] text-subtle truncate">
                      {tour?.name ?? "Турнир"} · раунд {m.round} · {new Date(m.created_at).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className={`font-mono text-sm ${won ? "text-ink" : "text-subtle"}`}>
                    {won ? "+25" : "−25"}
                  </span>
                  <button
                    onClick={shareMatch}
                    aria-label="Поделиться матчем"
                    className="text-subtle hover:text-ink p-1"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, valueNode, icon: Icon }: { label: string; value?: string; valueNode?: React.ReactNode; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="pt-card pt-pad-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-subtle">{label}</span>
        <Icon className="h-3.5 w-3.5 text-subtle" />
      </div>
      <div className="font-display text-2xl md:text-3xl font-bold tabular-nums">{valueNode ?? value}</div>
    </div>
  );
}

function computeMedals(p: Player): string[] {
  const medals: string[] = [];
  if (p.wins >= 1) medals.push("🏓 Первая победа");
  if (p.wins >= 5) medals.push("🔥 5 побед");
  if (p.wins >= 25) medals.push("👑 25 побед");
  if (p.rating >= 1100) medals.push("📈 1100+ рейтинга");
  if (p.rating >= 1300) medals.push("⭐ 1300+ рейтинга");
  if (p.wins + p.losses >= 10) medals.push("⚡ Ветеран (10+ матчей)");
  return medals;
}

function HandicapCard({
  player,
  canEdit,
  onChanged,
}: {
  player: Player;
  canEdit: boolean;
  onChanged: (handicap: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(String(player.handicap ?? 0));
  const [busy, setBusy] = useState(false);

  const start = () => {
    setValue(String(player.handicap ?? 0));
    setEditing(true);
  };

  const save = async () => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < -50 || n > 50) {
      toast.error("Фора: число от -50 до 50");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("set_player_handicap", {
        _player_id: player.id,
        _handicap: n,
      });
      if (error) throw error;
      const updated = (data as unknown as { handicap: number }) ?? null;
      const newH = updated?.handicap ?? n;
      onChanged(newH);
      setEditing(false);
      toast.success("Фора обновлена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const h = player.handicap ?? 0;
  const display = h === 0 ? "0" : h > 0 ? `+${h}` : String(h);

  return (
    <div className="pt-card pt-pad-sm mb-8 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full hairline bg-card">
          <Scale className="h-4 w-4 text-subtle" />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-subtle">Фора</div>
          {editing ? (
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="number"
                min={-50}
                max={50}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-9 w-24 tabular-nums"
                autoFocus
              />
            </div>
          ) : (
            <div className="font-display text-2xl font-bold tabular-nums">{display}</div>
          )}
          <div className="text-[11px] text-subtle mt-0.5">
            {h === 0
              ? "Без форы — соперники играют на равных."
              : h > 0
              ? "Соперник получает фору перед матчем."
              : "Ты даёшь фору сопернику."}
          </div>
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="rounded-full">
                <X className="h-4 w-4 mr-1" /> Отмена
              </Button>
              <Button size="sm" onClick={save} disabled={busy} className="rounded-full">
                <Save className="h-4 w-4 mr-1" /> Сохранить
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={start} className="rounded-full">
              Изменить
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
