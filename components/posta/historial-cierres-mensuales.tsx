"use client";

import Link from "next/link";

import { tituloMesChile } from "@/components/posta/posta-mes-toolbar";
import type { HistorialCierreMensualItem } from "@/lib/posta/cierre-mensual";
import { cn } from "@/lib/utils";

function ymParam(anio: number, mes: number) {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

function formatCerradoEnTabla(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function HistorialCierresMensuales({
  postaId,
  items,
}: {
  postaId: string;
  items: HistorialCierreMensualItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay cierres de mes registrados para esta posta.
      </p>
    );
  }

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        Haz clic en un mes para abrir la conciliación tal como quedó guardada al cerrar.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="px-3 py-3">Mes</th>
              <th className="px-3 py-3">Cierre realizado</th>
              <th className="px-3 py-3">Resumen</th>
              <th className="px-3 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const reabierto = Boolean(item.reabiertoEn);
              const href = `/postas/${postaId}/cierre?ym=${ymParam(item.anio, item.mes)}`;
              return (
                <tr
                  key={item.id}
                  className="border-b border-border/60 last:border-0 transition-colors hover:bg-muted/40"
                >
                  <td className="px-3 py-3 font-medium whitespace-nowrap capitalize">
                    <Link
                      href={href}
                      className="text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    >
                      {tituloMesChile(item.anio, item.mes)}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                    {formatCerradoEnTabla(item.cerradoEn)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-muted-foreground">
                    {item.resumen.diferenciasAvis > 0 ? (
                      <span className="text-amber-700 dark:text-amber-400">
                        {item.resumen.diferenciasAvis} dif.
                      </span>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-400">Sin dif.</span>
                    )}
                    {" · "}
                    {item.resumen.totalDisponible.toLocaleString("es-CL")} u. registro
                  </td>
                  <td className="px-3 py-3">
                    {reabierto ? (
                      <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                        Reabierto
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Vigente
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
