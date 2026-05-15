"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  actualizarIngresoStockMesAction,
  eliminarIngresoStockMesAction,
} from "@/app/actions/posta";
import type { PostaActionState } from "@/app/actions/posta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type UltimoIngresoRow = {
  id: string;
  fecha: string;
  cantidad: number;
  tipoLabel: string;
  referencia: string | null;
  observacion: string | null;
  medNombre: string;
  medCodigo: string;
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

function EliminarIngresoButton({
  postaId,
  ingresoId,
}: {
  postaId: string;
  ingresoId: string;
}) {
  const router = useRouter();
  const bound = eliminarIngresoStockMesAction.bind(null, postaId);
  const [state, formAction, pending] = useActionState(
    bound as (s: PostaActionState, fd: FormData) => Promise<PostaActionState>,
    {}
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="ingreso_id" value={ingresoId} />
      <input
        type="text"
        name="motivo_anulacion"
        required
        maxLength={500}
        placeholder="Motivo"
        className="mr-1 h-8 w-28 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="Motivo de anulación"
      />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="h-8 text-destructive hover:text-destructive"
        disabled={pending}
        onClick={(e) => {
          if (
            !window.confirm(
              "¿Anular este ingreso? Se actualiza el stock del mes."
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        {pending ? "…" : "Anular"}
      </Button>
      {state.error ? (
        <p className="mt-1 text-[10px] text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

function EditarIngresoModal({
  postaId,
  row,
  onClose,
}: {
  postaId: string;
  row: UltimoIngresoRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const bound = actualizarIngresoStockMesAction.bind(null, postaId);
  const [state, formAction, pending] = useActionState(
    bound as (s: PostaActionState, fd: FormData) => Promise<PostaActionState>,
    {}
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state.ok, onClose, router]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ingreso-edit-title"
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="ingreso-edit-title" className="text-base font-semibold">
          Corregir ingreso
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatFechaEs(row.fecha)} · {row.medNombre}
        </p>

        {state.error ? (
          <p
            className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}

        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="ingreso_id" value={row.id} />
          <div className="space-y-2">
            <Label htmlFor="ingreso-edit-cant">Cantidad</Label>
            <Input
              id="ingreso-edit-cant"
              name="cantidad"
              type="number"
              min={1}
              step={1}
              required
              defaultValue={row.cantidad}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ingreso-edit-motivo">Motivo de corrección</Label>
            <Input
              id="ingreso-edit-motivo"
              name="motivo_correccion"
              required
              maxLength={500}
              placeholder="Ej: digitación incorrecta"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ingreso-edit-obs">Observación</Label>
            <Input
              id="ingreso-edit-obs"
              name="observacion"
              maxLength={500}
              defaultValue={row.observacion ?? ""}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function UltimosIngresosTabla({
  postaId,
  puedeRegistrar,
  rows,
}: {
  postaId: string;
  puedeRegistrar: boolean;
  rows: UltimoIngresoRow[];
}) {
  const [editRow, setEditRow] = useState<UltimoIngresoRow | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay ingresos registrados para esta posta.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Fecha</th>
              <th className="py-2 pr-3 font-medium">Medicamento</th>
              <th className="py-2 pr-2 text-right font-medium">Cantidad</th>
              <th className="py-2 pr-3 font-medium">Origen</th>
              <th className="py-2 pr-3 font-medium">Referencia</th>
              <th className="py-2 pr-3 font-medium">Obs.</th>
              {puedeRegistrar ? (
                <th className="py-2 text-right font-medium">Acciones</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="py-2 pr-3 whitespace-nowrap align-top">
                  {formatFechaEs(r.fecha)}
                </td>
                <td className="py-2 pr-3 align-top">
                  <span className="font-medium">{r.medNombre}</span>
                  {r.medCodigo ? (
                    <span className="ml-1 text-muted-foreground">({r.medCodigo})</span>
                  ) : null}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums align-top">{r.cantidad}</td>
                <td className="py-2 pr-3 align-top">{r.tipoLabel}</td>
                <td className="max-w-[12rem] py-2 align-top text-muted-foreground">
                  {r.referencia ?? "—"}
                </td>
                <td className="max-w-[12rem] py-2 pr-3 align-top text-muted-foreground">
                  {r.observacion ?? "—"}
                </td>
                {puedeRegistrar ? (
                  <td className="py-2 text-right align-top">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => setEditRow(r)}
                      >
                        Editar
                      </Button>
                      <EliminarIngresoButton postaId={postaId} ingresoId={r.id} />
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editRow ? (
        <EditarIngresoModal postaId={postaId} row={editRow} onClose={() => setEditRow(null)} />
      ) : null}
    </>
  );
}
