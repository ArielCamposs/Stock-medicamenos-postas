"use client";

import { useEffect, useState } from "react";

import {
  ConsumoMensualPanel,
  type ConsumoMensualMedPayload,
} from "@/components/posta/consumo-mensual-panel";
import { UltimosConsumosTabla, type UltimoConsumoRow } from "@/components/posta/ultimos-consumos-tabla";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  loadDescuentoSnapshot,
  saveDescuentoSnapshot,
} from "@/lib/offline/descuento-snapshot";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnlineStatus } from "@/lib/offline/use-online-status";

export type DescuentoPageClientProps = {
  postaId: string;
  basePath: string;
  anio: number;
  mes: number;
  puedeRegistrar: boolean;
  soloLecturaDescuentoVariante?: "admin" | "resto";
  medicamentos: ConsumoMensualMedPayload[];
  ultimosRows: UltimoConsumoRow[];
  /** El servidor no pudo cargar datos por falta de red; usar copia local. */
  servidorSinRed?: boolean;
};

export function DescuentoPageClient(props: DescuentoPageClientProps) {
  const online = useOnlineStatus();
  const [ready, setReady] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [noSnapshot, setNoSnapshot] = useState(false);
  const [view, setView] = useState<DescuentoPageClientProps>(props);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!online) {
        const snap = await loadDescuentoSnapshot(props.postaId, props.anio, props.mes);
        if (cancelled) return;
        if (snap) {
          setView({
            postaId: snap.postaId,
            basePath: snap.basePath,
            anio: snap.anio,
            mes: snap.mes,
            puedeRegistrar: snap.puedeRegistrar,
            soloLecturaDescuentoVariante: snap.soloLecturaDescuentoVariante,
            medicamentos: snap.medicamentos,
            ultimosRows: snap.ultimosRows,
          });
          setOfflineMode(true);
          setNoSnapshot(false);
        } else {
          setNoSnapshot(true);
          setOfflineMode(true);
        }
        setReady(true);
        return;
      }

      setOfflineMode(false);
      setNoSnapshot(false);

      if (props.medicamentos.length > 0) {
        setView(props);
        await saveDescuentoSnapshot(props);
        if (!cancelled) setReady(true);
        return;
      }

      const snap = await loadDescuentoSnapshot(props.postaId, props.anio, props.mes);
      if (cancelled) return;
      if (snap) {
        setView({
          postaId: snap.postaId,
          basePath: snap.basePath,
          anio: snap.anio,
          mes: snap.mes,
          puedeRegistrar: snap.puedeRegistrar,
          soloLecturaDescuentoVariante: snap.soloLecturaDescuentoVariante,
          medicamentos: snap.medicamentos,
          ultimosRows: snap.ultimosRows,
        });
      } else {
        setView(props);
      }
      if (!cancelled) setReady(true);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [online, props]);

  if (!ready) {
    return (
      <div className="space-y-6" role="status" aria-busy="true" aria-label="Cargando descuento">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (noSnapshot && !online) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-6 text-sm dark:bg-amber-950/25">
        <p className="font-medium text-foreground">Sin conexión y sin copia local de este mes</p>
        <p className="mt-2 text-muted-foreground">
          Abrí esta pantalla de <strong>Descuento</strong> al menos una vez con internet en este
          dispositivo. Después podrás usarla sin red (idealmente con la app instalada tras{" "}
          <code className="text-xs">npm run build</code> y <code className="text-xs">npm start</code>
          ).
        </p>
        <p className="mt-2 text-muted-foreground">
          En <code className="text-xs">npm run dev</code> no se cachea la página completa; probá el
          modo offline en producción o sin recargar la pestaña tras poner DevTools en Offline.
        </p>
      </div>
    );
  }

  const {
    postaId,
    basePath,
    anio,
    mes,
    puedeRegistrar,
    soloLecturaDescuentoVariante,
    medicamentos,
    ultimosRows,
  } = view;

  return (
    <div className="space-y-8">
      {offlineMode ? (
        <p
          className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-50"
          role="status"
        >
          Modo sin conexión: mostrando la última copia guardada de este mes en el dispositivo. Los
          cambios se sincronizarán al volver internet.
        </p>
      ) : null}

      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Descuento diario</h1>
        <p className="text-sm text-muted-foreground capitalize">
          {new Date(anio, mes - 1, 1).toLocaleDateString("es-CL", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </header>

      <Card>
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-base font-semibold">Calendario de descuentos</CardTitle>
        </CardHeader>
        <CardContent>
          <ConsumoMensualPanel
            postaId={postaId}
            basePath={basePath}
            anio={anio}
            mes={mes}
            puedeRegistrar={puedeRegistrar}
            soloLecturaDescuentoVariante={soloLecturaDescuentoVariante}
            medicamentos={medicamentos}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {offlineMode ? (
            <p className="text-sm text-muted-foreground">
              La tabla de últimos movimientos requiere conexión. Podés seguir cargando descuentos en
              la grilla de arriba.
            </p>
          ) : (
            <UltimosConsumosTabla
              postaId={postaId}
              puedeRegistrar={puedeRegistrar}
              rows={ultimosRows}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
