import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, QrCode, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoMark from "@/assets/logo-mark.jpg";

type LiveTournament = { id: string; name: string; location: string | null; status: string };

const Index = () => {
  const navigate = useNavigate();
  const [live, setLive] = useState<LiveTournament[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  return (
    <>
      {/* HERO — премиальный лендинг в духе Apple/Linear */}
      <section className="relative overflow-hidden border-b border-hairline">
        <div className="absolute inset-0 grid-bg opacity-[0.25] pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[520px] rounded-full bg-ink/5 blur-3xl pointer-events-none" />
        <div className="container relative pt-12 pb-14 md:pt-28 md:pb-32">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-4xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full hairline bg-card/80 backdrop-blur px-3 py-1 text-[11px] text-subtle mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-ink animate-pulse" />
              Турниры в барах, клубах и на крышах
            </div>
            <div className="flex items-start gap-4 md:gap-6">
              <img
                src={logoMark}
                alt=""
                aria-hidden="true"
                className="hidden md:block h-28 lg:h-36 w-auto object-contain mix-blend-multiply mt-2 select-none"
                loading="eager"
                decoding="async"
              />
              <h1 className="pt-display text-[14vw] md:text-[6.5rem] lg:text-[8rem] leading-[0.95] bg-gradient-to-b from-ink to-ink/70 bg-clip-text text-transparent">
                ПИНГ<br />
                <span className="text-subtle">ТАБЛЕТ</span>
              </h1>
            </div>
            <p className="mt-5 max-w-xl text-base md:text-lg text-muted-foreground">
              Сканируешь QR — играешь — поднимаешь рейтинг. Один профиль на все турниры.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Button size="lg" onClick={() => navigate("/scan")} className="h-12 px-6 rounded-full shadow-[0_8px_24px_-8px_hsl(var(--ink)/0.4)]">
                <QrCode className="mr-2 h-4 w-4" />
                Сканировать QR
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/leaderboard")} className="h-12 px-6 rounded-full">
                Рейтинг
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* HOW — на мобиле одна строка-чипа, на десктопе карточки */}
      <section className="container py-5 md:py-12 border-b border-hairline">
        {/* Mobile: одна компактная строка */}
        <div className="md:hidden flex items-center justify-between gap-2 text-[11px]">
          {[
            { n: "1", icon: QrCode, title: "Сканируй" },
            { n: "2", icon: Zap, title: "Играй" },
            { n: "3", icon: Trophy, title: "Побеждай" },
          ].map((s, i, arr) => (
            <div key={s.n} className="flex items-center gap-1.5 flex-1">
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-ink text-paper font-mono text-[10px] shrink-0">{s.n}</span>
              <s.icon className="h-3.5 w-3.5 text-subtle shrink-0" />
              <span className="font-medium truncate">{s.title}</span>
              {i < arr.length - 1 && <span className="text-subtle">·</span>}
            </div>
          ))}
        </div>

        {/* Desktop: полные карточки */}
        <div className="hidden md:grid grid-cols-3 gap-6">
          {[
            { n: "01", icon: QrCode, title: "Сканируй", desc: "QR на месте → страница турнира за секунду." },
            { n: "02", icon: Zap, title: "Регистрируйся", desc: "Один ник + PIN. Работает на всех турнирах." },
            { n: "03", icon: Trophy, title: "Побеждай", desc: "Победа +25, поражение −25 к рейтингу." },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              className="pt-card p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs text-subtle">{s.n}</span>
                <s.icon className="h-5 w-5 text-subtle" />
              </div>
              <h3 className="text-xl mb-2 font-display font-bold tracking-tight">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-snug">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* LIVE TOURNAMENTS */}
      <section className="container py-10 md:py-16">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl md:text-4xl font-display font-bold tracking-tight">Сейчас играют</h2>
          <Link to="/leaderboard" className="text-sm text-subtle hover:text-ink">
            Рейтинг →
          </Link>
        </div>
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="pt-card p-5">
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
              <Link key={t.id} to={`/t/${t.id}`} className="pt-card p-5 hover:shadow-elevated transition-shadow group">
                <div className="flex items-center gap-2 text-xs text-subtle mb-3">
                  <span className={`h-1.5 w-1.5 rounded-full ${t.status === "live" ? "bg-ink animate-pulse" : "bg-subtle"}`} />
                  {t.status === "live" ? "В эфире" : "Регистрация"}
                </div>
                <h3 className="text-lg mb-1 group-hover:underline underline-offset-4 font-display font-bold">{t.name}</h3>
                {t.location && <p className="text-sm text-muted-foreground">{t.location}</p>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
};

export default Index;
