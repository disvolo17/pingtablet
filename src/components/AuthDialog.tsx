import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AtSign, Lock, ShieldCheck, Sparkles, Copy, Send, Trophy, Check } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { markPasswordAuthCompleted, syncCurrentPlayerFromSession } from "@/lib/authPlayer";
import { setCurrentPlayer, type CurrentPlayer } from "@/lib/currentPlayer";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAuthed?: (p: CurrentPlayer) => void;
  intent?: "signin" | "signup";
  forced?: boolean;
};

/* ---------- Validation ---------- */
const nicknameSchema = z
  .string()
  .trim()
  .min(3, "Минимум 3 символа")
  .max(16, "Максимум 16 символов")
  .regex(/^[a-zA-Z0-9_]+$/, "Только латиница, цифры и _");
const passwordSchema = z.string().min(6, "Минимум 6 символов").max(72, "Слишком длинный пароль");

const SUPPORT_TG = "disvolo";
const SYNTH_EMAIL_DOMAIN = "pingtablet.app";
const synthEmail = (nick: string) => `${nick.toLowerCase()}@${SYNTH_EMAIL_DOMAIN}`;

/* ---------- Component ---------- */
export default function AuthDialog({ open, onOpenChange, onAuthed, intent = "signin", forced = false }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">(intent);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [welcome, setWelcome] = useState<{ name: string } | null>(null);

  useEffect(() => { if (open) setMode(intent); }, [open, intent]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={`p-0 overflow-hidden border-0 bg-transparent shadow-none max-w-none w-screen h-[100svh] sm:h-auto sm:max-w-md sm:w-auto sm:rounded-3xl ${forced ? "[&>button.absolute]:hidden" : ""}`}
          onInteractOutside={(e) => { if (forced) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (forced) e.preventDefault(); }}
        >
          <DialogTitle className="sr-only">Вход в ПИНГ ТАБЛЕТ</DialogTitle>
          <DialogDescription className="sr-only">Игровой профиль · никнейм и пароль</DialogDescription>

          <div className="relative w-full h-full sm:h-auto overflow-hidden sm:rounded-3xl">
            <ArenaBackdrop />

            <div className="relative z-10 flex min-h-[100svh] sm:min-h-0 items-center justify-center p-5 sm:p-7">
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-sm"
              >
                <AuthCard
                  mode={mode}
                  setMode={setMode}
                  onForgot={() => setForgotOpen(true)}
                  onSuccess={(player) => {
                    onAuthed?.(player);
                    if (mode === "signup") {
                      setWelcome({ name: player.name });
                      setTimeout(() => { setWelcome(null); onOpenChange(false); }, 1700);
                    } else {
                      onOpenChange(false);
                    }
                  }}
                />
              </motion.div>
            </div>

            <AnimatePresence>
              {welcome && <WelcomeOverlay name={welcome.name} />}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </>
  );
}

/* ---------- Cinematic backdrop ---------- */
function ArenaBackdrop() {
  return (
    <div className="absolute inset-0 -z-0 overflow-hidden">
      {/* Deep gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, hsl(155 50% 14%) 0%, hsl(155 45% 6%) 55%, hsl(155 55% 3%) 100%)",
        }}
      />
      {/* Orange spotlight */}
      <motion.div
        aria-hidden
        className="absolute -top-20 left-1/2 -translate-x-1/2 h-[60vh] w-[60vh] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(closest-side, hsl(22 96% 55% / 0.32), hsl(22 96% 55% / 0.06) 60%, transparent 80%)",
          filter: "blur(20px)",
        }}
        animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.05, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Bottom forest glow */}
      <div
        className="absolute -bottom-40 -left-20 h-[50vh] w-[60vw] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(closest-side, hsl(150 60% 22% / 0.45), transparent 70%)", filter: "blur(40px)" }}
      />
      {/* Subtle table grid */}
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(60 20% 96% / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(60 20% 96% / 0.5) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      {/* Floating particles (ping pong balls) */}
      <Particles />
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 200px 40px hsl(0 0% 0% / 0.7)" }} />
    </div>
  );
}

function Particles() {
  const dots = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 4 + Math.random() * 10,
        dur: 9 + Math.random() * 10,
        delay: Math.random() * 8,
        opacity: 0.18 + Math.random() * 0.35,
      })),
    [],
  );
  return (
    <div className="absolute inset-0 pointer-events-none">
      {dots.map((d) => (
        <motion.span
          key={d.id}
          className="absolute rounded-full"
          style={{
            left: `${d.left}%`,
            bottom: -20,
            width: d.size,
            height: d.size,
            background: "radial-gradient(circle at 30% 30%, hsl(28 100% 80%), hsl(22 96% 55%) 70%)",
            boxShadow: "0 0 14px hsl(22 96% 55% / 0.6)",
            opacity: d.opacity,
          }}
          animate={{ y: ["0vh", "-110vh"], opacity: [0, d.opacity, 0] }}
          transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}

/* ---------- Auth card ---------- */
function AuthCard({
  mode,
  setMode,
  onForgot,
  onSuccess,
}: {
  mode: "signin" | "signup";
  setMode: (m: "signin" | "signup") => void;
  onForgot: () => void;
  onSuccess: (p: CurrentPlayer) => void;
}) {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(0);
  const [errors, setErrors] = useState<{ nickname?: string; password?: string; confirm?: string }>({});
  const formRef = useRef<HTMLFormElement>(null);

  // Reset confirm when switching modes
  useEffect(() => { setConfirm(""); setErrors({}); }, [mode]);

  const fail = (msg: string, field?: keyof typeof errors) => {
    if (field) setErrors((e) => ({ ...e, [field]: msg }));
    setShake((s) => s + 1);
    toast.error(msg);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const nick = nicknameSchema.safeParse(nickname);
      if (!nick.success) { fail(nick.error.issues[0].message, "nickname"); return; }
      const pwd = passwordSchema.safeParse(password);
      if (!pwd.success) { fail(pwd.error.issues[0].message, "password"); return; }

      const normalized = nick.data.toLowerCase();
      const email = synthEmail(normalized);

      if (mode === "signup") {
        if (password !== confirm) { fail("Пароли не совпадают", "confirm"); return; }

        // Pre-check nickname uniqueness
        const { data: taken } = await supabase
          .from("players")
          .select("id")
          .ilike("handle", normalized)
          .maybeSingle();
        if (taken) { fail("Никнейм уже занят", "nickname"); return; }

        const { error } = await supabase.auth.signUp({
          email,
          password: pwd.data,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              name: nick.data,
              has_password: true,
              migration_completed: true,
              password_reset_required: false,
              must_change_password: false,
            },
          },
        });
        if (error) {
          if (/registered|exists/i.test(error.message)) { fail("Никнейм уже занят", "nickname"); return; }
          fail(error.message); return;
        }

        const player = await syncCurrentPlayerFromSession(nick.data);
        if (!player) { fail("Не удалось войти после регистрации"); return; }
        await markPasswordAuthCompleted();
        setCurrentPlayer(player);
        onSuccess(player);
      } else {
        const { data, error } = await supabase.functions.invoke("password-login", {
          body: { handle: normalized, password: pwd.data },
        });
        const result = data as { session?: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]; player?: CurrentPlayer; error?: string } | null;
        if (error || result?.error || !result?.session) { fail("Неверный никнейм или пароль", "password"); return; }
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
        if (sessionError) { fail(sessionError.message, "password"); return; }
        await supabase.auth.refreshSession();
        const player = result.player ?? await syncCurrentPlayerFromSession();
        if (!player) { fail("Не удалось загрузить профиль"); return; }
        setCurrentPlayer(player);
        toast.success(`С возвращением, ${player.name}!`);
        onSuccess(player);
      }
    } catch (err) {
      fail(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      key={shake}
      animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
      transition={{ duration: 0.42 }}
      className="relative"
    >
      {/* Glow ring */}
      <div
        aria-hidden
        className="absolute -inset-px rounded-3xl pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, hsl(22 96% 55% / 0.55), hsl(155 60% 35% / 0.25), hsl(22 96% 55% / 0.55))",
          filter: "blur(0.5px)",
          opacity: 0.7,
        }}
      />
      <div
        className="relative rounded-3xl border border-hairline/60 bg-card/70 backdrop-blur-xl p-6 sm:p-7"
        style={{ boxShadow: "0 30px 80px -30px hsl(0 0% 0% / 0.7), inset 0 1px 0 hsl(60 20% 96% / 0.06)" }}
      >
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="relative">
            <motion.div
              className="h-12 w-12 rounded-full"
              style={{
                background: "radial-gradient(circle at 30% 28%, hsl(28 100% 78%), hsl(22 96% 55%) 50%, hsl(14 92% 38%) 100%)",
                boxShadow: "inset -3px -4px 8px hsl(10 80% 22% / 0.55), 0 0 32px hsl(22 96% 55% / 0.55)",
              }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <span
              className="absolute rounded-full pointer-events-none"
              style={{ top: 4, left: 6, width: 14, height: 10, background: "radial-gradient(closest-side, hsl(0 0% 100% / 0.85), transparent 70%)" }}
            />
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-[0.32em] text-subtle">
            {mode === "signup" ? "Создание профиля" : "Вход в систему"}
          </div>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight leading-tight">
            ДОБРО ПОЖАЛОВАТЬ
            <span className="block text-orange mt-0.5">В ПИНГ ТАБЛЕТ</span>
          </h2>
          <p className="text-xs text-subtle mt-2">
            {mode === "signup" ? "Игровой профиль за 10 секунд" : "Никнейм и пароль — больше ничего"}
          </p>
        </div>

        {/* Tabs */}
        <div className="relative mb-5 grid grid-cols-2 gap-1 p-1 rounded-full bg-secondary/60 border border-hairline/50">
          <motion.span
            layout
            className="absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full bg-gradient-orange"
            style={{ boxShadow: "0 6px 20px -6px hsl(var(--orange) / 0.55)" }}
            animate={{ left: mode === "signin" ? 4 : "calc(50% + 0px)" }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`relative z-10 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                mode === m ? "text-primary-foreground" : "text-subtle hover:text-ink"
              }`}
            >
              {m === "signin" ? "Вход" : "Регистрация"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          <Field
            id="nickname"
            label="Никнейм"
            icon={<AtSign className="h-4 w-4" />}
            value={nickname}
            onChange={(v) => { setNickname(v); if (errors.nickname) setErrors((e) => ({ ...e, nickname: undefined })); }}
            placeholder="player_one"
            autoComplete="username"
            error={errors.nickname}
            maxLength={16}
            inputMode="text"
            autoCapitalize="none"
          />
          <Field
            id="password"
            label="Пароль"
            icon={<Lock className="h-4 w-4" />}
            value={password}
            onChange={(v) => { setPassword(v); if (errors.password) setErrors((e) => ({ ...e, password: undefined })); }}
            placeholder="••••••••"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            error={errors.password}
            maxLength={72}
          />
          <AnimatePresence initial={false}>
            {mode === "signup" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Field
                  id="confirm"
                  label="Повтори пароль"
                  icon={<ShieldCheck className="h-4 w-4" />}
                  value={confirm}
                  onChange={(v) => { setConfirm(v); if (errors.confirm) setErrors((e) => ({ ...e, confirm: undefined })); }}
                  placeholder="••••••••"
                  type="password"
                  autoComplete="new-password"
                  error={errors.confirm}
                  maxLength={72}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <ArcadeButton loading={loading} type="submit">
            {mode === "signup" ? "СОЗДАТЬ ПРОФИЛЬ" : "ВОЙТИ"}
          </ArcadeButton>

          {mode === "signin" && (
            <button
              type="button"
              onClick={onForgot}
              className="block mx-auto text-[11px] text-subtle hover:text-ink transition-colors"
            >
              Забыли пароль?
            </button>
          )}
        </form>

        {/* Footer link */}
        <div className="mt-5 pt-4 border-t border-hairline/50 text-center text-xs text-subtle">
          {mode === "signin" ? (
            <>
              Нет аккаунта?{" "}
              <button onClick={() => setMode("signup")} className="text-orange font-semibold hover:underline underline-offset-4">
                Зарегистрироваться
              </button>
            </>
          ) : (
            <>
              Уже есть аккаунт?{" "}
              <button onClick={() => setMode("signin")} className="text-orange font-semibold hover:underline underline-offset-4">
                Войти
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ---------- Field ---------- */
function Field({
  id, label, icon, value, onChange, error, type = "text", placeholder, autoComplete, maxLength, inputMode, autoCapitalize,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  inputMode?: "text" | "email" | "numeric";
  autoCapitalize?: string;
}) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;
  return (
    <div>
      <label htmlFor={id} className="block text-[10px] uppercase tracking-[0.18em] text-subtle mb-1.5">
        {label}
      </label>
      <div
        className={`relative flex items-center rounded-xl border transition-all duration-200 ${
          hasError
            ? "border-destructive/70 bg-destructive/5"
            : focused
            ? "border-orange/70 bg-secondary/70"
            : "border-hairline/70 bg-secondary/40 hover:border-hairline"
        }`}
        style={{
          boxShadow: hasError
            ? "0 0 0 3px hsl(0 75% 55% / 0.18), 0 0 24px hsl(0 75% 55% / 0.18)"
            : focused
            ? "0 0 0 3px hsl(22 96% 55% / 0.18), 0 0 30px hsl(22 96% 55% / 0.22)"
            : undefined,
        }}
      >
        <span className={`pl-3.5 ${hasError ? "text-destructive" : focused ? "text-orange" : "text-subtle"}`}>{icon}</span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          inputMode={inputMode}
          autoCapitalize={autoCapitalize}
          spellCheck={false}
          className="w-full bg-transparent px-3 py-3 text-sm font-medium text-ink placeholder:text-subtle/60 outline-none"
        />
      </div>
      <AnimatePresence>
        {hasError && (
          <motion.p
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-1.5 text-[11px] text-destructive font-medium"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Arcade Button (with ping-pong loader) ---------- */
function ArcadeButton({ loading, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className="group relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-bold uppercase tracking-[0.2em] text-primary-foreground transition-transform active:scale-[0.985] disabled:opacity-80 disabled:cursor-not-allowed"
      style={{
        background: "linear-gradient(135deg, hsl(22 96% 60%) 0%, hsl(14 92% 50%) 100%)",
        boxShadow:
          "0 10px 30px -10px hsl(22 96% 55% / 0.55), 0 0 0 1px hsl(22 96% 55% / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.25)",
      }}
    >
      {/* shine */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 group-hover:opacity-100 group-hover:translate-x-[400%] transition-all duration-700"
      />
      <span className="relative flex items-center justify-center gap-2.5">
        {loading ? <PingPongLoader /> : children}
      </span>
    </button>
  );
}

function PingPongLoader() {
  return (
    <span className="relative inline-flex items-center justify-center h-5 w-16">
      <span className="absolute inset-x-0 bottom-0 h-px bg-primary-foreground/40" />
      <motion.span
        className="absolute h-3 w-3 rounded-full"
        style={{
          background: "radial-gradient(circle at 30% 30%, hsl(60 20% 99%), hsl(22 96% 65%) 70%)",
          boxShadow: "0 0 10px hsl(60 20% 96% / 0.7)",
        }}
        animate={{ x: [0, 44, 0], y: [0, -8, 0] }}
        transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut" }}
      />
    </span>
  );
}

/* ---------- Welcome overlay ---------- */
function WelcomeOverlay({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex items-center justify-center bg-paper/80 backdrop-blur-xl"
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="mx-auto h-20 w-20 rounded-full flex items-center justify-center"
          style={{
            background: "radial-gradient(circle at 30% 28%, hsl(28 100% 78%), hsl(22 96% 55%) 60%)",
            boxShadow: "0 0 60px hsl(22 96% 55% / 0.6), inset -4px -6px 10px hsl(10 80% 22% / 0.55)",
          }}
        >
          <Trophy className="h-9 w-9 text-primary-foreground" strokeWidth={2.4} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5"
        >
          <div className="text-[10px] uppercase tracking-[0.32em] text-orange flex items-center justify-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Профиль создан
          </div>
          <div className="font-display text-2xl font-bold mt-1">Добро пожаловать, {name}!</div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ---------- Forgot password ---------- */
function ForgotPasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  const handle = `@${SUPPORT_TG}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(handle);
      setCopied(true);
      toast.success("Скопировано");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-3xl border-hairline bg-card/90 backdrop-blur-xl p-6">
        <DialogTitle className="sr-only">Восстановление пароля</DialogTitle>
        <DialogDescription className="sr-only">Поддержка через Telegram</DialogDescription>
        <div className="text-center">
          <div
            className="mx-auto h-12 w-12 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, hsl(200 90% 55%), hsl(210 95% 45%))",
              boxShadow: "0 10px 30px -10px hsl(210 90% 50% / 0.6)",
            }}
          >
            <Send className="h-6 w-6 text-white" />
          </div>
          <div className="mt-4 text-[10px] uppercase tracking-[0.28em] text-subtle">Support center</div>
          <h3 className="font-display text-xl font-bold mt-1">Восстановление пароля</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Напиши в Telegram, и мы поможем восстановить доступ к твоему игровому профилю.
          </p>

          <div className="mt-5 flex items-center justify-between gap-2 rounded-xl border border-hairline bg-secondary/60 px-3 py-2.5">
            <span className="font-mono text-sm font-semibold text-ink truncate">{handle}</span>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-xs font-medium text-subtle hover:text-ink hover:bg-secondary transition-colors border border-hairline/70"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-orange" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Готово" : "Скопировать"}
            </button>
          </div>

          <Button
            asChild
            className="mt-3 w-full font-bold uppercase tracking-wider"
            style={{
              background: "linear-gradient(135deg, hsl(200 90% 55%), hsl(210 95% 45%))",
              boxShadow: "0 10px 30px -10px hsl(210 90% 50% / 0.55)",
            }}
          >
            <a href={`https://t.me/${SUPPORT_TG}`} target="_blank" rel="noopener noreferrer">
              <Send className="h-4 w-4 mr-2" />
              Открыть Telegram
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
