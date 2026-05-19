import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, QrCode, Trophy, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoMark from "@/assets/logo-mark.jpg";
import ActivityFeed from "@/components/ActivityFeed";

type LiveTournament = { id: string; name: string; location: string | null; status: string };

type TopPlayer = { handle: string; name: string; rating: number };

const Index = () => {
  const [live, setLive] = useState<LiveTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [top, setTop] = useState<TopPlayer | null>(null);

  useEffect(() => {
    document.title = "ПИНГ ТАБЛЕТ — турниры по настольному теннису где угодно";
    supabase
      .from("tournaments")
      .select("id, name, location, status")
      .in("status", ["registration", "live"])
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        setLive((data as LiveTournament[]) ?? []);
        setLoading(false);
      });
    supabase
      .from("players")
      .select("handle, name, rating")
      .order("rating", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data[0]) setTop(data[0] as TopPlayer);
      });
  }, []);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b" style={{borderColor: "rgba(255,255,255,0.07)"}}>
        <div className="container relative pt-6 pb-5 md:pt-20 md:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="font-display text-[72px] md:text-[120px] leading-[0.92] tracking-[1px]" style={{color: "#f0ece4"}}>
              ПИНГ<br />
              <em className="not-italic" style={{color: "#e8572a"}}>ТАБЛЕТ</em>
            </h1>
            <p className="mt-3 text-[13px] md:text-base leading-relaxed max-w-xs" style={{color: "#9b9690"}}>
              Турниры по настольному теннису — где угодно.
            </p>

            {/* Stat cards */}
            <div className="mt-5 grid grid-cols-2 gap-2.5 md:gap-3 max-w-sm">
              <Link to="/leaderboard" className="rounded-2xl p-3.5 border relative overflow-hidden" style={{background: "#161616", borderColor: "#e8572a"}}>
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{background: "#e8572a"}} />
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{background: "#e8572a"}} />
                  <span className="text-[10px] font-medium uppercase tracking-[0.8px]" style={{color: "#6b6760"}}>Live</span>
                </div>
                <div className="font-display text-[30px] leading-none" style={{color: "#f0ece4"}}>{loading ? "—" : live.length}</div>
                <div className="mt-1 text-[11px]" style={{color: "#6b6760"}}>Турниров</div>
              </Link>
              <Link to="/leaderboard" className="rounded-2xl p-3.5 border" style={{background: "#161616", borderColor: "rgba(255,255,255,0.07)"}}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Trophy className="h-3 w-3" style={{color: "#6b6760"}} />
                  <span className="text-[10px] font-medium uppercase tracking-[0.8px]" style={{color: "#6b6760"}}>Топ рейтинг</span>
                </div>
                <div className="font-display text-[30px] leading-none tabular-nums" style={{color: "#f0ece4"}}>{top ? top.rating : "—"}</div>
                <div className="mt-1 text-[11px] truncate" style={{color: "#6b6760"}}>{top ? `@${top.handle}` : "—"}</div>
              </Link>
              <Link to="/events" className="col-span-2 rounded-2xl p-3.5 border flex items-center justify-between" style={{background: "#161616", borderColor: "rgba(255,255,255,0.07)"}}>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.8px]" style={{color: "#6b6760"}}>События</div>
                  <div className="text-sm font-medium mt-0.5" style={{color: "#f0ece4"}}>Все турниры и расписание</div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0" style={{color: "#e8572a"}} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>


      {/* HOW */}
      <section className="container py-4 border-b" style={{borderColor: "rgba(255,255,255,0.07)"}}>
        <div className="flex items-center justify-center gap-2 text-[12px]" style={{color: "#9b9690"}}>
          {[
            { n: "1", icon: QrCode, title: "Сканируй" },
            { n: "2", icon: Zap, title: "Играй" },
            { n: "3", icon: Trophy, title: "Побеждай" },
          ].map((s, i, arr) => (
            <div key={s.n} className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-semibold shrink-0" style={{background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.13)", color: "#9b9690"}}>{s.n}</span>
              <span className="font-medium">{s.title}</span>
              {i < arr.length - 1 && <span style={{color: "rgba(255,255,255,0.13)"}}>·</span>}
            </div>
          ))}
        </div>
      </section>

      {/* LIVE TOURNAMENTS */}
      <section className="container pt-section">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-[18px] font-semibold" style={{color: "#f0ece4"}}>Сейчас играют</h2>
          <Link to="/leaderboard" className="text-[12px] flex items-center gap-1" style={{color: "#e8572a"}}>Рейтинг <ArrowRight className="h-3 w-3" /></Link>
        </div>
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="pt-card pt-pad-sm">
                <Skeleton className="h-3 w-20 mb-4" />
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : live.length === 0 ? (
          <p className="text-muted-foreground text-sm">Активных турниров пока нет.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {live.map((t) => (
              <Link key={t.id} to={`/t/${t.id}`} className="rounded-2xl p-4 border flex items-center justify-between group transition-opacity hover:opacity-80" style={{background: "#161616", borderColor: "rgba(255,255,255,0.07)"}}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-2">
                    {t.status === "live" ? (
                      <><span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{background: "#e8572a"}} /><span className="text-[11px] font-medium" style={{color: "#e8572a"}}>В эфире</span></>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{background: "rgba(82,183,136,0.1)", color: "#52b788"}}>Регистрация</span>
                    )}
                  </div>
                  <h3 className="text-[14px] font-medium truncate" style={{color: "#f0ece4"}}>{t.name}</h3>
                  {t.location && <p className="text-[11px] mt-0.5 truncate" style={{color: "#6b6760"}}>{t.location}</p>}
                </div>
                <ArrowRight className="h-4 w-4 ml-3 shrink-0" style={{color: "#e8572a"}} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* LIVE ACTIVITY FEED */}
      <ActivityFeed />
    </>
  );
};

export default Index;
