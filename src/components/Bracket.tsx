import { motion } from "framer-motion";

type Player = { id: string; name: string; handicap?: number | null; is_guest?: boolean | null };
export type BracketMatch = {
  id: string;
  round: number;
  position: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  is_bye: boolean;
};

export default function Bracket({
  matches,
  players,
  onPickWinner,
  onUndo,
  isAdmin = false,
}: {
  matches: BracketMatch[];
  players: Record<string, Player>;
  onPickWinner?: (matchId: string, winnerId: string) => void;
  onUndo?: (matchId: string) => void;
  isAdmin?: boolean;
}) {
  if (matches.length === 0) {
    return <p className="text-muted-foreground">Сетка ещё не сгенерирована.</p>;
  }
  const rounds: Record<number, BracketMatch[]> = {};
  for (const m of matches) {
    rounds[m.round] = rounds[m.round] ?? [];
    rounds[m.round].push(m);
  }
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const totalRounds = roundNumbers.length;

  const roundLabel = (r: number) => {
    const fromEnd = totalRounds - r;
    if (fromEnd === 0) return "Финал";
    if (fromEnd === 1) return "Полуфинал";
    if (fromEnd === 2) return "1/4 финала";
    return `Раунд ${r}`;
  };

  return (
    <div className="overflow-x-auto -mx-4 px-4 pb-4">
      <div className="inline-flex gap-6 min-w-full">
        {roundNumbers.map((r) => {
          const ms = rounds[r].sort((a, b) => a.position - b.position);
          // vertical spacing grows per round so connectors align
          const gap = 16 * Math.pow(2, r - 1);
          return (
            <div key={r} className="flex flex-col" style={{ gap }}>
              <div className="text-xs uppercase tracking-widest text-subtle mb-2">{roundLabel(r)}</div>
              {ms.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  players={players}
                  isAdmin={isAdmin}
                  onPickWinner={onPickWinner}
                  onUndo={onUndo}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  players,
  isAdmin,
  onPickWinner,
  onUndo,
}: {
  match: BracketMatch;
  players: Record<string, Player>;
  isAdmin: boolean;
  onPickWinner?: (matchId: string, winnerId: string) => void;
  onUndo?: (matchId: string) => void;
}) {
  const p1 = match.player1_id ? players[match.player1_id]?.name ?? "—" : match.is_bye ? "—" : "Ожидает";
  const p2 = match.player2_id ? players[match.player2_id]?.name ?? "—" : match.is_bye ? "Пропуск" : "Ожидает";
  const h1 = match.player1_id ? players[match.player1_id]?.handicap ?? 0 : 0;
  const h2 = match.player2_id ? players[match.player2_id]?.handicap ?? 0 : 0;
  const g1 = match.player1_id ? !!players[match.player1_id]?.is_guest : false;
  const g2 = match.player2_id ? !!players[match.player2_id]?.is_guest : false;

  const Slot = ({ id, name, handicap, isGuest }: { id: string | null; name: string; handicap: number; isGuest: boolean }) => {
    const isWinner = match.winner_id && id === match.winner_id;
    const isLoser = match.winner_id && id && id !== match.winner_id;
    const clickable = isAdmin && !!id && !!match.player1_id && !!match.player2_id;
    return (
      <button
        type="button"
        disabled={!clickable}
        onClick={() => clickable && onPickWinner?.(match.id, id!)}
        className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors text-left ${
          isWinner ? "bg-ink text-paper" : isLoser ? "text-subtle line-through" : "text-foreground"
        } ${clickable && !match.winner_id ? "hover:bg-secondary cursor-pointer" : ""}`}
      >
        <span className="truncate pr-2 flex items-baseline gap-1.5 min-w-0">
          <span className="truncate">{name}</span>
          {id && isGuest && (
            <span
              className={`shrink-0 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                isWinner ? "bg-paper/15 text-paper" : "hairline bg-secondary text-subtle"
              }`}
              title="Гость — добавлен админом"
            >
              guest
            </span>
          )}
          {id && handicap !== 0 && (
            <span
              className={`shrink-0 font-mono text-[10px] tabular-nums px-1.5 py-0.5 rounded-md ${
                isWinner ? "bg-paper/15 text-paper" : "hairline bg-card text-subtle"
              }`}
              title="Фора"
            >
              {handicap > 0 ? `+${handicap}` : handicap}
            </span>
          )}
        </span>
        {isWinner && <span className="text-xs">✓</span>}
      </button>
    );
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-56 rounded-xl border border-hairline bg-card overflow-hidden shadow-soft"
    >
      <Slot id={match.player1_id} name={p1} handicap={h1 ?? 0} isGuest={g1} />
      <div className="border-t border-hairline" />
      <Slot id={match.player2_id} name={p2} handicap={h2 ?? 0} isGuest={g2} />
      {isAdmin && match.winner_id && !match.is_bye && (
        <div className="border-t border-hairline px-3 py-1.5 text-[11px] flex justify-end">
          <button onClick={() => onUndo?.(match.id)} className="text-subtle hover:text-ink underline-offset-2 hover:underline">
            отменить
          </button>
        </div>
      )}
    </motion.div>
  );
}
