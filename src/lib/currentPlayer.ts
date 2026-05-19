// Persisted current player on this device.
import { useEffect, useState, useCallback } from "react";

const KEY = "pinktablet.currentPlayer.v2";

export type CurrentPlayer = {
  id: string;
  handle: string;
  name: string;
  rating?: number;
  avatar_url?: string | null;
  status?: string | null;
};

export function getCurrentPlayer(): CurrentPlayer | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CurrentPlayer) : null;
  } catch {
    return null;
  }
}

export function setCurrentPlayer(p: CurrentPlayer | null) {
  if (p) localStorage.setItem(KEY, JSON.stringify(p));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("pinktablet:player-changed"));
}

export function useCurrentPlayer() {
  const [player, setPlayer] = useState<CurrentPlayer | null>(() => getCurrentPlayer());
  useEffect(() => {
    const handler = () => setPlayer(getCurrentPlayer());
    window.addEventListener("pinktablet:player-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("pinktablet:player-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  const update = useCallback((p: CurrentPlayer | null) => setCurrentPlayer(p), []);
  return [player, update] as const;
}
