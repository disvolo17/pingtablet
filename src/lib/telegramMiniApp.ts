import { supabase } from "@/integrations/supabase/client";
import type { CurrentPlayer } from "@/lib/currentPlayer";

type ScanPopupParams = { text?: string };
type TgWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  showScanQrPopup?: (params: ScanPopupParams, callback: (text: string) => boolean | void) => void;
  closeScanQrPopup?: () => void;
  HapticFeedback?: { notificationOccurred?: (t: "success" | "error" | "warning") => void };
};

export function getTelegramWebApp(): TgWebApp | null {
  const w = window as unknown as { Telegram?: { WebApp?: TgWebApp } };
  return w.Telegram?.WebApp ?? null;
}

export function isInsideTelegram(): boolean {
  const tg = getTelegramWebApp();
  return !!(tg && typeof tg.initData === "string" && tg.initData.length > 0);
}

export function scanQrInsideTelegram(text: string | undefined, onResult: (text: string) => void): boolean {
  const tg = getTelegramWebApp();
  if (!tg?.showScanQrPopup) return false;
  tg.showScanQrPopup({ text }, (data) => {
    if (data) {
      onResult(data);
      tg.closeScanQrPopup?.();
      return true;
    }
    return false;
  });
  return true;
}

export async function loginWithMiniApp(): Promise<CurrentPlayer> {
  const tg = getTelegramWebApp();
  const initData = tg?.initData;
  if (!initData) throw new Error("Откройте приложение через Telegram-бота");

  const { data, error } = await supabase.functions.invoke("telegram-miniapp-auth", {
    body: { initData },
  });
  if (error) {
    // Try to surface server-side reason
    const msg = (error as { message?: string }).message || "Ошибка входа";
    throw new Error(msg);
  }
  const result = data as { player?: CurrentPlayer; error?: string };
  if (result?.error) throw new Error(result.error);
  if (!result?.player) throw new Error("Не удалось получить профиль");
  return result.player;
}
