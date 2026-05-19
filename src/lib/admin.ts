// Thin client for the admin-action edge function.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "pinktablet.adminCode.v1";

export function getAdminCode(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function setAdminCode(code: string | null) {
  if (code) localStorage.setItem(KEY, code);
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("pinktablet:admin-changed"));
}

export async function callAdmin<T = unknown>(action: { type: string; payload?: unknown }): Promise<T> {
  const code = getAdminCode();
  if (!code) throw new Error("Не авторизован как администратор");

  const { data, error } = await supabase.functions.invoke("admin-action", {
    body: action,
    headers: { "x-admin-code": code },
  });

  if (error) {
    // supabase-js wraps non-2xx as FunctionsHttpError
    const msg = (error as Error).message || "Ошибка сервера";
    throw new Error(msg);
  }
  if (data && typeof data === "object" && "error" in (data as object)) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

export function useIsAdmin() {
  const [is, setIs] = useState<boolean>(() => !!getAdminCode());
  useEffect(() => {
    const h = () => setIs(!!getAdminCode());
    window.addEventListener("pinktablet:admin-changed", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("pinktablet:admin-changed", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  const logout = useCallback(() => setAdminCode(null), []);
  return { isAdmin: is, logout };
}
