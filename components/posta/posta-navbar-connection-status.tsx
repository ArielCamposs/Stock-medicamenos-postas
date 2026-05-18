"use client";

import { CloudOff, Wifi } from "lucide-react";

import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { cn } from "@/lib/utils";

export function PostaNavbarConnectionStatus() {
  const online = useOnlineStatus();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        online
          ? "text-emerald-700 dark:text-emerald-400"
          : "text-amber-800 dark:text-amber-300"
      )}
      role="status"
      aria-live="polite"
    >
      {online ? (
        <>
          <span className="relative flex size-3.5 shrink-0 items-center justify-center">
            <span
              className="absolute inset-0 rounded-full bg-emerald-500/30 motion-safe:animate-ping"
              aria-hidden
            />
            <Wifi
              className="relative size-3.5 text-emerald-600 motion-safe:animate-[wifi-signal_2s_ease-in-out_infinite] dark:text-emerald-400"
              aria-hidden
            />
          </span>
          <span>En línea</span>
        </>
      ) : (
        <>
          <CloudOff className="size-3.5 shrink-0" aria-hidden />
          <span>Sin conexión</span>
        </>
      )}
    </div>
  );
}
