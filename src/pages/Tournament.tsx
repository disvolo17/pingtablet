import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentPlayer } from "@/lib/currentPlayer";
import { useIsAdmin } from "@/lib/admin";
import Bracket, { BracketMatch } from "@/components/Bracket";
import AuthDialog from "@/components/AuthDialog";
import { Avatar } from "@/components/Layout";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Calendar, MapPin, Users, MessageSquare, GitBranch, UserPlus, Share2, Copy, Download, QrCode as QrIcon } from "lucide-react";
import MobileStickyCTA from "@/components/MobileStickyCTA";

type Tournament = {
  id: string;
  name: string;
  location: string | null;
  starts_at: string | null;
  description: string | null;
  status: "registration" | "live" | "finished";
};
type Player = { id: string; handle: string; name: string; rating: number; status?: string | null; avatar_url: string | null; handicap: number };
type Registration = { id: string; player_id: string };
type Message = { id: string; author_name: string; content: string; created_at: string };

export default function Tournament() {
  const { id } = useParams<{ id: string }>();
  const tid = id!;
  const [me] = useCurrentPlayer();
  const [searchParams, setSearchParams] = useSearchParams();
  const checkinIntent = searchParams.get("checkin") === "1";
  const [t, setT] = useState<Tournament | null>(null);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const reload = async () => {
    const { data: tour } = await supabase.from("tournaments").select("*").eq("id", tid).single();
    setT(tour as Tournament | null);
    const { data: r } = await supabase.from("registrations").select("id, player_id").eq("tournament_id", tid);
    setRegs((r as Registration[]) ?? []);
    const ids = (r ?? []).map((x: Registration) => x.player_id);
    if (ids.length) {
      const { data: ps } = await supabase.from("players").select("id, handle, name, rating, status, avatar_url, handicap").in("id", ids);
      const map: Record<string, Player> = {};
      (ps as Player[] ?? []).forEach((p) => (map[p.id] = p));
      setPlayers(map);
    } else setPlayers({});
    const { data: m } = await supabase
      .from("matches").select("id, round, position, player1_id, player2_id, winner_id, is_bye")
      .eq("tournament_id", tid).order("round").order("position");
    setMatches((m as BracketMatch[]) ?? []);
    const { data: msgs } = await supabase
      .from("messages").select("*").eq("tournament_id", tid)
      .order("created_at", { ascending: true }).limit(200);
    setMessages((msgs as Message[]) ?? []);
  };

  useEffect(() => { reload(); }, [tid]);

  useEffect(() => { if (t?.name) document.title = `${t.name} — ПИНГ ТАБЛЕТ`; }, [t?.name]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`t-${tid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${tid}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations", filter: `tournament_id=eq.${tid}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tid}` }, () => reload())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `tournament_id=eq.${tid}` }, (p) => {
        setMessages((prev) => [...prev, p.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tid]);

  const isRegistered = useMemo(
    () => !!me && regs.some((r) => r.player_id === me.id),
    [me, regs],
  );

  const share = async () => {
    const url = `${window.location.origin}/t/${tid}`;
    const data = { title: t?.name ?? "ПИНГ ТАБЛЕТ", text: `Турнир: ${t?.name}`, url };
    try {
      if (navigator.share) {
        await navigator.share(data);
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Ссылка скопирована");
      }
    } catch {
      /* user cancelled */
    }
  };

  if (!t) return <div className="container py-20 text-muted-foreground">Загрузка…</div>;

  return (
    <div className="container max-w-5xl pt-page">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <StatusBadge status={t.status} />
          <Button variant="ghost" size="sm" onClick={share} className="text-subtle hover:text-ink h-8">
            <Share2 className="h-4 w-4 mr-1.5" /> Поделиться
          </Button>
        </div>
        <h1 className="pt-display text-4xl md:text-6xl mb-4">{t.name}</h1>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground text-sm mb-6">
          {t.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{t.location}</span>}
          {t.starts_at && <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" />{new Date(t.starts_at).toLocaleString("ru-RU")}</span>}
          <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{regs.length} игроков</span>
        </div>
        {t.description && <p className="text-muted-foreground max-w-2xl mb-6">{t.description}</p>}
      </motion.div>

      {t.status === "registration" && checkinIntent && (
        <div id="checkin" className="scroll-mt-24">
          <CheckInCard
            tid={tid}
            isRegistered={isRegistered}
            onDone={() => {
              reload();
              const next = new URLSearchParams(searchParams);
              next.delete("checkin");
              setSearchParams(next, { replace: true });
            }}
          />
        </div>
      )}

      <AdminQrCard tid={tid} name={t.name} />

      <Tabs defaultValue="players" className="mt-8">
        <div className="-mx-4 sm:mx-0 overflow-x-auto no-scrollbar">
          <TabsList className="bg-secondary mx-4 sm:mx-0 inline-flex w-auto">
            <TabsTrigger value="players"><Users className="h-4 w-4 mr-2" />Игроки</TabsTrigger>
            <TabsTrigger value="bracket"><GitBranch className="h-4 w-4 mr-2" />Сетка</TabsTrigger>
            <TabsTrigger value="chat"><MessageSquare className="h-4 w-4 mr-2" />Чат</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="players" className="mt-6">
          {regs.length === 0 ? (
            <p className="text-muted-foreground">Пока никто не отметился. Игроки появятся после check-in по QR на месте.</p>
          ) : (
            <div className="pt-card divide-y divide-hairline overflow-hidden">
              {regs.map((r, i) => {
                const p = players[r.player_id];
                if (!p) return null;
                return (
                  <Link to={`/p/${p.handle}`} key={r.id} className="flex items-center justify-between pt-row hover:bg-secondary/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-subtle w-6">{String(i + 1).padStart(2, "0")}</span>
                      <Avatar player={p} size={28} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.name}{me?.id === p.id && <span className="text-subtle text-xs ml-2">это ты</span>}</div>
                        <div className="text-[11px] text-subtle truncate">@{p.handle} · {p.status || "Игрок"}</div>
                      </div>
                    </div>
                    <span className="font-display font-bold tabular-nums">{p.rating}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bracket" className="mt-6">
          <Bracket matches={matches} players={players} />
        </TabsContent>

        <TabsContent value="chat" className="mt-6">
          <Chat tid={tid} messages={messages} />
        </TabsContent>
      </Tabs>

      {t.status === "registration" && checkinIntent && !isRegistered ? (
        <MobileStickyCTA
          label="Подтвердить участие"
          icon={<UserPlus className="h-4 w-4" />}
          onClick={() => {
            document.getElementById("checkin")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      ) : (
        <MobileStickyCTA
          label="Поделиться турниром"
          icon={<Share2 className="h-4 w-4" />}
          variant="outline"
          onClick={share}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Tournament["status"] }) {
  const map = {
    registration: { label: "Регистрация открыта", dot: "bg-ink animate-pulse" },
    live: { label: "В эфире", dot: "bg-ink animate-pulse" },
    finished: { label: "Завершён", dot: "bg-subtle" },
  } as const;
  const v = map[status];
  return (
    <span className="inline-flex items-center gap-2 rounded-full hairline bg-card px-3 py-1 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />
      {v.label}
    </span>
  );
}

function CheckInCard({ tid, isRegistered, onDone }: { tid: string; isRegistered: boolean; onDone: () => void }) {
  const [me] = useCurrentPlayer();
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isRegistered) {
    return (
      <div className="pt-card pt-pad-sm flex items-center gap-3 bg-secondary/40">
        <div className="h-2 w-2 rounded-full bg-ink animate-pulse" />
        <span className="text-sm">Check-in пройден. Удачи на турнире!</span>
      </div>
    );
  }

  const join = async () => {
    if (!me) {
      setAuthOpen(true);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("registrations")
        .insert({ tournament_id: tid, player_id: me.id });
      if (error && !error.message.toLowerCase().includes("duplicate")) throw error;
      toast.success("Check-in готов! Ты в списке.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось пройти check-in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="pt-card pt-pad">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="h-4 w-4 text-subtle" />
          <h2 className="text-lg font-display font-bold">Check-in на турнире</h2>
        </div>
        <p className="text-xs uppercase tracking-widest text-subtle mb-4">QR отсканирован · подтверди участие</p>
        {me ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar player={me} size={36} />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{me.name}</div>
                <div className="text-xs text-subtle truncate">@{me.handle}</div>
              </div>
            </div>
            <Button onClick={join} disabled={busy} className="h-11 rounded-full px-6">
              {busy ? "…" : "Подтвердить участие"}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Войди через Telegram — профиль создастся автоматически, и ты сразу попадёшь в список игроков.
            </p>
            <Button onClick={() => setAuthOpen(true)} className="h-11 rounded-full px-6">
              Войти и пройти check-in
            </Button>
          </>
        )}
      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onAuthed={() => { setTimeout(join, 50); }} />
    </>
  );
}

function Chat({ tid, messages }: { tid: string; messages: Message[] }) {
  const [me] = useCurrentPlayer();
  const [name, setName] = useState(me?.name ?? "Гость");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (me?.name) setName(me.name);
  }, [me?.name]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const c = text.trim();
    const n = name.trim() || "Гость";
    if (!c || c.length > 500) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("messages").insert({
        tournament_id: tid, author_name: n.slice(0, 40), content: c,
      });
      if (error) throw error;
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не отправилось");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-card flex flex-col h-[55vh] sm:h-[60vh] max-h-[560px] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && <p className="text-muted-foreground text-sm">Тишина… напиши первым.</p>}
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col"
          >
            <span className="text-[11px] text-subtle">{m.author_name} · {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="text-sm leading-relaxed">{m.content}</span>
          </motion.div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="border-t border-hairline p-3 flex flex-col sm:flex-row gap-2">
        {!me && (
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" maxLength={40} className="sm:w-32 h-10" />
        )}
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Сообщение…"
          maxLength={500}
          className="h-10"
        />
        <Button onClick={send} disabled={busy || !text.trim()} className="h-10">Отправить</Button>
      </div>
    </div>
  );
}

function AdminQrCard({ tid, name }: { tid: string; name: string }) {
  const { isAdmin } = useIsAdmin();
  const [qr, setQr] = useState<string>("");
  const url = `${window.location.origin}/t/${tid}?checkin=1`;

  useEffect(() => {
    if (!isAdmin) return;
    QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: "#0f0f0f", light: "#ffffff" } })
      .then(setQr).catch(() => {});
  }, [isAdmin, url]);

  if (!isAdmin) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <div className="pt-card mt-6 pt-pad grid sm:grid-cols-[auto_1fr] gap-5 items-center">
      {qr && <img src={qr} alt={`QR-код турнира ${name}`} className="w-32 h-32 sm:w-36 sm:h-36 mx-auto sm:mx-0" />}
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-subtle mb-2">
          <QrIcon className="h-3.5 w-3.5" /> QR для игроков
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Покажи этот QR на месте — игроки сканируют, регистрируются и попадают на страницу турнира.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-[11px] font-mono px-2 py-1 rounded hairline bg-card truncate max-w-full">{url}</code>
          <Button size="sm" variant="outline" onClick={copyLink} className="rounded-full h-8">
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Копировать
          </Button>
          {qr && (
            <a href={qr} download={`pingtablet-${tid}.png`}>
              <Button size="sm" variant="ghost" className="rounded-full h-8">
                <Download className="h-3.5 w-3.5 mr-1.5" /> Скачать QR
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
