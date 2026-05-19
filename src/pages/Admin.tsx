import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { callAdmin, getAdminCode, setAdminCode, useIsAdmin } from "@/lib/admin";
import { toast } from "sonner";
import { Lock, Plus, Trash2, ChevronRight, LogOut, Search, Save, UserCog, Sparkles, KeyRound, Copy, ShieldAlert, Loader2, Coins, Package, Gift } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type Tournament = {
  id: string; name: string; location: string | null; starts_at: string | null; status: string; created_at: string;
};

type Player = {
  id: string; handle: string; name: string; rating: number; wins: number; losses: number; status: string; bio: string | null; avatar_url: string | null; handicap: number;
};

export default function Admin() {
  const { isAdmin, logout } = useIsAdmin();
  const [code, setCode] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => { document.title = "Админ — ПИНГ ТАБЛЕТ"; }, []);

  const loadTournaments = async () => {
    const { data } = await supabase
      .from("tournaments")
      .select("id, name, location, starts_at, status, created_at")
      .order("created_at", { ascending: false });
    setTournaments((data as Tournament[]) ?? []);
  };

  const loadPlayers = async () => {
    const { data } = await supabase
      .from("players")
      .select("id, handle, name, rating, wins, losses, status, bio, avatar_url, handicap")
      .order("rating", { ascending: false });
    setPlayers((data as Player[]) ?? []);
  };

  useEffect(() => { if (isAdmin) { loadTournaments(); loadPlayers(); } }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("admin-tournaments")
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => loadTournaments())
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => loadPlayers())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  const handleLogin = async () => {
    if (!code.trim()) return;
    setAdminCode(code.trim());
    try {
      await callAdmin({ type: "verify" });
      toast.success("Добро пожаловать");
    } catch (e) {
      setAdminCode(null);
      toast.error(e instanceof Error ? e.message : "Неверный код");
    }
  };

  if (!isAdmin) {
    return (
      <div className="container max-w-md py-24">
        <div className="pt-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="h-5 w-5" />
            <h1 className="text-2xl">Админ-вход</h1>
          </div>
          <Label htmlFor="code" className="text-xs uppercase tracking-widest text-subtle">Секретный код</Label>
          <Input
            id="code"
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="h-12 mt-2"
            placeholder="••••••••"
          />
          <Button onClick={handleLogin} className="w-full mt-4 h-12 rounded-full">Войти</Button>
          <p className="text-xs text-subtle mt-4">Код задаётся в настройках Lovable Cloud (ADMIN_SECRET_CODE).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-12">
      <div className="flex items-center justify-between mb-10">
        <div>
          <p className="text-xs uppercase tracking-widest text-subtle mb-1">Админ-панель</p>
          <h1 className="pt-display text-4xl">Турниры</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/achievements">
            <Button variant="outline" size="sm" className="rounded-full">
              <Sparkles className="h-4 w-4 mr-2" /> Достижения
            </Button>
          </Link>
          <Button variant="ghost" onClick={logout} className="text-subtle hover:text-ink">
            <LogOut className="h-4 w-4 mr-2" />Выйти
          </Button>
        </div>
      </div>

      <CreateTournamentForm onCreated={loadTournaments} />

      <PlayerAdminPanel players={players} onChanged={loadPlayers} />

      <div className="mt-10">
        <h2 className="text-sm uppercase tracking-widest text-subtle mb-4">Все турниры</h2>
        {tournaments.length === 0 ? (
          <p className="text-muted-foreground text-sm">Пока ничего нет. Создай первый турнир выше.</p>
        ) : (
          <div className="pt-card divide-y divide-hairline overflow-hidden">
            {tournaments.map((t) => (
              <AdminRow key={t.id} t={t} onDelete={loadTournaments} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateTournamentForm({ onCreated }: { onCreated: () => void }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Нужно название"); return; }
    setBusy(true);
    try {
      const r = await callAdmin<{ tournament: { id: string } }>({
        type: "create_tournament",
        payload: {
          name: name.trim(),
          location: location.trim() || undefined,
          starts_at: startsAt ? new Date(startsAt).toISOString() : undefined,
          ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
          description: description.trim() || undefined,
          cover_url: coverUrl.trim() || undefined,
        },
      });
      toast.success("Турнир создан");
      setName(""); setLocation(""); setStartsAt(""); setEndsAt(""); setDescription(""); setCoverUrl(""); setOpen(false);
      onCreated();
      if (r?.tournament?.id) navigate(`/admin/t/${r.tournament.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="rounded-full h-12 px-6">
        <Plus className="h-4 w-4 mr-2" /> Новый турнир
      </Button>
    );
  }

  return (
    <div className="pt-card p-6 space-y-4">
      <div>
        <Label className="text-xs uppercase tracking-widest text-subtle">Название</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Турнир в пятницу №5" className="h-11 mt-1.5" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs uppercase tracking-widest text-subtle">Место</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Бар, клуб или парк" className="h-11 mt-1.5" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-subtle">Афиша (URL)</Label>
          <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" className="h-11 mt-1.5" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-subtle">Начало</Label>
          <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="h-11 mt-1.5" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-subtle">Конец</Label>
          <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="h-11 mt-1.5" />
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-widest text-subtle">Описание</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1.5" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
        <Button onClick={submit} disabled={busy} className="rounded-full px-6">Создать</Button>
      </div>
    </div>
  );
}

function PlayerAdminPanel({ players, onChanged }: { players: Player[]; onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = players.filter((p) => `${p.name} ${p.handle} ${p.status}`.toLowerCase().includes(query.toLowerCase().trim()));
  const selected = players.find((p) => p.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (!selectedId && filtered[0]) setSelectedId(filtered[0].id);
    if (selectedId && !players.some((p) => p.id === selectedId)) setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, players, selectedId]);

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-sm uppercase tracking-widest text-subtle">Игроки</h2>
          <p className="text-xs text-subtle mt-1">Редактирование профиля, рейтинга, статистики, статуса и PIN.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-subtle" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти игрока" className="pl-9 h-10" />
        </div>
      </div>
      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        <div className="pt-card divide-y divide-hairline overflow-hidden max-h-[520px] overflow-y-auto">
          {filtered.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Игроки не найдены.</p> : filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`w-full text-left p-4 transition-colors ${selected?.id === p.id ? "bg-secondary" : "hover:bg-secondary/50"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-subtle truncate">@{p.handle} · {p.status || "Игрок"}</div>
                </div>
                <span className="font-display font-bold tabular-nums">{p.rating}</span>
              </div>
            </button>
          ))}
        </div>
        {selected ? <PlayerEditor key={selected.id} player={selected} onChanged={onChanged} /> : (
          <div className="pt-card p-6 text-sm text-muted-foreground">Выбери игрока слева.</div>
        )}
      </div>
    </div>
  );
}

type AuthInfo = {
  has_account: boolean;
  email?: string | null;
  last_sign_in_at?: string | null;
  created_at?: string | null;
  must_change_password?: boolean;
};

function PlayerEditor({ player, onChanged }: { player: Player; onChanged: () => void }) {
  const [draft, setDraft] = useState(player);
  const [busy, setBusy] = useState(false);
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [tempPwd, setTempPwd] = useState<string | null>(null);

  useEffect(() => { setDraft(player); }, [player]);

  useEffect(() => {
    let cancelled = false;
    setAuth(null); setTempPwd(null);
    setAuthLoading(true);
    callAdmin<AuthInfo>({ type: "get_player_auth_info", payload: { id: player.id } })
      .then((r) => { if (!cancelled) setAuth(r); })
      .catch(() => { if (!cancelled) setAuth({ has_account: false }); })
      .finally(() => { if (!cancelled) setAuthLoading(false); });
    return () => { cancelled = true; };
  }, [player.id]);

  const save = async () => {
    setBusy(true);
    try {
      await callAdmin({
        type: "update_player",
        payload: {
          id: player.id,
          handle: draft.handle,
          name: draft.name,
          rating: draft.rating,
          wins: draft.wins,
          losses: draft.losses,
          status: draft.status,
          bio: draft.bio,
          avatar_url: draft.avatar_url,
          handicap: draft.handicap,
        },
      });
      toast.success("Игрок обновлён");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(`Удалить игрока @${player.handle}? Его регистрации и матчи тоже будут удалены.`)) return;
    try {
      await callAdmin({ type: "delete_player", payload: { id: player.id } });
      toast.success("Игрок удалён");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось удалить");
    }
  };

  const doReset = async () => {
    setResetting(true);
    try {
      const r = await callAdmin<{ temp_password: string }>({
        type: "reset_player_password",
        payload: { id: player.id },
      });
      setTempPwd(r.temp_password);
      // refresh metadata
      const info = await callAdmin<AuthInfo>({ type: "get_player_auth_info", payload: { id: player.id } });
      setAuth(info);
      toast.success("Пароль сброшен");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сбросить");
    } finally {
      setResetting(false);
    }
  };

  const lastLogin = auth?.last_sign_in_at
    ? new Date(auth.last_sign_in_at).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })
    : "никогда";

  return (
    <div className="pt-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <UserCog className="h-4 w-4 text-subtle" />
          <div className="font-medium truncate">@{player.handle}</div>
        </div>
        <Link to={`/p/${player.handle}`} className="text-xs text-subtle hover:text-ink">Открыть профиль</Link>
      </div>

      {/* Auth / security card */}
      <div className="rounded-lg border border-hairline bg-secondary/40 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5 text-subtle" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-subtle">Безопасность аккаунта</span>
          </div>
          {auth?.must_change_password && (
            <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-destructive/10 text-destructive flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> сменит пароль
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div className="text-subtle">Аккаунт</div>
          <div className="font-mono truncate">
            {authLoading ? "…" : auth?.has_account ? "активен" : "не привязан"}
          </div>
          <div className="text-subtle">Последний вход</div>
          <div className="font-mono">{authLoading ? "…" : lastLogin}</div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!auth?.has_account || resetting}
          onClick={() => setResetOpen(true)}
          className="w-full rounded-full"
        >
          {resetting ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <KeyRound className="h-3.5 w-3.5 mr-2" />}
          Сбросить пароль
        </Button>
        <p className="text-[10px] text-subtle leading-relaxed">
          Пароли хранятся только в виде bcrypt-хеша. Увидеть реальный пароль игрока невозможно — можно лишь выдать одноразовый временный пароль.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Имя"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-10" /></Field>
        <Field label="Ник"><Input value={draft.handle} onChange={(e) => setDraft({ ...draft, handle: e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) })} className="h-10" /></Field>
        <Field label="Статус"><Input list="player-statuses" value={draft.status || ""} onChange={(e) => setDraft({ ...draft, status: e.target.value })} placeholder="Игрок" className="h-10" /></Field>
        <Field label="Фора"><Input type="number" min={-50} max={50} value={draft.handicap ?? 0} onChange={(e) => setDraft({ ...draft, handicap: Math.max(-50, Math.min(50, Number(e.target.value) || 0)) })} className="h-10" /></Field>
        <Field label="Рейтинг"><Input type="number" value={draft.rating} onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })} className="h-10" /></Field>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
          <Field label="Победы"><Input type="number" value={draft.wins} onChange={(e) => setDraft({ ...draft, wins: Number(e.target.value) })} className="h-10" /></Field>
          <Field label="Поражения"><Input type="number" value={draft.losses} onChange={(e) => setDraft({ ...draft, losses: Number(e.target.value) })} className="h-10" /></Field>
        </div>
      </div>
      <Field label="Ссылка на аватар"><Input value={draft.avatar_url ?? ""} onChange={(e) => setDraft({ ...draft, avatar_url: e.target.value || null })} placeholder="https://…" className="h-10" /></Field>
      <Field label="Описание"><Textarea value={draft.bio ?? ""} onChange={(e) => setDraft({ ...draft, bio: e.target.value || null })} rows={3} /></Field>
      <datalist id="player-statuses">
        <option value="Игрок" />
        <option value="Новичок" />
        <option value="Профи" />
        <option value="Чемпион" />
        <option value="Амбассадор" />
        <option value="Заблокирован" />
      </datalist>
      <div className="flex justify-between gap-2 flex-wrap">
        <Button variant="ghost" onClick={remove} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Удалить</Button>
        <Button onClick={save} disabled={busy} className="rounded-full px-5"><Save className="h-4 w-4 mr-2" />Сохранить</Button>
      </div>

      <StickerEconomyCard playerId={player.id} handle={player.handle} />

      <ResetPasswordDialog
        open={resetOpen}
        onOpenChange={(v) => { setResetOpen(v); if (!v) setTempPwd(null); }}
        handle={player.handle}
        tempPassword={tempPwd}
        resetting={resetting}
        onConfirm={doReset}
      />
    </div>
  );
}

function ResetPasswordDialog({
  open, onOpenChange, handle, tempPassword, resetting, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  handle: string;
  tempPassword: string | null;
  resetting: boolean;
  onConfirm: () => void;
}) {
  const copy = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast.success("Скопировано");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Сброс пароля
          </DialogTitle>
          <DialogDescription>
            Игрок <span className="font-mono">@{handle}</span> при следующем входе обязан задать новый пароль.
            Все активные сессии будут завершены.
          </DialogDescription>
        </DialogHeader>

        {!tempPassword ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-hairline bg-secondary/40 p-3 text-xs text-subtle leading-relaxed">
              Будет сгенерирован одноразовый пароль из 12 символов. Текущий пароль игрока невозможно увидеть — он хранится только в виде хеша.
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
              <Button onClick={onConfirm} disabled={resetting} className="rounded-full">
                {resetting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                Сгенерировать
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-hairline bg-paper p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-subtle mb-2">Временный пароль</div>
              <div className="font-mono text-lg tracking-wider break-all select-all">{tempPassword}</div>
              <Button onClick={copy} variant="outline" size="sm" className="mt-3 rounded-full w-full">
                <Copy className="h-3.5 w-3.5 mr-2" /> Скопировать
              </Button>
            </div>
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Покажи пароль игроку лично. После закрытия окна увидеть его снова будет нельзя.</span>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} className="rounded-full">Готово</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs uppercase tracking-widest text-subtle space-y-1.5"><span>{label}</span>{children}</label>;
}

function AdminRow({ t, onDelete }: { t: Tournament; onDelete: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setRemoving(true);
    try {
      await callAdmin({ type: "delete_tournament", payload: { id: t.id } });
      toast.success("Турнир удалён");
      setConfirmOpen(false);
      onDelete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setRemoving(false);
    }
  };

  const statusMap: Record<string, { label: string; tone: string }> = {
    registration: { label: "Регистрация", tone: "bg-secondary text-subtle" },
    live: { label: "В эфире", tone: "bg-orange/15 text-orange" },
    finished: { label: "Завершён", tone: "bg-muted text-muted-foreground" },
  };
  const status = statusMap[t.status] ?? { label: t.status, tone: "bg-secondary text-subtle" };

  return (
    <>
      <div className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 hover:bg-secondary/40 transition-colors">
        <Link to={`/admin/t/${t.id}`} className="flex-1 min-w-0 block">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${status.tone}`}>
              {status.label}
            </span>
          </div>
          <div className="font-medium truncate">{t.name}</div>
          {t.location && (
            <div className="text-xs text-subtle truncate mt-0.5">{t.location}</div>
          )}
        </Link>
        <div className="flex items-center gap-2 sm:gap-1 self-end sm:self-auto shrink-0">
          <Link to={`/admin/t/${t.id}`} className="flex-1 sm:flex-none">
            <Button variant="outline" size="sm" className="rounded-full h-9 w-full sm:w-auto">
              Управление
              <ChevronRight className="h-4 w-4 ml-1 -mr-1" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmOpen(true)}
            className="h-9 w-9 text-subtle hover:text-destructive"
            aria-label="Удалить турнир"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(o) => !removing && setConfirmOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить турнир?</DialogTitle>
            <DialogDescription>
              Турнир <span className="font-medium text-foreground">«{t.name}»</span> будет удалён вместе со всеми регистрациями и матчами. Действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={removing}>Отмена</Button>
            <Button variant="destructive" onClick={remove} disabled={removing} className="rounded-full">
              {removing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StickerEconomyCard({ playerId, handle }: { playerId: string; handle: string }) {
  const [shards, setShards] = useState<number>(0);
  const [invCount, setInvCount] = useState<number>(0);
  const [placedCount, setPlacedCount] = useState<number>(0);
  const [shardDelta, setShardDelta] = useState<string>("50");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [{ data: w }, { count: inv }, { count: jr }] = await Promise.all([
      supabase.from("sticker_wallet").select("shards").eq("owner_id", playerId).maybeSingle(),
      supabase.from("sticker_inventory").select("id", { count: "exact", head: true }).eq("owner_id", playerId),
      supabase.from("sticker_journal").select("id", { count: "exact", head: true }).eq("owner_id", playerId),
    ]);
    setShards((w as { shards: number } | null)?.shards ?? 0);
    setInvCount(inv ?? 0);
    setPlacedCount(jr ?? 0);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [playerId]);

  const grantShards = async () => {
    const amt = Math.round(Number(shardDelta));
    if (!Number.isFinite(amt) || amt === 0) { toast.error("Введи ненулевую сумму"); return; }
    setBusy("shards");
    try {
      await callAdmin({ type: "sticker.grant_shards", payload: { player_id: playerId, amount: amt } });
      toast.success(`@${handle}: ${amt > 0 ? "+" : ""}${amt} осколков`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally { setBusy(null); }
  };

  const grantPack = async () => {
    setBusy("pack");
    try {
      const r = await callAdmin<{ stickers: unknown[] }>({ type: "sticker.grant_pack", payload: { player_id: playerId } });
      toast.success(`Выдан пак: ${r.stickers?.length ?? 0} наклеек`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally { setBusy(null); }
  };

  return (
    <div className="rounded-lg border border-hairline bg-secondary/40 p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-subtle" />
        <span className="text-[11px] uppercase tracking-[0.18em] text-subtle">Экономика наклеек</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Осколки" value={shards} />
        <Stat label="В инвентаре" value={invCount} />
        <Stat label="В журнале" value={placedCount} />
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={shardDelta}
          onChange={(e) => setShardDelta(e.target.value)}
          className="h-9 w-24"
        />
        <Button size="sm" variant="outline" disabled={busy === "shards"} onClick={grantShards} className="rounded-full flex-1">
          <Coins className="h-3.5 w-3.5 mr-1.5" /> Выдать осколки
        </Button>
      </div>
      <Button size="sm" disabled={busy === "pack"} onClick={grantPack} className="w-full rounded-full bg-orange hover:bg-orange/90 text-paper">
        {busy === "pack" ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Package className="h-3.5 w-3.5 mr-2" />}
        Подарить пак (3 наклейки)
      </Button>
      <p className="text-[10px] text-subtle leading-relaxed flex items-start gap-1.5">
        <Gift className="h-3 w-3 mt-0.5 shrink-0" />
        Игрок мгновенно увидит наклейки в своём инвентаре через realtime.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-paper/60 hairline py-2">
      <div className="font-display text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-subtle">{label}</div>
    </div>
  );
}
