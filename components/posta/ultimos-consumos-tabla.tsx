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

function ConsumoRowContent({
  r,
  puedeRegistrar,
  onEdit,
}: {
  r: UltimoConsumoRow;
  puedeRegistrar: boolean;
  onEdit: (row: UltimoConsumoRow) => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{r.medNombre}</p>
          {r.medCodigo ? (
            <p className="text-xs text-muted-foreground">{r.medCodigo}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">{formatFechaEs(r.fecha)}</p>
        </div>
        {puedeRegistrar ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={() => onEdit(r)}
          >
            Editar
          </Button>
        ) : null}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
          <dt className="text-muted-foreground">Con AVIS</dt>
          <dd className="font-semibold tabular-nums">{r.conAvis}</dd>
        </div>
        <div className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
          <dt className="text-muted-foreground">Sin AVIS</dt>
          <dd className="font-semibold tabular-nums">{r.sinAvis}</dd>
        </div>
        <div className="rounded-md bg-primary/5 px-2 py-1.5 text-center">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="font-bold tabular-nums">{r.total}</dd>
        </div>
      </dl>
      {r.observacion ? (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{r.observacion}</p>
      ) : null}
    </>
  );
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
      {/* Escritorio */}
      <div className="hidden md:block overflow-x-auto">
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

      {/* Móvil */}
      <div className="divide-y divide-border/60 rounded-lg border md:hidden">
        {rows.map((r) => (
          <div key={r.id} className="p-4">
            <ConsumoRowContent r={r} puedeRegistrar={puedeRegistrar} onEdit={setEdit} />
          </div>
        ))}
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
