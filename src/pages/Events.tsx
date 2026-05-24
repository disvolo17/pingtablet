import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AddToCalendarButton } from "add-to-calendar-button-react";
import { Calendar, MapPin, Clock, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type EventTournament = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  cover_url: string | null;
  status: "registration" | "live" | "finished";
};

const STATUS_LABEL: Record<EventTournament["status"], string> = {
  registration: "Регистрация открыта",
  live: "В эфире сейчас",
  finished: "Завершён",
};

export default function Events() {
  const [items, setItems] = useState<EventTournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "События — ПИНГ ТАБЛЕТ";
    const load = async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("id, name, description, location, starts_at, ends_at, cover_url, status")
        .order("starts_at", { ascending: true, nullsFirst: false });
      setItems((data as EventTournament[]) ?? []);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel("events-tournaments")
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const grouped = useMemo(() => groupByMonth(items), [items]);

  return (
    <div className="container max-w-3xl pt-page">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="font-display text-[42px] leading-[0.95] tracking-[1px]" style={{color: "#1a1a2e"}}>События</h1>
        <p className="mt-2 text-[13px] leading-relaxed" style={{color: "#6b7280"}}>
          Ближайшие и прошедшие турниры. Добавляй в свой календарь.
        </p>
      </motion.div>

      {loading ? (
        <div className="text-muted-foreground">Загружаем афишу…</div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="relative">
          {/* Vertical timeline rail */}
          <div className="pointer-events-none absolute left-3 md:left-4 top-2 bottom-2 w-px bg-hairline" aria-hidden />
          <div className="space-y-10 md:space-y-12">
            {grouped.map(({ key, label, list }) => (
              <section key={key}>
                <h2 className="text-[11px] uppercase tracking-[0.2em] mb-4 pl-10 md:pl-12 font-medium" style={{color: "#6b7280"}}>
                  {label}
                </h2>
                <div className="space-y-5 md:space-y-6">
                  {list.map((t, idx) => (
                    <EventCard key={t.id} t={t} index={idx} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ t, index }: { t: EventTournament; index: number }) {
  const start = t.starts_at ? new Date(t.starts_at) : null;
  const end = t.ends_at ? new Date(t.ends_at) : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.25), ease: [0.22, 1, 0.36, 1] }}
      className="relative pl-10 md:pl-12"
    >
      {/* Timeline node */}
      <span
        className="absolute left-0 top-6 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background hairline"
        aria-hidden
      >
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            t.status === "live"
              ? "bg-ink animate-pulse"
              : t.status === "registration"
              ? "bg-ink"
              : "bg-subtle/40"
          }`}
        />
      </span>

      <Link
        to={`/t/${t.id}`}
        className="group block rounded-3xl overflow-hidden hairline bg-card shadow-soft transition-all hover:shadow-[0_24px_60px_-24px_hsl(0_0%_0%/0.4)] hover:-translate-y-0.5"
      >
        <Poster t={t} />

        <div className="pt-pad space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={t.status} />
            {start && (
              <span className="inline-flex items-center gap-1.5 text-xs text-subtle">
                <Calendar className="h-3.5 w-3.5" /> {formatDate(start)}
              </span>
            )}
            {start && (
              <span className="inline-flex items-center gap-1.5 text-xs text-subtle">
                <Clock className="h-3.5 w-3.5" /> {formatTime(start)}
                {end ? ` – ${formatTime(end)}` : ""}
              </span>
            )}
            {t.location && (
              <span className="inline-flex items-center gap-1.5 text-xs text-subtle min-w-0">
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate">{t.location}</span>
              </span>
            )}
          </div>

          <h3 className="pt-display text-2xl md:text-3xl leading-tight tracking-tight group-hover:underline underline-offset-4 decoration-2">
            {t.name}
          </h3>

          {t.description && (
            <p className="text-sm text-muted-foreground line-clamp-3">{t.description}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <CalendarButton t={t} />
            <span className="inline-flex items-center text-sm text-subtle group-hover:text-ink transition-colors">
              Открыть турнир <ArrowRight className="h-4 w-4 ml-1" />
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

function Poster({ t }: { t: EventTournament }) {
  const start = t.starts_at ? new Date(t.starts_at) : null;
  if (t.cover_url) {
    return (
      <div className="relative aspect-[16/10] md:aspect-[21/9] overflow-hidden bg-secondary">
        <img
          src={t.cover_url}
          alt={`Афиша: ${t.name}`}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
        <div className="absolute bottom-4 left-5 right-5 text-paper">
          <p className="font-display text-xs uppercase tracking-widest opacity-80">
            {start ? formatDate(start) : "Дата уточняется"}
          </p>
        </div>
      </div>
    );
  }
  // Procedural minimalist poster
  const seed = hashString(t.id);
  const angle = (seed % 360);
  return (
    <div className="relative aspect-[16/10] md:aspect-[21/9] overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(${angle}deg, hsl(var(--ink)) 0%, hsl(var(--ink)) 35%, hsl(var(--subtle) / 0.6) 100%)`,
        }}
      />
      <div className="absolute inset-0 mix-blend-overlay opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.15), transparent 40%)",
        }}
      />
      <div className="relative h-full w-full p-6 md:p-8 flex flex-col justify-between text-paper">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] opacity-80">
          <span>ПИНГ · ТАБЛЕТ</span>
        </div>
        <div>
          <div className="font-display text-3xl md:text-5xl leading-none tracking-tight line-clamp-3">
            {t.name}
          </div>
          {start && (
            <div className="mt-3 text-xs uppercase tracking-widest opacity-80">
              {formatDate(start)} · {formatTime(start)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarButton({ t }: { t: EventTournament }) {
  if (!t.starts_at) {
    return <span className="text-xs text-subtle">Дата ещё не объявлена</span>;
  }
  const start = new Date(t.starts_at);
  const end = t.ends_at ? new Date(t.ends_at) : new Date(start.getTime() + 2 * 60 * 60 * 1000);

  const url = `${window.location.origin}/t/${t.id}`;
  const description = `${t.description ? t.description + "\n\n" : ""}Подробности: ${url}`;

  // Stop link navigation when interacting with the button
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div onClick={stop} className="atcb-wrapper">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <AddToCalendarButton
        name={t.name}
        description={description}
        location={t.location ?? ""}
        startDate={toDateOnly(start)}
        startTime={toTimeOnly(start)}
        endDate={toDateOnly(end)}
        endTime={toTimeOnly(end)}
        timeZone="currentBrowser"
        options={["Apple", "Google", "iCal", "Outlook.com", "Microsoft365"] as any}
        buttonStyle="round"
        size="3"
        lightMode="bodyScheme"
        label="Добавить в календарь"
        hideBackground
        hideCheckmark
      />
    </div>
  );
}

function StatusPill({ status }: { status: EventTournament["status"] }) {
  const variant =
    status === "live"
      ? "bg-ink text-paper"
      : status === "registration"
      ? "hairline bg-card text-ink"
      : "hairline bg-card text-subtle";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-widest ${variant}`}>
      {status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-paper animate-pulse" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="pt-card pt-pad-lg text-center">
      <Calendar className="h-7 w-7 mx-auto mb-3 text-subtle" />
      <p className="font-display text-xl mb-2">Пока ни одного турнира</p>
      <p className="text-sm text-muted-foreground">Загляни позже — здесь появится афиша ближайших событий.</p>
    </div>
  );
}

// ---------- helpers ----------

function pad(n: number) { return String(n).padStart(2, "0"); }
function toDateOnly(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function toTimeOnly(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

function formatDate(d: Date) {
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}
function formatTime(d: Date) {
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function groupByMonth(items: EventTournament[]) {
  const buckets = new Map<string, { key: string; label: string; list: EventTournament[] }>();
  const undated: EventTournament[] = [];
  for (const t of items) {
    if (!t.starts_at) { undated.push(t); continue; }
    const d = new Date(t.starts_at);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const label = d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
    if (!buckets.has(key)) buckets.set(key, { key, label, list: [] });
    buckets.get(key)!.list.push(t);
  }
  const arr = Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
  if (undated.length) arr.push({ key: "tba", label: "Дата уточняется", list: undated });
  return arr;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
