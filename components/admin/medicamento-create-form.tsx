"use client";

import { useActionState } from "react";

import { createMedicamentoAction } from "@/app/actions/admin-catalog";
import { MedicamentoCategoriaNativeSelect } from "@/components/admin/medicamento-categoria-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MedicamentoCreateForm({
  codigoInternoSugerido,
}: {
  codigoInternoSugerido: string;
}) {
  const [state, formAction, pending] = useActionState(
    createMedicamentoAction,
    {}
  );

  const codigoInterno =
    state.values?.codigo_interno?.trim() || codigoInternoSugerido;

  return (
    <form key={state.error ? JSON.stringify(state.values) : "form"} action={formAction} className="grid gap-4 sm:grid-cols-2">
      {state.error ? (
        <p
          className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="med-nuevo-nombre">Nombre</Label>
        <Input id="med-nuevo-nombre" name="nombre" defaultValue={state.values?.nombre} required />
        <p className="text-[11px] text-muted-foreground">
          Debe ser único en el catálogo (no se repite aunque cambien mayúsculas o espacios).
        </p>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="med-nuevo-categoria">Categoría</Label>
        <MedicamentoCategoriaNativeSelect id="med-nuevo-categoria" name="categoria" defaultValue={state.values?.categoria} />
        <p className="text-[11px] text-muted-foreground">
          La unidad de medida (comprimidos, ampollas, etc.) se asigna sola según la categoría.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="med-nuevo-ci">Código interno</Label>
        <Input
          id="med-nuevo-ci"
          name="codigo_interno"
          key={`ci-${codigoInterno}`}
          defaultValue={codigoInterno}
          readOnly
          aria-readonly="true"
          className="bg-muted font-mono tabular-nums"
        />
        <p className="text-[11px] text-muted-foreground">
          Se asigna automáticamente al guardar (siguiente en la secuencia del catálogo).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="med-nuevo-avis">Código AVIS</Label>
        <Input id="med-nuevo-avis" name="codigo_avis" defaultValue={state.values?.codigo_avis} placeholder="Opcional" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="med-nuevo-rec">Stock posta</Label>
        <Input
          id="med-nuevo-rec"
          name="stock_recomendado_default"
          type="number"
          min={0}
          step={1}
          defaultValue={state.values?.stock_recomendado_default ?? 0}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="med-nuevo-crit">Stock crítico</Label>
        <Input
          id="med-nuevo-crit"
          name="stock_critico_default"
          type="number"
          min={0}
          step={1}
          defaultValue={state.values?.stock_critico_default ?? 0}
          required
        />
      </div>

      <div className="flex items-end gap-2 pb-1">
        <input
          id="med-nuevo-activo"
          name="activo"
          type="checkbox"
          defaultChecked={state.values ? state.values.activo : true}
          className="size-4 rounded border-input accent-primary"
        />
        <Label htmlFor="med-nuevo-activo" className="font-normal">
          Activo en catálogo
        </Label>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 sm:col-span-2">
        <input
          id="med-nuevo-contra-receta"
          name="es_contra_receta"
          type="checkbox"
          defaultChecked={false}
          className="mt-0.5 size-4 rounded border-input accent-primary"
        />
        <div>
          <Label htmlFor="med-nuevo-contra-receta" className="font-medium leading-none">
            Medicamento contra receta
          </Label>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Aparecerá también en el pedido separado "Contra receta", además del pedido general.
          </p>
        </div>
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Crear medicamento"}
        </Button>
      </div>
    </form>
  );
}
