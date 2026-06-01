"use client";

import { useActionState, useEffect, useState } from "react";

import {
  deleteMedicamentoAction,
  updateMedicamentoAction,
} from "@/app/actions/admin-catalog";
import { MedicamentoCategoriaNativeSelect } from "@/components/admin/medicamento-categoria-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MedicamentoCategoria } from "@/lib/domain/medicamento-categoria";

export type MedicamentoRow = {
  id: string;
  nombre: string;
  codigo_interno: string;
  codigo_avis: string | null;
  unidad_medida: string;
  categoria: MedicamentoCategoria;
  stock_recomendado_default: number;
  stock_critico_default: number;
  activo: boolean;
  es_contra_receta: boolean;
  /** Cambia en cada update en DB; sirve para remontar el formulario tras revalidatePath. */
  updated_at: string;
};

export function MedicamentoRowForm({
  medicamento,
  onSuccess,
  onDeleted,
}: {
  medicamento: MedicamentoRow;
  onSuccess?: () => void;
  onDeleted?: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateMedicamentoAction, {});
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteMedicamentoAction,
    {}
  );
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  useEffect(() => {
    if (state.success && !state.error) onSuccess?.();
  }, [state.success, state.error, onSuccess]);

  useEffect(() => {
    if (deleteState.success && !deleteState.error) onDeleted?.();
  }, [deleteState.success, deleteState.error, onDeleted]);

  return (
    <div
      key={`${medicamento.id}-${medicamento.updated_at}`}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground ring-1 ring-border"
    >
      {state.error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      {state.success && !state.error ? (
        <p
          className="rounded-md border border-emerald-600/35 bg-emerald-600/10 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-50"
          role="status"
        >
          {state.success}
        </p>
      ) : null}

      {deleteState.error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {deleteState.error}
        </p>
      ) : null}

      {deleteState.success && !deleteState.error ? (
        <p
          className="rounded-md border border-emerald-600/35 bg-emerald-600/10 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-50"
          role="status"
        >
          {deleteState.success}
        </p>
      ) : null}

      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={medicamento.id} />
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`med-nombre-${medicamento.id}`}>Nombre</Label>
          <Input
            id={`med-nombre-${medicamento.id}`}
            name="nombre"
            required
            defaultValue={medicamento.nombre}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`med-categoria-${medicamento.id}`}>Categoría</Label>
          <MedicamentoCategoriaNativeSelect
            id={`med-categoria-${medicamento.id}`}
            name="categoria"
            defaultValue={medicamento.categoria}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`med-ci-${medicamento.id}`}>Código interno</Label>
          <Input
            id={`med-ci-${medicamento.id}`}
            name="codigo_interno"
            required
            defaultValue={medicamento.codigo_interno}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`med-avis-${medicamento.id}`}>Código AVIS</Label>
          <Input
            id={`med-avis-${medicamento.id}`}
            name="codigo_avis"
            defaultValue={medicamento.codigo_avis ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`med-rec-${medicamento.id}`}>Stock recomendado</Label>
          <Input
            id={`med-rec-${medicamento.id}`}
            name="stock_recomendado_default"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={medicamento.stock_recomendado_default}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`med-crit-${medicamento.id}`}>Stock crítico</Label>
          <Input
            id={`med-crit-${medicamento.id}`}
            name="stock_critico_default"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={medicamento.stock_critico_default}
          />
        </div>

        <div className="flex items-end gap-2 pb-1">
          <input
            id={`med-activo-${medicamento.id}`}
            name="activo"
            type="checkbox"
            defaultChecked={medicamento.activo}
            className="size-4 rounded border-input accent-primary"
          />
          <Label htmlFor={`med-activo-${medicamento.id}`} className="font-normal">
            Activo en catálogo
          </Label>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 sm:col-span-2">
          <input
            id={`med-contra-receta-${medicamento.id}`}
            name="es_contra_receta"
            type="checkbox"
            defaultChecked={medicamento.es_contra_receta}
            className="mt-0.5 size-4 rounded border-input accent-primary"
          />
          <div>
            <Label htmlFor={`med-contra-receta-${medicamento.id}`} className="font-medium leading-none">
              Medicamento contra receta
            </Label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Aparecerá también en el pedido separado "Contra receta", además del pedido general.
            </p>
          </div>
        </div>

        <div className="sm:col-span-2 flex justify-end">
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={pending || deletePending}
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>

      <div className="border-t border-border/60 pt-3">
        {confirmarEliminar ? (
          <form
            action={deleteFormAction}
            className="space-y-2 rounded-md border border-destructive/35 bg-destructive/5 p-3"
          >
            <input type="hidden" name="id" value={medicamento.id} />
            <input type="hidden" name="confirmar" value="si" />
            <p className="text-xs text-foreground leading-relaxed">
              ¿Eliminar <strong>{medicamento.nombre}</strong> del catálogo? Solo es posible si nunca
              tuvo stock, consumos ni pedidos. No se puede deshacer.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={deletePending || pending}
              >
                {deletePending ? "Eliminando…" : "Sí, eliminar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deletePending}
                onClick={() => setConfirmarEliminar(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending || deletePending}
            onClick={() => setConfirmarEliminar(true)}
          >
            Eliminar medicamento
          </Button>
        )}
      </div>
    </div>
  );
}
