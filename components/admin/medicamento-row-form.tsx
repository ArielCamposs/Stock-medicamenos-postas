"use client";

import { useActionState } from "react";

import { updateMedicamentoAction } from "@/app/actions/admin-catalog";
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
  /** Cambia en cada update en DB; sirve para remontar el formulario tras revalidatePath. */
  updated_at: string;
};

export function MedicamentoRowForm({ medicamento }: { medicamento: MedicamentoRow }) {
  const [state, formAction, pending] = useActionState(updateMedicamentoAction, {});

  return (
    <form
      key={`${medicamento.id}-${medicamento.updated_at}`}
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground ring-1 ring-border"
    >
      <input type="hidden" name="id" value={medicamento.id} />

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

      <div className="grid gap-3 sm:grid-cols-2">
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

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`med-um-${medicamento.id}`}>Unidad de medida</Label>
          <Input
            id={`med-um-${medicamento.id}`}
            name="unidad_medida"
            required
            defaultValue={medicamento.unidad_medida}
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

        <div className="flex items-end gap-2 pb-1 sm:col-span-2">
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
      </div>

      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
