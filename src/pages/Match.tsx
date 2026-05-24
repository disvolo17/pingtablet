import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer } from "@/lib/currentPlayer";
import { Avatar } from "@/components/Layout";
import { motion } from "framer-motion";
import { Trophy, ArrowLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Player = {
  id: string;
  handle: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  avatar_url: string | null;
};

type Match = {
  id: string;
  tournament_id: string;
  round: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  created_at: string;
};

type Tournament = { id: string; name: string; location: string | null };

type Vote = { player_id: string; voter_id: string };

type H2H = { wins1: number; wins2: number };

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const [me] = useCurrentPlayer();
  const [match, setMatch] = useState<Match | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [p1, setP1] = useState<Player | null>(null);
  const [p2, setP2] = useState<Player | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [h2h, setH2h] = useState<H2H>({ wins1: 0, wins2: 0 });
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  const loadVotes = async (matchId: string) => {
    const { data } = await supabase
      .from("match_votes")
      .select("player_id, voter_id")
      .eq("match_id", matchId);
    setVotes((data as Vote[]) ?? []);
  };

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: m } = await supabase
        .from("matches")
        .select("*")
        .eq("id", id)
        .single();
      if (!m) { setLoading(false); return; }
      setMatch(m as Match);

      const { data: t } = await supabase
        .from("tournaments")
        .select("id, name, location")
        .eq("id", (m as Match).tournament_id)
        .single();
      setTournament(t as Tournament);

      const playerIds = [(m as Match).player1_id, (m as Match).player2_id].filter(Boolean) as string[];
      if (playerIds.length) {
        const { data: ps } = await supabase
          .from("players")
          .select("id, handle, name, rating, wins, losses, avatar_url")
          .in("id", playerIds);
        const map: Record<string, Player> = {};
        (ps as Player[] ?? []).forEach(p => map[p.id] = p);
        if ((m as Match).player1_id) setP1(map[(m as Match).player1_id!] ?? null);
        if ((m as Match).player2_id) setP2(map[(m as Match).player2_id!] ?? null);

        // H2H — все матчи между этими двумя игроками
        if (playerIds.length === 2) {
          const { data: allMatches } = await supabase
            .from("matches")
            .select("player1_id, player2_id, winner_id")
            .not("winner_id", "is", null)
            .or(`and(player1_id.eq.${playerIds[0]},player2_id.eq.${playerIds[1]}),and(player1_id.eq.${playerIds[1]},player2_id.eq.${playerIds[0]})`);
          let wins1 = 0, wins2 = 0;
          (allMatches ?? []).forEach((mm: any) => {
            if (mm.winner_id === (m as Match).player1_id) wins1++;
            else if (mm.winner_id === (m as Match).player2_id) wins2++;
          });
          setH2h({ wins1, wins2 });
        }
      }

      await loadVotes(id);
      setLoading(false);
    };
    load();

    // Realtime голоса
    const ch = supabase.channel(`match-votes-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_votes", filter: `match_id=eq.${id}` },
        () => loadVotes(id))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => {
    if (p1 && p2) document.title = `${p1.name} vs ${p2.name} — ПИНГ ТАБЛЕТ`;
  }, [p1, p2]);

  const votes1 = votes.filter(v => v.player_id === match?.player1_id).length;
  const votes2 = votes.filter(v => v.player_id === match?.player2_id).length;
  const totalVotes = votes1 + votes2;
  const myVote = me ? votes.find(v => v.voter_id === me.id) : null;

  const vote = async (playerId: string) => {
    if (!me) { toast.error("Войди чтобы голосовать"); return; }
    if (voting) return;
    setVoting(true);
    try {
      if (myVote) {
        if (myVote.player_id === playerId) {
          // Снять голос
          await supabase.from("match_votes").delete()
            .eq("match_id", id!).eq("voter_id", me.id);
          toast.success("Голос снят");
        } else {
          // Изменить голос
          await supabase.from("match_votes").delete()
            .eq("match_id", id!).eq("voter_id", me.id);
          await supabase.from("match_votes").insert({
            match_id: id!, player_id: playerId, voter_id: me.id
          });
          toast.success("Голос изменён");
        }
      } else {
        await supabase.from("match_votes").insert({
          match_id: id!, player_id: playerId, voter_id: me.id
        });
        toast.success("Голос принят!");
      }
    } catch {
      toast.error("Ошибка");
    }
    setVoting(false);
  };

  const roundLabel = (r: number, totalRounds: number) => {
    const fromEnd = totalRounds - r;
    if (fromEnd === 0) return "Финал";
    if (fromEnd === 1) return "Полуфинал";
    if (fromEnd === 2) return "1/4 финала";
    return `Раунд ${r}`;
  };

  if (loading) return (
    <div className="container max-w-xl pt-section-tight">
      <div className="h-48 rounded-2xl animate-pulse" style={{background: "rgba(255,255,255,0.62)", backdropFilter: "saturate(180%) blur(16px)", WebkitBackdropFilter: "saturate(180%) blur(16px)"}} />
    </div>
  );

  if (!match || !p1 || !p2) return (
    <div className="container max-w-xl pt-section-tight">
      <p style={{color: "#6b7280"}}>Матч не найден.</p>
    </div>
  );

  const winner = match.winner_id;

  return (
    <div className="container max-w-xl pt-section-tight space-y-4">
      {/* Назад */}
      {tournament && (
        <Link
          to={`/t/${tournament.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] transition-opacity hover:opacity-70"
          style={{color: "#6b7280"}}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {tournament.name}
        </Link>
      )}

      {/* Карточка матча */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden border"
        style={{background: "#161616", borderColor: "rgba(255,255,255,0.07)"}}
      >
        {/* Статус */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b" style={{borderColor: "rgba(255,255,255,0.85)"}}>
          <span className="text-[11px] font-medium uppercase tracking-[0.8px]" style={{color: "#6b7280"}}>
            {tournament ? roundLabel(match.round, 99) : `Раунд ${match.round}`}
          </span>
          {winner ? (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{background: "rgba(82,183,136,0.12)", color: "#52b788"}}>
              Завершён
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{color: "#e8572a"}}>
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{background: "#e8572a"}} />
              В игре
            </span>
          )}
        </div>

        {/* Игроки */}
        <div className="grid grid-cols-[1fr_auto_1fr]">
          {/* Игрок 1 */}
          <div className={`flex flex-col items-center gap-2 p-5 ${winner && winner !== p1.id ? "opacity-40" : ""}`}>
            <Avatar player={p1} size={56} />
            {winner === p1.id && (
              <span className="flex items-center gap-1 text-[11px] font-semibold" style={{color: "#c9a84c"}}>
                <Trophy className="h-3 w-3" /> Победа
              </span>
            )}
            <Link to={`/p/${p1.handle}`} className="text-[14px] font-semibold text-center hover:underline underline-offset-4" style={{color: "#1a1a2e"}}>
              {p1.name}
            </Link>
            <span className="text-[12px]" style={{color: "#6b7280"}}>@{p1.handle}</span>
            <span className="font-display text-[22px]" style={{color: "#1a1a2e"}}>{p1.rating}</span>
          </div>

          {/* VS */}
          <div className="flex items-center justify-center px-2">
            <span className="font-display text-[18px]" style={{color: "#6b7280"}}>VS</span>
          </div>

          {/* Игрок 2 */}
          <div className={`flex flex-col items-center gap-2 p-5 ${winner && winner !== p2.id ? "opacity-40" : ""}`}>
            <Avatar player={p2} size={56} />
            {winner === p2.id && (
              <span className="flex items-center gap-1 text-[11px] font-semibold" style={{color: "#c9a84c"}}>
                <Trophy className="h-3 w-3" /> Победа
              </span>
            )}
            <Link to={`/p/${p2.handle}`} className="text-[14px] font-semibold text-center hover:underline underline-offset-4" style={{color: "#1a1a2e"}}>
              {p2.name}
            </Link>
            <span className="text-[12px]" style={{color: "#6b7280"}}>@{p2.handle}</span>
            <span className="font-display text-[22px]" style={{color: "#1a1a2e"}}>{p2.rating}</span>
          </div>
        </div>
      </motion.div>

      {/* Голосование */}
      <div className="rounded-2xl border p-4 space-y-3" style={{background: "#161616", borderColor: "rgba(255,255,255,0.07)"}}>
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold" style={{color: "#1a1a2e"}}>Голосование</h2>
          <span className="text-[12px]" style={{color: "#6b7280"}}>{totalVotes} голосов</span>
        </div>

        {/* Прогресс бар */}
        {totalVotes > 0 && (
          <div className="h-1.5 rounded-full overflow-hidden" style={{background: "#1e1e1e"}}>
            <motion.div
              className="h-full rounded-full"
              style={{background: "linear-gradient(90deg, #e8572a, #f2763f)"}}
              initial={{ width: 0 }}
              animate={{ width: `${(votes1 / totalVotes) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {[
            { player: p1, voteCount: votes1, pid: p1.id },
            { player: p2, voteCount: votes2, pid: p2.id },
          ].map(({ player, voteCount, pid }) => {
            const isMyVote = myVote?.player_id === pid;
            const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            return (
              <button
                key={pid}
                onClick={() => vote(pid)}
                disabled={voting}
                className="rounded-xl p-3 text-left transition-all border"
                style={{
                  background: isMyVote ? "rgba(232,87,42,0.12)" : "#1e1e1e",
                  borderColor: isMyVote ? "#e8572a" : "rgba(255,255,255,0.07)",
                  cursor: voting ? "wait" : "pointer",
                }}
              >
                <div className="text-[13px] font-medium truncate" style={{color: "#1a1a2e"}}>{player.name}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[12px]" style={{color: "#6b7280"}}>{voteCount} голосов</span>
                  <span className="font-display text-[16px]" style={{color: isMyVote ? "#e8572a" : "#9b9690"}}>{pct}%</span>
                </div>
              </button>
            );
          })}
        </div>
        {!me && (
          <p className="text-[12px] text-center" style={{color: "#6b7280"}}>
            Войди чтобы проголосовать
          </p>
        )}
      </div>

      {/* Статистика игроков */}
      <div className="rounded-2xl border overflow-hidden" style={{background: "#161616", borderColor: "rgba(255,255,255,0.07)"}}>
        <div className="px-4 py-3 border-b" style={{borderColor: "rgba(255,255,255,0.85)"}}>
          <h2 className="text-[14px] font-semibold" style={{color: "#1a1a2e"}}>Статистика</h2>
        </div>

        {/* H2H */}
        <div className="px-4 py-3 border-b" style={{borderColor: "rgba(255,255,255,0.85)"}}>
          <div className="text-[11px] uppercase tracking-[0.8px] mb-2" style={{color: "#6b7280"}}>Личные встречи</div>
          <div className="grid grid-cols-3 text-center">
            <span className="font-display text-[24px]" style={{color: h2h.wins1 > h2h.wins2 ? "#e8572a" : "#f0ece4"}}>{h2h.wins1}</span>
            <span className="text-[12px] self-center" style={{color: "#6b7280"}}>побед</span>
            <span className="font-display text-[24px]" style={{color: h2h.wins2 > h2h.wins1 ? "#e8572a" : "#f0ece4"}}>{h2h.wins2}</span>
          </div>
          <div className="grid grid-cols-3 text-center mt-1">
            <span className="text-[11px] truncate" style={{color: "#6b7280"}}>{p1.name}</span>
            <span />
            <span className="text-[11px] truncate" style={{color: "#6b7280"}}>{p2.name}</span>
          </div>
        </div>

        {/* Общая статистика */}
        {[
          { label: "Рейтинг", v1: p1.rating, v2: p2.rating },
          { label: "Побед", v1: p1.wins, v2: p2.wins },
          { label: "Поражений", v1: p1.losses, v2: p2.losses },
          {
            label: "Винрейт",
            v1: p1.wins + p1.losses > 0 ? `${Math.round((p1.wins / (p1.wins + p1.losses)) * 100)}%` : "—",
            v2: p2.wins + p2.losses > 0 ? `${Math.round((p2.wins / (p2.wins + p2.losses)) * 100)}%` : "—",
          },
        ].map(({ label, v1, v2 }) => (
          <div key={label} className="grid grid-cols-3 items-center px-4 py-2.5 border-b last:border-0" style={{borderColor: "rgba(255,255,255,0.85)"}}>
            <span className="font-semibold text-[14px] tabular-nums" style={{color: "#1a1a2e"}}>{v1}</span>
            <span className="text-[11px] text-center uppercase tracking-[0.6px]" style={{color: "#6b7280"}}>{label}</span>
            <span className="font-semibold text-[14px] tabular-nums text-right" style={{color: "#1a1a2e"}}>{v2}</span>
          </div>
        ))}
      </div>

      {/* Ссылки на профили */}
      <div className="grid grid-cols-2 gap-2">
        {[p1, p2].map(p => (
          <Link
            key={p.id}
            to={`/p/${p.handle}`}
            className="rounded-xl p-3 border flex items-center justify-between transition-opacity hover:opacity-70"
            style={{background: "#161616", borderColor: "rgba(255,255,255,0.07)"}}
          >
            <span className="text-[13px] font-medium truncate" style={{color: "#1a1a2e"}}>@{p.handle}</span>
            <ChevronRight className="h-4 w-4 shrink-0" style={{color: "#e8572a"}} />
          </Link>
        ))}
      </div>
    </div>
  );
}
