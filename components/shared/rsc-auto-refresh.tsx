"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const DEFAULT_INTERVAL_MS = 12_000;

/** Refresca el RSC del layout/página mientras la pestaña está visible (cambios de otras postas/usuarios). */
export function RscAutoRefresh({ intervalMs = DEFAULT_INTERVAL_MS }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router, intervalMs]);

  return null;
}
