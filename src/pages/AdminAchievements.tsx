import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { callAdmin, useIsAdmin } from "@/lib/admin";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Sparkles, RefreshCcw, Search, Award, X } from "lucide-react";
import type { Achievement, Rarity } from "@/lib/achievements";
import { CONDITION_TYPES, RARITIES, RARITY_LABEL } from "@/lib/achievements";
import AchievementCard from "@/components/achievements/AchievementCard";

type Player = { id: string; name: string; handle: string };

const EMPTY: Achievement = {
  id: "",
  code: "",
  title: "",
  description: "",
  icon: "🏓",
  condition_type: "manual",
  condition_value: {},
  rarity: "common",
  glow_color: "0 0% 50%",
  is_active: true,
  sort_order: 0,
};

const DEFAULT_GLOW: Record<Rarity, string> = {
  common:    "0 0% 50%",
  rare:      "210 90% 55%",
  epic:      "270 80% 60%",
  legendary: "45 100% 55%",
};

export default function AdminAchievements() {
  const { isAdmin } = useIsAdmin();
  const [items, setItems] = useState<Achievement[]>([]);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Достижения — Админ — ПИНГ ТАБЛЕТ"; }, []);

  const load = async () => {
    const { data } = await supabase.from("achievements").select("*").order("sort_order").order("title");
    setItems((data as unknown as Achievement[]) ?? []);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase.channel("admin-achievements")
      .on("postgres_changes", { event: "*", schema: "public", table: "achievements" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="container max-w-md py-24">
        <div className="pt-card p-8 text-center">
          <p className="mb-4">Сначала войди как админ.</p>
          <Link to="/admin"><Button>На вход</Button></Link>
        </div>
      </div>
    );
  }

  const recomputeAll = async () => {
    if (!confirm("Пересчитать достижения для всех игроков?")) return;
    setBusy(true);
    try {
      const r = await callAdmin<{ granted: number; players: number }>({ type: "achievement.recompute_all" });
      toast.success(`Готово. Игроков: ${r.players}, выдано: ${r.granted}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally { setBusy(false); }
  };

  return (
    <div className="container max-w-6xl py-10">
      <Link to="/admin" className="inline-flex items-center text-sm text-subtle hover:text-ink mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" /> Админ-панель
      </Link>

      <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-subtle mb-1">Управление</p>
          <h1 className="pt-display text-4xl flex items-center gap-3"><Sparkles className="h-7 w-7" /> Достижения</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={recomputeAll} disabled={busy} className="rounded-full">
            <RefreshCcw className="h-4 w-4 mr-2" /> Пересчитать всем
          </Button>
          <Button onClick={() => setEditing({ ...EMPTY })} className="rounded-full">
            <Plus className="h-4 w-4 mr-2" /> Новое
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground">Пусто. Создай первое достижение.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-12">
          {items.map((a) => (
            <AchievementCard key={a.id} achievement={a} unlockedAt={new Date().toISOString()} onClick={() => setEditing(a)} />
          ))}
        </div>
      )}

      <ManualGrantPanel achievements={items} onChanged={load} />

      {editing && (
        <EditorDialog
          achievement={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function EditorDialog({ achievement, onClose, onSaved }: { achievement: Achievement; onClose: () => void; onSaved: () => void }) {
  const isNew = !achievement.id;
  const [draft, setDraft] = useState<Achievement>(achievement);
  const [valueText, setValueText] = useState(JSON.stringify(achievement.condition_value ?? {}, null, 2));
  const [busy, setBusy] = useState(false);

  const setRarity = (r: Rarity) => {
    setDraft((d) => ({
      ...d,
      rarity: r,
      glow_color: d.glow_color === DEFAULT_GLOW[d.rarity] ? DEFAULT_GLOW[r] : d.glow_color,
    }));
  };

  const save = async () => {
    let parsed: Record<string, unknown> = {};
    try { parsed = valueText.trim() ? JSON.parse(valueText) : {}; }
    catch { toast.error("Параметры условия — некорректный JSON"); return; }
    setBusy(true);
    try {
      const payload = {
        code: draft.code,
        title: draft.title,
        description: draft.description,
        icon: draft.icon,
        condition_type: draft.condition_type,
        condition_value: parsed,
        rarity: draft.rarity,
        glow_color: draft.glow_color,
        is_active: draft.is_active,
        sort_order: draft.sort_order,
      };
      if (isNew) await callAdmin({ type: "achievement.create", payload });
      else await callAdmin({ type: "achievement.update", payload: { id: draft.id, ...payload } });
      toast.success(isNew ? "Создано" : "Сохранено");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(`Удалить достижение "${draft.title}"?`)) return;
    try {
      await callAdmin({ type: "achievement.delete", payload: { id: draft.id } });
      toast.success("Удалено");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const condShape = CONDITION_TYPES.find((c) => c.value === draft.condition_type)?.valueShape;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={onClose}>
      <div className="pt-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{isNew ? "Новое достижение" : "Редактирование"}</h2>
          <button onClick={onClose} className="text-subtle hover:text-ink"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid sm:grid-cols-[80px_1fr] gap-4 items-start">
          <div>
            <Label className="text-xs uppercase tracking-widest text-subtle">Иконка</Label>
            <Input value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} className="text-2xl text-center h-16 mt-1.5" maxLength={4} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-subtle">Код</Label>
              <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="my_achievement" className="h-10 mt-1.5 font-mono text-xs" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-subtle">Название</Label>
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="h-10 mt-1.5" />
            </div>
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-widest text-subtle">Описание</Label>
          <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} className="mt-1.5" />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-widest text-subtle">Тип условия</Label>
            <select
              value={draft.condition_type}
              onChange={(e) => setDraft({ ...draft, condition_type: e.target.value })}
              className="w-full h-10 mt-1.5 rounded-md border border-input bg-background px-3 text-sm"
            >
              {CONDITION_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-subtle">Параметры (JSON) {condShape && <span className="text-subtle/60 normal-case font-mono">— напр. {condShape}</span>}</Label>
            <Input value={valueText} onChange={(e) => setValueText(e.target.value)} className="h-10 mt-1.5 font-mono text-xs" placeholder="{}" />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-widest text-subtle">Редкость</Label>
            <div className="mt-1.5 inline-flex flex-wrap gap-1 rounded-full hairline bg-card p-0.5 text-xs w-full">
              {RARITIES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRarity(r)}
                  className={`px-3 py-1.5 rounded-full transition-colors flex-1 ${draft.rarity === r ? "bg-ink text-paper" : "text-subtle hover:text-ink"}`}
                >
                  {RARITY_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-subtle">Цвет свечения (HSL)</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Input value={draft.glow_color} onChange={(e) => setDraft({ ...draft, glow_color: e.target.value })} className="h-10 font-mono text-xs" placeholder="45 95% 55%" />
              <span className="h-10 w-10 rounded-md border border-hairline shrink-0" style={{ background: `hsl(${draft.glow_color})` }} />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-subtle">Порядок</Label>
            <Input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })} className="h-10 mt-1.5" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
          Активно (выдаётся игрокам)
        </label>

        <div className="flex justify-between gap-2 pt-2 border-t border-hairline">
          {!isNew ? (
            <Button variant="ghost" onClick={remove} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Удалить
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Отмена</Button>
            <Button onClick={save} disabled={busy} className="rounded-full px-5">
              <Save className="h-4 w-4 mr-2" /> Сохранить
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualGrantPanel({ achievements, onChanged }: { achievements: Achievement[]; onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("players").select("id, name, handle").order("name").limit(500);
      setPlayers((data as Player[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!selectedPlayer) { setUnlocked(new Set()); return; }
    (async () => {
      const { data } = await supabase.from("user_achievements").select("achievement_id").eq("player_id", selectedPlayer.id);
      setUnlocked(new Set(((data as { achievement_id: string }[]) ?? []).map((r) => r.achievement_id)));
    })();
  }, [selectedPlayer]);

  const filtered = useMemo(
    () => players.filter((p) => `${p.name} ${p.handle}`.toLowerCase().includes(query.toLowerCase().trim())).slice(0, 12),
    [players, query],
  );

  const toggle = async (a: Achievement) => {
    if (!selectedPlayer) return;
    const has = unlocked.has(a.id);
    setBusy(a.id);
    try {
      await callAdmin({
        type: has ? "achievement.revoke" : "achievement.grant",
        payload: { player_id: selectedPlayer.id, achievement_id: a.id },
      });
      const next = new Set(unlocked);
      if (has) next.delete(a.id); else next.add(a.id);
      setUnlocked(next);
      toast.success(has ? "Отозвано" : "Выдано");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally { setBusy(null); }
  };

  return (
    <div className="pt-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Award className="h-4 w-4 text-subtle" />
        <h2 className="text-sm uppercase tracking-widest text-subtle">Ручная выдача</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-subtle" />
        <Input value={query} onChange={(e) => { setQuery(e.target.value); setSelectedPlayer(null); }} placeholder="Найди игрока по имени или нику" className="pl-9 h-10" />
      </div>

      {!selectedPlayer && query && (
        <div className="grid sm:grid-cols-2 gap-2">
          {filtered.length === 0 ? <p className="text-sm text-muted-foreground">Игроки не найдены.</p> : filtered.map((p) => (
            <button key={p.id} onClick={() => { setSelectedPlayer(p); setQuery(""); }} className="text-left pt-card hairline p-3 hover:bg-secondary transition-colors">
              <div className="font-medium truncate">{p.name}</div>
              <div className="text-xs text-subtle">@{p.handle}</div>
            </button>
          ))}
        </div>
      )}

      {selectedPlayer && (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-subtle">Игрок</div>
              <div className="font-medium">{selectedPlayer.name} <span className="text-subtle text-xs">@{selectedPlayer.handle}</span></div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedPlayer(null)}><X className="h-4 w-4 mr-1" /> Сменить</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {achievements.map((a) => {
              const has = unlocked.has(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggle(a)}
                  disabled={busy === a.id}
                  className={`text-left rounded-xl border p-3 flex items-center gap-3 transition-colors ${has ? "border-ink bg-secondary" : "border-hairline hover:bg-secondary/50"}`}
                >
                  <span className="text-2xl">{a.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-sm truncate">{a.title}</span>
                    <span className="block text-[11px] text-subtle">{RARITY_LABEL[a.rarity]}</span>
                  </span>
                  <span className={`text-[11px] font-mono ${has ? "text-ink" : "text-subtle"}`}>{has ? "выдано" : "выдать"}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
