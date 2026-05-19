import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { useCurrentPlayer } from "@/lib/currentPlayer";
import AuthDialog from "@/components/AuthDialog";
import { Avatar } from "@/components/Layout";
import { isInsideTelegram, scanQrInsideTelegram } from "@/lib/telegramMiniApp";

export default function Scan() {
  const navigate = useNavigate();
  const [me] = useCurrentPlayer();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    document.title = "Сканировать QR — ПИНГ ТАБЛЕТ";
    return () => {
      const s = scannerRef.current;
      if (!s) return;
      Promise.resolve(s.stop()).catch(() => {}).finally(() => { try { s.clear(); } catch { /* noop */ } });
    };
  }, []);

  const handleResult = (text: string) => {
    if (!me) {
      setAuthOpen(true);
      return;
    }
    try {
      const url = new URL(text);
      const m = url.pathname.match(/\/t\/([0-9a-f-]{36})/i);
      if (m) {
        const checkin = url.searchParams.get("checkin") ?? "1";
        navigate(`/t/${m[1]}?checkin=${checkin}`);
        return;
      }
    } catch { /* not a URL */ }
    // Maybe raw UUID
    if (/^[0-9a-f-]{36}$/i.test(text.trim())) {
      navigate(`/t/${text.trim()}?checkin=1`);
      return;
    }
    toast.error("Не похоже на QR ПИНГ ТАБЛЕТ");
  };

  const startCamera = async () => {
    if (!me) {
      setAuthOpen(true);
      return;
    }
    // Внутри Telegram Mini App — используем нативный сканер Telegram
    if (isInsideTelegram()) {
      const opened = scanQrInsideTelegram("Наведи камеру на QR турнира", (text) => {
        handleResult(text);
      });
      if (opened) return;
    }
    try {
      const id = "qr-reader";
      scannerRef.current = new Html5Qrcode(id);
      setScanning(true);
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          scannerRef.current?.stop().catch(() => {});
          setScanning(false);
          handleResult(text);
        },
        () => {},
      );
    } catch (e) {
      setScanning(false);
      toast.error("Не удалось открыть камеру. Попробуй вставить ссылку вручную.");
      console.error(e);
    }
  };

  return (
    <div className="container max-w-xl py-16">
      <h1 className="pt-display text-5xl mb-3">Сканер QR</h1>
      <p className="text-muted-foreground mb-10">
        Сначала войди в профиль, затем наведи камеру на QR турнира.
      </p>

      <div className="pt-card p-4 mb-6 flex items-center justify-between gap-3">
        {me ? (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar player={me} size={36} />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{me.name}</div>
              <div className="text-xs text-subtle truncate">@{me.handle}</div>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-sm font-medium">Нужен профиль игрока</div>
            <div className="text-xs text-subtle">Так мы не создаём дублей в рейтинге.</div>
          </div>
        )}
        {!me && <Button onClick={() => setAuthOpen(true)} className="rounded-full h-10">Войти</Button>}
      </div>

      <div className="pt-card p-4 mb-6">
        <div id="qr-reader" className="rounded-xl overflow-hidden bg-secondary aspect-square w-full" />
        {!scanning && (
          <Button onClick={startCamera} className="w-full mt-4 h-12 rounded-full">
            <Camera className="mr-2 h-4 w-4" /> {me ? "Включить камеру" : "Войти и сканировать"}
          </Button>
        )}
      </div>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} intent="signin" />
    </div>
  );
}
