import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";

type Player = { id: string; handle: string; name: string; rating: number; wins: number; losses: number; status: string; avatar_url: string | null };

const MEDAL: Record<number, string> = { 0: "#c9a84c", 1: "#9b9690", 2: "#b87333" };

export default function Leaderboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Рейтинг — ПИНГ ТАБЛЕТ";
    const load = async () => {
      const { data } = await supabase
        .from("players")
        .select("id, handle, name, rating, wins, losses, status, avatar_url")
        .order("rating", { ascending: false })
        .limit(100);
      setPlayers((data as Player[]) ?? []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("leaderboard-players")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="container max-w-3xl pt-section-tight">
      <div className="mb-5">
        <h1 className="font-display text-[42px] leading-[0.95] tracking-[1px]" style={{color: "hsl(var(--ink))"}}>Рейтинг</h1>
        <p className="mt-1 text-[12px] uppercase tracking-[0.8px] font-medium" style={{color: "hsl(var(--subtle))"}}>Глобальная таблица</p>
      </div>

      {loading ? (
        <div className="rounded-2xl overflow-hidden border" style={{background: "#161616", borderColor: "rgba(255,255,255,0.07)"}}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3.5 border-b" style={{borderColor: "var(--glass-border)"}}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>
      ) : players.length === 0 ? (
        <p style={{color: "hsl(var(--subtle))"}}>Пока никого. Будь первым.</p>
      ) : (
        <div className="rounded-2xl overflow-hidden border" style={{background: "#161616", borderColor: "rgba(255,255,255,0.07)"}}>
          {players.map((p, i) => (
            <Link
              to={`/p/${p.handle}`}
              key={p.id}
              className="flex items-center justify-between px-4 py-3.5 border-b transition-opacity hover:opacity-75"
              style={{borderColor: "var(--glass-border)"}}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="font-mono text-[12px] w-6 text-center font-semibold shrink-0"
                  style={{color: MEDAL[i] || "#6b6760"}}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Avatar player={p} size={36} />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium" style={{color: "hsl(var(--ink))"}}>{p.name}</div>
                  <div className="text-[11px] truncate" style={{color: "hsl(var(--subtle))"}}>@{p.handle} · {p.wins}В {p.losses}П</div>
                </div>
              </div>
              <span className="font-display text-[24px] tabular-nums ml-3 shrink-0" style={{color: "hsl(var(--ink))"}}>{p.rating}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
