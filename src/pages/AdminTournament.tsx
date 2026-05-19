import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { callAdmin, useIsAdmin } from "@/lib/admin";
import Bracket, { BracketMatch } from "@/components/Bracket";
import { toast } from "sonner";
import { ArrowLeft, Download, Play, Shuffle, Lock, Save, Search, UserPlus, X, Users, Sparkles } from "lucide-react";
import { LOCATION_KINDS } from "@/lib/achievements";

type Tournament = { id: string; name: string; location: string | null; location_kind: string | null; status: "registration" | "live" | "finished"; description: string | null; starts_at: string | null; ends_at: string | null; cover_url: string | null };
type Player = { id: string; name: string; handle: string; rating: number; avatar_url?: string | null; is_guest?: boolean | null; handicap?: number | null };

export default function AdminTournament() {
  const { id } = useParams<{ id: string }>();
  const tid = id!;
  const { isAdmin } = useIsAdmin();
  const [t, setT] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [regs, setRegs] = useState<{ player_id: string }[]>([]);
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [qr, setQr] = useState<string>("");

  const reload = async () => {
    const [{ data: tour }, { data: r }, { data: m }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tid).single(),
      supabase.from("registrations").select("player_id").eq("tournament_id", tid),
      supabase.from("matches").select("id, round, position, player1_id, player2_id, winner_id, is_bye").eq("tournament_id", tid).order("round").order("position"),
    ]);
    setT(tour as Tournament | null);
    setRegs((r as { player_id: string }[]) ?? []);
    setMatches((m as BracketMatch[]) ?? []);
    const ids = (r ?? []).map((x: { player_id: string }) => x.player_id);
    if (ids.length) {
      const { data: ps } = await supabase.from("players").select("id, name, handle, rating, avatar_url, is_guest, handicap").in("id", ids);
      const map: Record<string, Player> = {};
      (ps as Player[] ?? []).forEach((p) => (map[p.id] = p));
      setPlayers(map);
    } else setPlayers({});
  };

  useEffect(() => { reload(); }, [tid]);

  useEffect(() => {
    const url = `${window.location.origin}/t/${tid}?checkin=1`;
    QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: "#0f0f0f", light: "#ffffff" } })
      .then(setQr).catch(() => {});
  }, [tid]);

  useEffect(() => {
    const ch = supabase.channel(`admin-t-${tid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${tid}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations", filter: `tournament_id=eq.${tid}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tid}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tid]);

  if (!isAdmin) {
    return (
      <div className="container max-w-md py-24">
        <div className="pt-card p-8 text-center">
          <Lock className="h-6 w-6 mx-auto mb-3 text-subtle" />
          <p className="mb-4">Сначала войди как админ</p>
          <Link to="/admin"><Button>На вход</Button></Link>
        </div>
      </div>
    );
  }

  if (!t) return <div className="container py-20 text-muted-foreground">Загрузка…</div>;

  const tournamentUrl = `${window.location.origin}/t/${tid}?checkin=1`;

  const closeRegistrationAndGenerate = async () => {
    if (regs.length < 2) { toast.error("Нужно минимум 2 игрока"); return; }
    if (!confirm(`Закрыть регистрацию и сгенерировать сетку для ${regs.length} игроков?`)) return;
    try {
      await callAdmin({ type: "generate_bracket", payload: { tournament_id: tid } });
      toast.success("Сетка готова");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const regenerate = async () => {
    if (!confirm("Регенерировать сетку? Все текущие результаты будут стёрты, рейтинги откатятся.")) return;
    try {
      // First undo any played matches by setting status back & wiping
      // Easiest: regenerate (server wipes matches). Rating undo for finished games:
      // we walk current matches and undo each that has a winner.
      for (const m of matches) {
        if (m.winner_id) await callAdmin({ type: "undo_match", payload: { match_id: m.id } });
      }
      await callAdmin({ type: "generate_bracket", payload: { tournament_id: tid } });
      toast.success("Сетка пересобрана");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const setWinner = async (matchId: string, winnerId: string) => {
    try { await callAdmin({ type: "set_winner", payload: { match_id: matchId, winner_id: winnerId } }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  };
  const undo = async (matchId: string) => {
    try { await callAdmin({ type: "undo_match", payload: { match_id: matchId } }); toast.success("Отменено"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
  };

  return (
    <div className="container max-w-6xl py-10">
      <Link to="/admin" className="inline-flex items-center text-sm text-subtle hover:text-ink mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" /> Все турниры
      </Link>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8 mb-10">
        <div>
          <p className="text-xs uppercase tracking-widest text-subtle mb-2">{t.status === "registration" ? "Регистрация" : t.status === "live" ? "В эфире" : "Завершён"}</p>
          <h1 className="pt-display text-4xl md:text-5xl mb-3">{t.name}</h1>
          {t.location && <p className="text-muted-foreground">{t.location}</p>}

          <div className="mt-6 flex flex-wrap gap-2">
            {t.status === "registration" && (
              <Button onClick={closeRegistrationAndGenerate} className="rounded-full h-11 px-5">
                <Play className="h-4 w-4 mr-2" /> Сгенерировать сетку ({regs.length})
              </Button>
            )}
            {t.status !== "registration" && (
              <Button variant="outline" onClick={regenerate} className="rounded-full h-11 px-5">
                <Shuffle className="h-4 w-4 mr-2" /> Пересобрать сетку
              </Button>
            )}
          </div>
        </div>

        <div className="pt-card p-5 flex flex-col items-center">
          <p className="text-xs uppercase tracking-widest text-subtle mb-3">QR для игроков</p>
          {qr && <img src={qr} alt="QR-код турнира" className="w-full max-w-[260px] aspect-square" />}
          <p className="text-[11px] text-subtle text-center mt-3 break-all">{tournamentUrl}</p>
          {qr && (
            <a href={qr} download={`ping-tablet-${tid}.png`} className="mt-3">
              <Button variant="outline" size="sm" className="rounded-full"><Download className="h-3.5 w-3.5 mr-1.5" />Скачать</Button>
            </a>
          )}
        </div>
      </div>

      <TournamentMetaEditor t={t} onSaved={reload} />

      <PlayerManager
        tournamentId={tid}
        canEdit={t.status === "registration"}
        regs={regs}
        players={players}
      />


      <div>
        <h2 className="text-sm uppercase tracking-widest text-subtle mb-4">Сетка</h2>
        <Bracket
          matches={matches}
          players={players}
          isAdmin
          onPickWinner={setWinner}
          onUndo={undo}
        />
      </div>
    </div>
  );
}

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TournamentMetaEditor({ t, onSaved }: { t: Tournament; onSaved: () => void }) {
  const [name, setName] = useState(t.name);
  const [location, setLocation] = useState(t.location ?? "");
  const [locationKind, setLocationKind] = useState(t.location_kind ?? "");
  const [coverUrl, setCoverUrl] = useState(t.cover_url ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(t.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(t.ends_at));
  const [description, setDescription] = useState(t.description ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(t.name);
    setLocation(t.location ?? "");
    setLocationKind(t.location_kind ?? "");
    setCoverUrl(t.cover_url ?? "");
    setStartsAt(toLocalInput(t.starts_at));
    setEndsAt(toLocalInput(t.ends_at));
    setDescription(t.description ?? "");
  }, [t.id, t.name, t.location, t.location_kind, t.cover_url, t.starts_at, t.ends_at, t.description]);

  const save = async () => {
    if (!name.trim()) { toast.error("Нужно название"); return; }
    setBusy(true);
    try {
      await callAdmin({
        type: "update_tournament",
        payload: {
          id: t.id,
          name: name.trim(),
          location: location.trim(),
          location_kind: locationKind || null,
          cover_url: coverUrl.trim() || null,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          description: description.trim() || null,
        },
      });
      toast.success("Сохранено");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-card p-5 mb-12 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm uppercase tracking-widest text-subtle">Афиша и расписание</h2>
        <Button onClick={save} disabled={busy} size="sm" className="rounded-full px-5">
          <Save className="h-4 w-4 mr-2" /> Сохранить
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs uppercase tracking-widest text-subtle">Название</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 mt-1.5" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-subtle">Место</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} className="h-10 mt-1.5" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-subtle">Тип локации</Label>
          <select
            value={locationKind}
            onChange={(e) => setLocationKind(e.target.value)}
            className="w-full h-10 mt-1.5 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— не задано —</option>
            {LOCATION_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-subtle">Афиша (URL)</Label>
          <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" className="h-10 mt-1.5" />
        </div>
        <div className="sm:row-span-2 flex flex-col">
          <Label className="text-xs uppercase tracking-widest text-subtle">Описание</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1.5 flex-1" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-subtle">Начало</Label>
          <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="h-10 mt-1.5" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-subtle">Конец</Label>
          <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="h-10 mt-1.5" />
        </div>
      </div>
      {coverUrl && (
        <div className="rounded-xl overflow-hidden hairline aspect-[16/9] bg-secondary">
          <img src={coverUrl} alt="Превью афиши" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

function PlayerManager({
  tournamentId,
  canEdit,
  regs,
  players,
}: {
  tournamentId: string;
  canEdit: boolean;
  regs: { player_id: string }[];
  players: Record<string, Player>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addingGuest, setAddingGuest] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const registeredIds = useMemo(() => new Set(regs.map((r) => r.player_id)), [regs]);

  // Debounced search
  useEffect(() => {
    if (!canEdit) return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("players")
        .select("id, name, handle, rating, avatar_url, is_guest")
        .or(`name.ilike.%${q}%,handle.ilike.%${q}%`)
        .order("rating", { ascending: false })
        .limit(20);
      setResults(((data as Player[]) ?? []).filter((p) => !p.is_guest));
      setSearching(false);
    }, 220);
    return () => clearTimeout(t);
  }, [query, canEdit]);

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const addPlayer = async (p: Player) => {
    setBusyId(p.id);
    try {
      await callAdmin({ type: "tournament.add_player", payload: { tournament_id: tournamentId, player_id: p.id } });
      toast.success(`+ ${p.name}`);
      setQuery("");
      setShowDropdown(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally { setBusyId(null); }
  };

  const addGuest = async () => {
    const name = guestName.trim();
    if (!name) { toast.error("Введи имя гостя"); return; }
    setAddingGuest(true);
    try {
      await callAdmin({ type: "tournament.add_guest", payload: { tournament_id: tournamentId, name } });
      toast.success(`Гость добавлен: ${name}`);
      setGuestName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally { setAddingGuest(false); }
  };

  const removePlayer = async (playerId: string) => {
    setBusyId(playerId);
    try {
      await callAdmin({ type: "tournament.remove_player", payload: { tournament_id: tournamentId, player_id: playerId } });
      toast.success("Удалён из турнира");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally { setBusyId(null); }
  };

  return (
    <div className="mb-12 space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm uppercase tracking-widest text-subtle flex items-center gap-2">
            <Users className="h-4 w-4" /> Игроки
            <span className="font-mono normal-case tracking-normal text-xs text-subtle">({regs.length})</span>
          </h2>
          {!canEdit && (
            <p className="text-xs text-subtle mt-1">Регистрация закрыта — состав зафиксирован.</p>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Search & add registered */}
          <div className="pt-card p-4 space-y-3" ref={dropdownRef}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-subtle">
              <Search className="h-3.5 w-3.5" /> Добавить зарегистрированного
            </div>
            <div className="relative">
              <Input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Имя или @ник"
                className="h-11"
              />
              {showDropdown && query.trim().length > 0 && (
                <div className="absolute z-20 mt-1.5 w-full pt-card max-h-72 overflow-y-auto divide-y divide-hairline">
                  {searching && <div className="p-3 text-xs text-subtle">Поиск…</div>}
                  {!searching && results.length === 0 && (
                    <div className="p-3 text-xs text-subtle">Никого не нашли</div>
                  )}
                  {!searching && results.map((p) => {
                    const already = registeredIds.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={already || busyId === p.id}
                        onClick={() => addPlayer(p)}
                        className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                      >
                        <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden shrink-0 hairline">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-[10px] text-subtle font-mono">
                              {p.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm truncate">{p.name}</div>
                          <div className="text-[11px] text-subtle truncate">@{p.handle}</div>
                        </div>
                        <span className="font-display text-sm font-bold tabular-nums shrink-0">{p.rating}</span>
                        {already ? (
                          <span className="text-[10px] uppercase tracking-widest text-subtle shrink-0">в составе</span>
                        ) : (
                          <UserPlus className="h-4 w-4 text-subtle shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-[11px] text-subtle">Поиск по имени и нику среди всех игроков платформы.</p>
          </div>

          {/* Add guest */}
          <div className="pt-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-subtle">
              <Sparkles className="h-3.5 w-3.5" /> Добавить гостя
            </div>
            <div className="flex gap-2">
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !addingGuest && addGuest()}
                placeholder="Имя гостя"
                maxLength={40}
                className="h-11"
              />
              <Button onClick={addGuest} disabled={addingGuest || !guestName.trim()} className="h-11 px-4 rounded-full shrink-0">
                <UserPlus className="h-4 w-4 mr-1.5" /> Добавить
              </Button>
            </div>
            <p className="text-[11px] text-subtle">Гость без регистрации участвует в сетке как обычный игрок и помечен бейджем «guest».</p>
          </div>
        </div>
      )}

      {/* Roster */}
      {regs.length === 0 ? (
        <div className="pt-card p-6 text-sm text-muted-foreground text-center">
          Пока никого нет. {canEdit ? "Добавь игрока выше или дай им QR." : ""}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {regs.map((r, i) => {
            const p = players[r.player_id];
            if (!p) return null;
            return (
              <div key={r.player_id} className="pt-card p-3 flex items-center gap-3">
                <span className="text-subtle font-mono text-xs w-5 text-right shrink-0">{i + 1}</span>
                <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden shrink-0 hairline">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-subtle font-mono">
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate flex items-center gap-1.5">
                    <span className="truncate">{p.name}</span>
                    {p.is_guest && (
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md hairline bg-secondary text-subtle">guest</span>
                    )}
                  </div>
                  {!p.is_guest && p.handle && (
                    <div className="text-[11px] text-subtle truncate">@{p.handle}</div>
                  )}
                </div>
                <span className="font-display text-sm font-bold tabular-nums shrink-0">{p.rating}</span>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busyId === r.player_id}
                    onClick={() => removePlayer(r.player_id)}
                    className="h-8 w-8 text-subtle hover:text-destructive shrink-0"
                    aria-label="Убрать из турнира"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
