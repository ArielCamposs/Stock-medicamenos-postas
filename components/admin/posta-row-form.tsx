"use client";

import { useActionState } from "react";

import { updatePostaAction } from "@/app/actions/admin-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PostaRow = {
  id: string;
  nombre: string;
  codigo: string | null;
  activa: boolean;
};

export function PostaRowForm({ posta }: { posta: PostaRow }) {
  const [state, formAction, pending] = useActionState(updatePostaAction, {});

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground ring-1 ring-border"
    >
      <input type="hidden" name="id" value={posta.id} />

      {state.error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`posta-nombre-${posta.id}`}>Nombre</Label>
          <Input
            id={`posta-nombre-${posta.id}`}
            name="nombre"
            required
            defaultValue={posta.nombre}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`posta-codigo-${posta.id}`}>Código</Label>
          <Input
            id={`posta-codigo-${posta.id}`}
            name="codigo"
            defaultValue={posta.codigo ?? ""}
            placeholder="Opcional"
          />
        </div>

        <div className="flex items-end gap-2 pb-1">
          <input
            id={`posta-activa-${posta.id}`}
            name="activa"
            type="checkbox"
            defaultChecked={posta.activa}
            className="size-4 rounded border-input accent-primary"
          />
          <Label htmlFor={`posta-activa-${posta.id}`} className="font-normal">
            Activa
          </Label>
        </div>
      </div>

      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
