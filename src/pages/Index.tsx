import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, QrCode, Trophy, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ActivityFeed from "@/components/ActivityFeed";

type LiveTournament = { id: string; name: string; location: string | null; status: string };
type TopPlayer = { handle: string; name: string; rating: number };

/* ── SVG illustrations ── */
const PaddleBallSVG = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="52" cy="52" rx="36" ry="36" fill="#e8572a"/>
    <ellipse cx="52" cy="52" rx="36" ry="36" fill="url(#paddle-split)"/>
    <rect x="48" y="4" width="8" height="44" rx="4" fill="#1a1a2e" transform="rotate(-35 52 52)" style={{transformOrigin:"52px 52px"}}/>
    <ellipse cx="52" cy="52" rx="36" ry="36" fill="none" stroke="#1a1a2e" strokeWidth="3"/>
    <line x1="52" y1="16" x2="52" y2="88" stroke="#1a1a2e" strokeWidth="2.5"/>
    <rect x="83" y="80" width="28" height="10" rx="5" fill="#1a1a2e" transform="rotate(40 83 80)"/>
    <circle cx="95" cy="68" r="11" fill="#f5f5a0" stroke="#1a1a2e" strokeWidth="2.5"/>
    <circle cx="92" cy="65" r="3" fill="rgba(255,255,255,0.5)"/>
    <defs>
      <linearGradient id="paddle-split" x1="16" y1="52" x2="88" y2="52">
        <stop offset="0.5" stopColor="#1a1a2e"/>
        <stop offset="0.5" stopColor="transparent"/>
      </linearGradient>
    </defs>
  </svg>
);

const TrophySVG = () => (
  <svg width="90" height="100" viewBox="0 0 90 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="28" y="82" width="34" height="8" rx="4" fill="#1a1a2e"/>
    <rect x="20" y="90" width="50" height="8" rx="4" fill="#e8572a"/>
    <rect x="38" y="62" width="14" height="22" rx="3" fill="#f5c842"/>
    <path d="M15 18 C15 50 35 65 45 65 C55 65 75 50 75 18 Z" fill="#f5c842"/>
    <path d="M15 18 L8 18 C8 18 5 40 22 50" stroke="#f5c842" strokeWidth="7" strokeLinecap="round" fill="none"/>
    <path d="M75 18 L82 18 C82 18 85 40 68 50" stroke="#f5c842" strokeWidth="7" strokeLinecap="round" fill="none"/>
    <path d="M15 18 C15 50 35 65 45 65 C55 65 75 50 75 18 Z" fill="none" stroke="#1a1a2e" strokeWidth="2.5"/>
    <circle cx="45" cy="38" r="10" fill="#e8572a" stroke="#1a1a2e" strokeWidth="2"/>
    <text x="45" y="43" textAnchor="middle" fontSize="12" fontWeight="bold" fill="white">1</text>
  </svg>
);

const TableSVG = () => (
  <svg width="130" height="80" viewBox="0 0 130 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="5" y="28" width="120" height="30" rx="4" fill="#3b82f6"/>
    <rect x="5" y="28" width="120" height="30" rx="4" fill="none" stroke="#1a1a2e" strokeWidth="2.5"/>
    <line x1="65" y1="28" x2="65" y2="58" stroke="white" strokeWidth="2"/>
    <rect x="60" y="22" width="10" height="12" rx="2" fill="white" stroke="#1a1a2e" strokeWidth="1.5"/>
    <line x1="5" y1="43" x2="125" y2="43" stroke="white" strokeWidth="1" strokeDasharray="4 4" opacity="0.5"/>
    <rect x="12" y="56" width="8" height="20" rx="3" fill="#1a1a2e"/>
    <rect x="110" y="56" width="8" height="20" rx="3" fill="#1a1a2e"/>
    <circle cx="100" cy="18" r="8" fill="#f5f5a0" stroke="#1a1a2e" strokeWidth="2"/>
  </svg>
);

const StarsSVG = () => (
  <svg width="80" height="40" viewBox="0 0 80 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {[
      {cx:12, cy:20, r:8, color:"#e8572a"},
      {cx:40, cy:12, r:11, color:"#f5c842"},
      {cx:68, cy:20, r:8, color:"#3b82f6"},
    ].map((s, i) => (
      <g key={i}>
        <polygon
          points={Array.from({length:5}, (_,j) => {
            const a = (j*72 - 90) * Math.PI/180;
            const a2 = (j*72 - 90 + 36) * Math.PI/180;
            return `${s.cx+s.r*Math.cos(a)},${s.cy+s.r*Math.sin(a)} ${s.cx+s.r*0.4*Math.cos(a2)},${s.cy+s.r*0.4*Math.sin(a2)}`;
          }).join(" ")}
          fill={s.color}
          stroke="#1a1a2e"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>
    ))}
  </svg>
);

const Index = () => {
  const [live, setLive] = useState<LiveTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [top, setTop] = useState<TopPlayer | null>(null);

  useEffect(() => {
    document.title = "ПИНГ ТАБЛЕТ — турниры по настольному теннису где угодно";
    supabase.from("tournaments").select("id, name, location, status")
      .in("status", ["registration", "live"])
      .order("created_at", { ascending: false }).limit(6)
      .then(({ data }) => { setLive((data as LiveTournament[]) ?? []); setLoading(false); });
    supabase.from("players").select("handle, name, rating")
      .order("rating", { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setTop(data[0] as TopPlayer); });
  }, []);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden" style={{background: "#fff", borderBottom: "2px solid #1a1a2e"}}>
        <div className="container relative pt-8 pb-8 md:pt-16 md:pb-14">
          <div className="flex items-start justify-between gap-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="flex-1"
            >
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-4 border-2 border-[#1a1a2e]">
                <span className="h-2 w-2 rounded-full animate-pulse" style={{background: "#e8572a"}} />
                <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{color: "#1a1a2e"}}>Турниры в барах и клубах</span>
              </div>

              <h1 className="font-display leading-[0.88] tracking-[1px]" style={{fontSize: "clamp(72px, 16vw, 140px)", color: "#1a1a2e"}}>
                ПИНГ<br />
                <span style={{color: "#e8572a", WebkitTextStroke: "0px"}}>ТАБЛЕТ</span>
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed max-w-sm font-medium" style={{color: "#6b7280"}}>
                Настольный теннис — где угодно. Один профиль на все турниры.
              </p>

              {/* CTA */}
              <div className="mt-6 flex gap-3 flex-wrap">
                <Link to="/scan" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-bold text-[14px] border-2 border-[#e8572a] transition-transform hover:scale-105" style={{background: "#e8572a", color: "#fff"}}>
                  <QrCode className="h-4 w-4" /> Сканировать QR
                </Link>
                <Link to="/leaderboard" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-bold text-[14px] border-2 border-[#1a1a2e] transition-transform hover:scale-105" style={{color: "#1a1a2e"}}>
                  Рейтинг <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>

            {/* Hero illustration */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="hidden md:flex flex-col items-center gap-4 shrink-0"
            >
              <PaddleBallSVG />
              <TrophySVG />
            </motion.div>
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section style={{background: "#1a1a2e", borderBottom: "2px solid #1a1a2e"}}>
        <div className="container py-4">
          <div className="grid grid-cols-3 gap-2 max-w-lg">
            {/* Live card */}
            <Link to="/events" className="rounded-2xl p-4 border-2 border-[#e8572a] relative overflow-hidden transition-transform hover:scale-[1.02]" style={{background: "#e8572a"}}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="h-2 w-2 rounded-full animate-pulse bg-white" />
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white">Live</span>
              </div>
              <div className="font-display text-[36px] leading-none text-white">{loading ? "—" : live.length}</div>
              <div className="mt-1 text-[11px] font-medium text-white/70">Турниров</div>
            </Link>

            {/* Top rating */}
            <Link to="/leaderboard" className="rounded-2xl p-4 border-2 border-white/10 transition-transform hover:scale-[1.02]" style={{background: "#252540"}}>
              <div className="flex items-center gap-1.5 mb-2">
                <Trophy className="h-3 w-3 text-yellow-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/50">Топ</span>
              </div>
              <div className="font-display text-[36px] leading-none tabular-nums text-white">{top ? top.rating : "—"}</div>
              <div className="mt-1 text-[11px] font-medium text-white/50 truncate">{top ? `@${top.handle}` : "—"}</div>
            </Link>

            {/* Events */}
            <Link to="/events" className="rounded-2xl p-4 border-2 border-white/10 flex flex-col justify-between transition-transform hover:scale-[1.02]" style={{background: "#252540"}}>
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/50">События</div>
              <div>
                <div className="font-display text-[20px] leading-tight text-white mt-2">Все турниры</div>
                <ArrowRight className="h-5 w-5 mt-2" style={{color: "#e8572a"}} />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{background: "#f5f5f5", borderBottom: "2px solid #1a1a2e"}}>
        <div className="container py-5">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {[
              { n: "1", icon: QrCode, title: "Сканируй QR", color: "#e8572a" },
              { n: "2", icon: Zap, title: "Играй матч", color: "#3b82f6" },
              { n: "3", icon: Trophy, title: "Побеждай", color: "#f5c842" },
            ].map((s, i, arr) => (
              <div key={s.n} className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-full px-4 py-2 border-2 border-[#1a1a2e]" style={{background: s.color}}>
                  <span className="w-5 h-5 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center text-[10px] font-black">{s.n}</span>
                  <s.icon className="h-4 w-4" style={{color: s.n === "3" ? "#1a1a2e" : "#fff"}} />
                  <span className="font-bold text-[13px] uppercase tracking-[0.05em]" style={{color: s.n === "3" ? "#1a1a2e" : "#fff"}}>{s.title}</span>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="h-4 w-4 shrink-0" style={{color: "#1a1a2e"}} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TABLE ILLUSTRATION BANNER */}
      <section style={{background: "#fff", borderBottom: "2px solid #1a1a2e"}}>
        <div className="container py-6 flex items-center justify-between gap-6 flex-wrap">
          <div>
            <h2 className="font-display text-[32px] md:text-[48px] leading-[0.95]" style={{color: "#1a1a2e"}}>
              ИГРАЙ.<br />
              <span style={{color: "#e8572a"}}>ПОБЕЖДАЙ.</span><br />
              РАСТИ.
            </h2>
          </div>
          <div className="flex items-end gap-6">
            <TableSVG />
            <StarsSVG />
          </div>
        </div>
      </section>

      {/* LIVE TOURNAMENTS */}
      <section className="container pt-8 pb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-[28px]" style={{color: "#1a1a2e"}}>СЕЙЧАС ИГРАЮТ</h2>
          <Link to="/leaderboard" className="inline-flex items-center gap-1 text-[13px] font-bold border-b-2 border-[#e8572a]" style={{color: "#e8572a"}}>
            Рейтинг <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[0,1,2].map(i => (
              <div key={i} className="rounded-2xl border-2 border-[#1a1a2e] p-4" style={{background: "#f5f5f5"}}>
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : live.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#1a1a2e] p-10 text-center">
            <p className="font-display text-[20px]" style={{color: "#6b7280"}}>АКТИВНЫХ ТУРНИРОВ НЕТ</p>
            <Link to="/events" className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold" style={{color: "#e8572a"}}>
              Смотреть все события <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {live.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/t/${t.id}`}
                  className="block rounded-2xl border-2 border-[#1a1a2e] p-4 transition-transform hover:scale-[1.02]"
                  style={{background: t.status === "live" ? "#e8572a" : "#fff"}}
                >
                  <div className="flex items-center gap-1.5 mb-3">
                    {t.status === "live" ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-white uppercase tracking-[0.1em]">
                        <span className="h-2 w-2 rounded-full animate-pulse bg-white" /> В эфире
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full border-2 border-[#1a1a2e] text-[10px] font-bold uppercase tracking-[0.08em]" style={{background: "#f5c842", color: "#1a1a2e"}}>
                        Регистрация
                      </span>
                    )}
                  </div>
                  <h3 className="text-[15px] font-bold truncate" style={{color: t.status === "live" ? "#fff" : "#1a1a2e"}}>{t.name}</h3>
                  {t.location && (
                    <p className="text-[12px] mt-1 truncate" style={{color: t.status === "live" ? "rgba(255,255,255,0.7)" : "#6b7280"}}>{t.location}</p>
                  )}
                  <div className="mt-3 flex justify-end">
                    <ArrowRight className="h-5 w-5" style={{color: t.status === "live" ? "#fff" : "#e8572a"}} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <ActivityFeed />
    </>
  );
};

export default Index;
