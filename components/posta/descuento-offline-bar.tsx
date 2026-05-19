"use client";

import { CloudUpload, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { canReachServer, markServerUnreachable } from "@/lib/offline/connectivity";
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
  const { toast } = useToast();
  const online = useOnlineStatus();
  const syncingRef = useRef(false);
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

  /** Solo se llama al pulsar «Sincronizar pendientes». */
  const runSync = useCallback(async () => {
    if (syncingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      markServerUnreachable();
      const msg =
        "Sin conexión. Los pendientes se enviarán cuando vuelva internet y pulses sincronizar.";
      setFlash(msg);
      toast(msg, "error");
      return;
    }

    syncingRef.current = true;
    setSyncing(true);
    setFlash(null);
    try {
      if (!(await canReachServer())) {
        markServerUnreachable();
        const msg =
          "Sin conexión. Los pendientes se enviarán cuando vuelva internet y pulses sincronizar.";
        setFlash(msg);
        toast(msg, "error");
        return;
      }

      const result = await syncPendingMovements(postaId);
      await reloadCounts();

      if (result.offline) {
        markServerUnreachable();
        const msg =
          "Sin conexión. Los pendientes se enviarán cuando vuelva internet y pulses sincronizar.";
        setFlash(msg);
        toast(msg, "error");
        return;
      }
      if (result.total === 0) {
        const msg = "No hay descuentos pendientes.";
        setFlash(msg);
        toast(msg);
      } else if (result.ok) {
        const msg = `Sincronizados ${result.synced} descuento(s).`;
        setFlash(msg);
        toast(msg, "success");
        router.refresh();
      } else if (result.failed > 0) {
        const msg = `Sincronizados ${result.synced}; ${result.failed} con error. Revisa los marcados en rojo.`;
        setFlash(msg);
        toast(msg, "error");
        router.refresh();
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [postaId, reloadCounts, router, toast]);

  const tienePendientes = pendingCount > 0 || errorCount > 0;
  if (!tienePendientes && !flash && !syncing) {
    return null;
  }

  const puedeSincronizar = online && (pendingCount > 0 || errorCount > 0);

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
            Cambios guardados en este dispositivo. Cuando tengas internet, pulsa
            sincronizar.
          </span>
        ) : null}
        {online && (pendingCount > 0 || errorCount > 0) ? (
          <span className="text-xs text-muted-foreground">
            Hay cambios locales por enviar. Pulsa sincronizar para subirlos al servidor.
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
        {puedeSincronizar ? (
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
