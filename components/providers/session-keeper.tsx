"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/** Refresca antes de que venza el JWT (1 h por defecto en Supabase). */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

type RefreshResult = "ok" | "unauthorized" | "unavailable";

async function refreshSessionViaApi(): Promise<RefreshResult> {
  try {
    const res = await fetch("/api/auth/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return "unavailable";
    }

    if (res.status === 401) {
      return "unauthorized";
    }

    if (!res.ok) {
      return "unavailable";
    }

    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true ? "ok" : "unavailable";
  } catch {
    return "unavailable";
  }
}

/**
 * Mantiene la sesión activa mientras la app queda abierta (p. ej. tablet en posta).
 * Solo redirige a login si Supabase confirma que la sesión ya no es válida.
 */
export function SessionKeeper() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/login")) {
      return;
    }

    const supabase = createBrowserSupabaseClient();

    const refresh = async () => {
      const result = await refreshSessionViaApi();
      if (result === "unauthorized") {
        const next =
          pathname && pathname !== "/"
            ? `?next=${encodeURIComponent(pathname)}`
            : "";
        window.location.assign(`/login${next}`);
      }
    };

    void refresh();

    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED") {
        router.refresh();
      }
      if (event === "SIGNED_OUT") {
        window.location.assign("/login");
      }
    });

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  return null;
}
