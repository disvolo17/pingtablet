import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldAlert, KeyRound, Loader2 } from "lucide-react";
import { markPasswordAuthCompleted } from "@/lib/authPlayer";

/**
 * Full-screen blocker shown when the signed-in user has `must_change_password`
 * in their auth metadata (set by an admin reset). Cannot be dismissed without
 * setting a new password.
 */
export default function ForcePasswordChange() {
  const [must, setMust] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    const evaluate = (meta: Record<string, unknown> | undefined | null) =>
      setMust(!!(meta && meta.must_change_password));

    supabase.auth.getSession().then(({ data }) => evaluate(data.session?.user.user_metadata));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      evaluate(session?.user.user_metadata);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pwd.length < 8) { setErr("Минимум 8 символов"); setShake((s) => s + 1); return; }
    if (pwd.length > 72) { setErr("Слишком длинный пароль"); setShake((s) => s + 1); return; }
    if (pwd !== confirm) { setErr("Пароли не совпадают"); setShake((s) => s + 1); return; }

    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const prevMeta = (sess.session?.user.user_metadata ?? {}) as Record<string, unknown>;
      const nextMeta = {
        ...prevMeta,
        must_change_password: false,
        password_reset_required: false,
        has_password: true,
        migration_completed: true,
        password_changed_at: new Date().toISOString(),
      };

      const { error } = await supabase.auth.updateUser({
        password: pwd,
        data: nextMeta,
      });
      if (error) {
        setErr(error.message);
        setShake((s) => s + 1);
        return;
      }
      await markPasswordAuthCompleted();
      await supabase.auth.refreshSession();
      setDone(true);
      toast.success("Пароль обновлён");
      setTimeout(() => setMust(false), 650);
      setPwd(""); setConfirm("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
      setShake((s) => s + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {must && (
        <motion.div
          className="fixed inset-0 z-[200] bg-paper/95 backdrop-blur-xl flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.form
            key={shake}
            onSubmit={submit}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1, x: err ? [0, -8, 8, -6, 6, -3, 3, 0] : 0 }}
            transition={{ x: { duration: 0.4 } }}
            className="w-full max-w-md pt-card p-7 space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-ink/10 grid place-items-center">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Действие администратора</p>
                <h2 className="font-display text-xl">{done ? "Доступ восстановлен" : "Установи новый пароль"}</h2>
              </div>
            </div>
            <p className="text-sm text-subtle">
              {done
                ? "Новый пароль принят. Миграция завершена, вход открыт."
                : "Администратор сбросил твой пароль. Перед продолжением задай новый — он будет храниться в зашифрованном виде, никто не сможет его увидеть."}
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-widest text-subtle">Новый пароль</Label>
                <div className="relative mt-1.5">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-subtle" />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={pwd}
                    onChange={(e) => { setPwd(e.target.value); if (err) setErr(null); }}
                    className="h-11 pl-9"
                    placeholder="Минимум 8 символов"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-subtle">Повтори пароль</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); if (err) setErr(null); }}
                  className="h-11 mt-1.5"
                />
              </div>
              {err && (
                <p className="text-sm text-destructive" style={{ textShadow: "0 0 12px hsl(var(--destructive)/0.45)" }}>
                  {err}
                </p>
              )}
            </div>

            <Button type="submit" disabled={busy} className="w-full h-12 rounded-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Сохранить пароль
            </Button>
            <p className="text-[11px] text-subtle text-center">
              Пароль хешируется (bcrypt) на сервере. Plaintext не сохраняется.
            </p>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
