import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useCurrentPlayer, setCurrentPlayer } from "@/lib/currentPlayer";
import { syncCurrentPlayerFromSession, signOutEverywhere } from "@/lib/authPlayer";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/admin";
import AuthDialog from "@/components/AuthDialog";
import AchievementsProvider from "@/components/achievements/AchievementsProvider";
import MatchVictoryOverlay from "@/components/gamification/MatchVictoryOverlay";
import StickerDropOverlay from "@/components/stickers/StickerDropOverlay";
import ForcePasswordChange from "@/components/ForcePasswordChange";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { LogOut, User, KeyRound, Home, Trophy, QrCode, Sticker } from "lucide-react";
import logoMark from "@/assets/logo-mark.jpg";

// Маршруты, для которых не требуется авторизация игрока
const PUBLIC_ROUTES = ["/admin", "/admin/", "/auth"];
const isPublicPath = (p: string) => p.startsWith("/admin") || p.startsWith("/auth");

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-[30px] w-[30px] shrink-0 rounded-[9px] bg-primary flex items-center justify-center">
        <img
          src={logoMark}
          alt=""
          aria-hidden="true"
          width={22}
          height={22}
          className="h-[22px] w-[22px] object-contain"
          loading="eager"
          decoding="async"
        />
      </div>
      <span className="font-display text-[1.15rem] tracking-[1px]" style={{color: "hsl(var(--ink))"}}>
        ПИНГ<span style={{color: "hsl(var(--subtle))"}}>·</span>ТАБЛЕТ
      </span>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [me] = useCurrentPlayer();
  const { isAdmin } = useIsAdmin();
  const [authOpen, setAuthOpen] = useState(false);

  // Принудительная авторизация: открываем диалог, если игрок не вошёл
  // и страница не из «публичных» (админка).
  const requiresAuth = !isPublicPath(pathname);
  const mustAuth = requiresAuth && !me;

  useEffect(() => {
    if (mustAuth) setAuthOpen(true);
    else if (me) setAuthOpen(false);
  }, [mustAuth, me, pathname]);

  // Keep CurrentPlayer in sync with the Supabase auth session.
  // Listener registered BEFORE getSession() per Supabase guidance.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setCurrentPlayer(null);
        return;
      }
      // Defer to avoid deadlocks with the auth client.
      setTimeout(() => { void syncCurrentPlayerFromSession(); }, 0);
    });
    void syncCurrentPlayerFromSession();
    return () => sub.subscription.unsubscribe();
  }, []);

  // Скрытый вход в админку: длинное нажатие на © в футере (1.5с)
  const pressTimer = useRef<number | null>(null);
  const startPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => navigate("/admin"), 1500);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  // Клавиатурный шорткат для админа: Shift + A три раза подряд
  useEffect(() => {
    let buf: number[] = [];
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "A" || e.key === "a")) {
        const now = Date.now();
        buf = [...buf.filter((t) => now - t < 1200), now];
        if (buf.length >= 3) {
          buf = [];
          navigate("/admin");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col" style={{background: "linear-gradient(135deg, #f5e6ff 0%, #fde8e0 25%, #e0eeff 60%, #e8f5e9 100%)", backgroundAttachment: "fixed"}}>
      <header className="sticky top-0 z-40 safe-top" style={{background: "var(--glass-bg-heavy)", backdropFilter: "saturate(200%) blur(28px)", WebkitBackdropFilter: "saturate(200%) blur(28px)", borderBottom: "1px solid var(--glass-border)", boxShadow: "0 1px 0 rgba(0,0,0,0.06)"}}>
        <div className="container flex h-14 md:h-16 items-center justify-between gap-3">
          <Link to="/" aria-label="ПИНГ ТАБЛЕТ — на главную">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <div className="hidden md:flex items-center gap-1">
              <NavItem to="/" active={pathname === "/"}>Главная</NavItem>
              <NavItem to="/events" active={pathname.startsWith("/events")}>События</NavItem>
              <NavItem to="/leaderboard" active={pathname.startsWith("/leaderboard")}>Рейтинг</NavItem>
            </div>
            {me ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-1 flex items-center gap-2 rounded-full hairline bg-card px-2.5 py-1 text-xs hover:bg-secondary transition-colors">
                    <Avatar player={me} size={22} />
                    <span className="hidden sm:inline font-medium max-w-[10ch] truncate">@{me.handle}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-2">
                    <div className="text-sm font-medium truncate">{me.name}</div>
                    <div className="text-xs text-subtle truncate">@{me.handle}</div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`/p/${me.handle}`)}>
                    <User className="h-4 w-4 mr-2" /> Мой профиль
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <KeyRound className="h-4 w-4 mr-2" /> Админ-панель
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => { void signOutEverywhere(); }} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4 mr-2" /> Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="ml-1 h-8 rounded-full text-xs px-3"
                onClick={() => setAuthOpen(true)}
              >
                Войти
              </Button>
            )}
          </nav>
        </div>
      </header>

      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1 pb-36 md:pb-0"
      >
        {children}
      </motion.main>

      {/* Floating mobile dock — premium ping pong ball indicator */}
      {!isPublicPath(pathname) && (
        <PingPongDock
          pathname={pathname}
          me={me}
          isAdmin={isAdmin}
          onNeedAuth={() => setAuthOpen(true)}
        />
      )}

      <footer className="border-t border-hairline">
        <div className="container py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-subtle">
          <span
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onTouchCancel={cancelPress}
            className="select-none cursor-default"
            aria-label="© ПИНГ ТАБЛЕТ — удерживай для админки"
            title="Удерживай 1.5с для входа в админку"
          >
            © {new Date().getFullYear()} ПИНГ ТАБЛЕТ
          </span>
          <span className="flex items-center gap-3">
            <span className="hidden md:inline">Турниры по настольному теннису, где угодно.</span>
            <button
              onClick={() => navigate("/admin")}
              className="inline-flex items-center gap-1 text-subtle/70 hover:text-ink transition-colors"
              aria-label="Вход для админа"
              title="Вход для админа"
            >
              <KeyRound className="h-3 w-3" />
              <span>для админа</span>
            </button>
          </span>
        </div>
      </footer>

      <AuthDialog
        open={authOpen}
        onOpenChange={(v) => {
          if (!v && mustAuth) return;
          setAuthOpen(v);
        }}
        forced={mustAuth}
        onAuthed={(p) => setCurrentPlayer(p)}
      />

      <AchievementsProvider />
      <MatchVictoryOverlay />
      <StickerDropOverlay />
      <ForcePasswordChange />
    </div>
  );
}

function NavItem({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`relative px-3 py-2 rounded-md transition-colors ${
        active ? "text-ink" : "text-subtle hover:text-ink"
      }`}
    >
      {children}
      {active && (
        <motion.span
          layoutId="nav-underline"
          className="absolute left-3 right-3 -bottom-[1px] h-[2px] bg-ink"
        />
      )}
    </Link>
  );
}

type DockItemDef = {
  to: string;
  label: string;
  icon: React.ComponentType<any>;
  active: boolean;
  onClick?: (e: React.MouseEvent) => void;
};

function PingPongDock({
  pathname,
  me,
  isAdmin,
  onNeedAuth,
}: {
  pathname: string;
  me: { handle: string } | null | undefined;
  isAdmin: boolean;
  onNeedAuth: () => void;
}) {
  const items: DockItemDef[] = [
    { to: "/", label: "Главная", icon: Home, active: pathname === "/" },
    { to: "/scan", label: "Скан", icon: QrCode, active: pathname.startsWith("/scan") },
    { to: "/leaderboard", label: "Рейтинг", icon: Trophy, active: pathname.startsWith("/leaderboard") },
    {
      to: me ? `/p/${me.handle}` : "#",
      label: "Профиль",
      icon: User,
      active: !!me && pathname.startsWith(`/p/${me.handle}`),
      onClick: (e) => { if (!me) { e.preventDefault(); onNeedAuth(); } },
    },
  ];
  if (isAdmin) {
    items.push({ to: "/admin", label: "Админ", icon: KeyRound, active: pathname.startsWith("/admin") });
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div
        className="pointer-events-auto flex items-center justify-around border-t border-white/[0.07] pb-safe-bottom"
        style={{ background: "rgba(13,13,13,0.95)", backdropFilter: "blur(12px)", paddingTop: "10px", paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))" }}
      >
        {items.map((it, idx) => {
          const isQr = it.label === "Скан";
          return (
            <Link
              key={it.to + it.label}
              to={it.to}
              onClick={it.onClick}
              aria-label={it.label}
              className="flex flex-col items-center gap-[3px] cursor-pointer"
              style={{ flex: 1 }}
            >
              {isQr ? (
                <span
                  className="flex items-center justify-center rounded-full mb-[-12px]"
                  style={{
                    width: 50, height: 50,
                    background: "#e8572a",
                    marginTop: -20,
                    border: "4px solid #0d0d0d",
                  }}
                >
                  <it.icon className="h-[22px] w-[22px] text-white" strokeWidth={2} />
                </span>
              ) : (
                <it.icon
                  className="h-[22px] w-[22px] transition-colors"
                  strokeWidth={1.6}
                  style={{ color: it.active ? "hsl(var(--orange))" : "hsl(var(--subtle))" }}
                />
              )}
              {!isQr && (
                <span
                  className="text-[10px] transition-colors"
                  style={{ color: it.active ? "hsl(var(--orange))" : "hsl(var(--subtle))" }}
                >
                  {it.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Avatar({ player, size = 32 }: { player: { name: string; handle: string; avatar_url?: string | null }; size?: number }) {
  const initials = (player.name || player.handle || "?").trim().slice(0, 1).toUpperCase();
  if (player.avatar_url) {
    return (
      <img
        src={player.avatar_url}
        alt={player.name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="rounded-full object-cover bg-secondary"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-ink text-paper font-display font-bold"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initials}
    </span>
  );
}

// Re-export so other components can use the same avatar styling
export { Avatar };

// keep useEffect import available for tree-shaking checks
useEffect;
