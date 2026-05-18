"use client";

import { CloudUpload, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getErrorMovements, getPendingMovements } from "@/lib/offline/db";
import { syncPendingMovements } from "@/lib/offline/sync";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { cn } from "@/lib/utils";

type DescuentoOfflineBarProps = {
  postaId: string;
  refreshToken?: number;
};

export function DescuentoOfflineBar({
  postaId,
  refreshToken = 0,
}: DescuentoOfflineBarProps) {
  const router = useRouter();
  const online = useOnlineStatus();
  const wasOfflineRef = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const reloadCounts = useCallback(async () => {
    const [p, e] = await Promise.all([
      getPendingMovements(postaId),
      getErrorMovements(postaId),
    ]);
    setPendingCount(p.length);
    setErrorCount(e.length);
  }, [postaId]);

  useEffect(() => {
    void reloadCounts();
  }, [reloadCounts, refreshToken]);

  const runSync = useCallback(async () => {
    if (!online || syncing) return;
    setSyncing(true);
    setFlash(null);
    try {
      const result = await syncPendingMovements(postaId);
      await reloadCounts();
      if (result.total === 0) {
        setFlash("No hay descuentos pendientes.");
      } else if (result.ok) {
        setFlash(`Sincronizados ${result.synced} descuento(s).`);
        router.refresh();
      } else if (result.failed > 0) {
        setFlash(
          `Sincronizados ${result.synced}; ${result.failed} con error. Revisa los marcados en rojo.`
        );
        router.refresh();
      } else {
        setFlash("Sin conexión. Los pendientes se enviarán cuando vuelva internet.");
      }
    } finally {
      setSyncing(false);
    }
  }, [online, syncing, postaId, reloadCounts, router]);

  useEffect(() => {
    if (!online) {
      wasOfflineRef.current = true;
      return;
    }
    if (wasOfflineRef.current && pendingCount > 0) {
      wasOfflineRef.current = false;
      void runSync();
    }
  }, [online, pendingCount, runSync]);

  const tienePendientes = pendingCount > 0 || errorCount > 0;
  if (!tienePendientes && !flash && !syncing) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between",
        online
          ? "border-border bg-muted/30"
          : "border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/25"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {!online && (pendingCount > 0 || errorCount > 0) ? (
          <span className="text-xs text-amber-950 dark:text-amber-50">
            Los descuentos pendientes se guardan en este dispositivo hasta que vuelva internet.
          </span>
        ) : null}
        {pendingCount > 0 ? (
          <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-950 dark:text-amber-50">
            {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {errorCount > 0 ? (
          <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
            {errorCount} con error de sync
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(pendingCount > 0 || errorCount > 0) && online ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={syncing}
            onClick={() => void runSync()}
          >
            {syncing ? (
              <RefreshCw className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <CloudUpload className="size-3.5" aria-hidden />
            )}
            <span className="ml-1.5">
              {syncing ? "Sincronizando…" : "Sincronizar pendientes"}
            </span>
          </Button>
        ) : null}
      </div>
      {flash ? (
        <p className="w-full text-xs text-muted-foreground" role="status">
          {flash}
        </p>
      ) : null}
    </div>
  );
}