import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setCurrentPlayer } from "@/lib/currentPlayer";
import { getTelegramWebApp, isInsideTelegram, loginWithMiniApp } from "@/lib/telegramMiniApp";

type Props = {
  autoStart?: boolean;
  onAuthed?: () => void;
};

export default function TelegramLoginButton({ autoStart = true, onAuthed }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insideTg = isInsideTelegram();

  useEffect(() => {
    const tg = getTelegramWebApp();
    tg?.ready?.();
    tg?.expand?.();
  }, []);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const player = await loginWithMiniApp();
      setCurrentPlayer(player);
      toast.success(`Привет, ${player.name}!`);
      onAuthed?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка входа";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Auto-login when opened inside Telegram
  useEffect(() => {
    if (autoStart && insideTg) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, insideTg]);

  if (!insideTg) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-subtle max-w-xs">
          Откройте ПИНГ ТАБЛЕТ внутри Telegram (через бота или меню) — вход произойдёт автоматически.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        type="button"
        size="lg"
        onClick={run}
        disabled={loading}
        className="min-w-[220px]"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Входим…
          </span>
        ) : (
          "Войти через Telegram"
        )}
      </Button>
      {error && <p className="text-xs text-destructive text-center max-w-xs">{error}</p>}
    </div>
  );
}
