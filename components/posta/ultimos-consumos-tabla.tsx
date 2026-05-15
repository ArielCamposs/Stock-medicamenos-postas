"use client";

import { useState } from "react";

import { ConsumoDiaModal } from "@/components/posta/consumo-dia-modal";
import { Button } from "@/components/ui/button";

export type UltimoConsumoRow = {
  id: string;
  medicamentoId: string;
  fecha: string;
  conAvis: number;
  sinAvis: number;
  total: number;
  observacion: string | null;
  medNombre: string;
  medCodigo: string;
  unidadMedida: string;
  /** Saldo del mes al cargar la página (para avisos al editar desde la tabla). */
  disponibleMes: number;
  stockCritico: number;
  stockRecomendado: number;
};

function formatFechaEs(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function diaDelMes(iso: string) {
  const d = Number(iso.slice(8, 10));
  return Number.isFinite(d) ? d : 1;
}

export function UltimosConsumosTabla({
  postaId,
  puedeRegistrar,
  rows,
}: {
  postaId: string;
  puedeRegistrar: boolean;
  rows: UltimoConsumoRow[];
}) {
  const [edit, setEdit] = useState<UltimoConsumoRow | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay descuentos registrados en este período.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Fecha</th>
              <th className="py-2 pr-3 font-medium">Medicamento</th>
              <th className="py-2 pr-2 text-right font-medium">Con AVIS</th>
              <th className="py-2 pr-2 text-right font-medium">Sin AVIS</th>
              <th className="py-2 pr-2 text-right font-medium">Total</th>
              <th className="py-2 pr-3 font-medium min-w-[10rem] max-w-[20rem]">
                Observación
              </th>
              {puedeRegistrar ? (
                <th className="py-2 text-right font-medium">Acciones</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="py-2 pr-3 whitespace-nowrap">{formatFechaEs(r.fecha)}</td>
                <td className="py-2 pr-3">
                  <span className="font-medium">{r.medNombre}</span>
                  {r.medCodigo ? (
                    <span className="ml-1 text-muted-foreground">({r.medCodigo})</span>
                  ) : null}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">{r.conAvis}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{r.sinAvis}</td>
                <td className="py-2 pr-2 text-right tabular-nums font-medium">{r.total}</td>
                <td
                  className="py-2 pr-3 align-top text-muted-foreground"
                  title={r.observacion ?? undefined}
                >
                  {r.observacion ? (
                    <span className="line-clamp-2 break-words text-foreground">{r.observacion}</span>
                  ) : (
                    <span className="text-muted-foreground/70">—</span>
                  )}
                </td>
                {puedeRegistrar ? (
                  <td className="py-2 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setEdit(r)}
                    >
                      Editar
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit ? (
        <ConsumoDiaModal
          key={edit.id}
          postaId={postaId}
          medicamentoId={edit.medicamentoId}
          puedeRegistrar={puedeRegistrar}
          medNombre={edit.medNombre}
          medCodigo={edit.medCodigo}
          unidad={edit.unidadMedida}
          fechaISO={edit.fecha}
          dia={diaDelMes(edit.fecha)}
          initialCon={edit.conAvis}
          initialSin={edit.sinAvis}
          initialObservacion={edit.observacion}
          disponibleMes={edit.disponibleMes}
          stockCritico={edit.stockCritico}
          stockRecomendado={edit.stockRecomendado}
          onClose={() => setEdit(null)}
        />
      ) : null}
    </>
  );
}
