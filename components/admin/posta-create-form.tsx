"use client";

import { useActionState } from "react";

import { createPostaAction } from "@/app/actions/admin-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PostaCreateForm() {
  const [state, formAction, pending] = useActionState(createPostaAction, {});

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {state.error ? (
        <p
          className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="posta-nueva-nombre">Nombre</Label>
        <Input
          id="posta-nueva-nombre"
          name="nombre"
          required
          placeholder="Ej: Posta rural Norte"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="posta-nueva-codigo">Código (opcional)</Label>
        <Input
          id="posta-nueva-codigo"
          name="codigo"
          placeholder="Ej: P01"
          autoComplete="off"
        />
      </div>

      <div className="flex items-end gap-2 pb-1">
        <input
          id="posta-nueva-activa"
          name="activa"
          type="checkbox"
          defaultChecked
          className="size-4 rounded border-input accent-primary"
        />
        <Label htmlFor="posta-nueva-activa" className="font-normal">
          Activa
        </Label>
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Crear posta"}
        </Button>
      </div>
    </form>
  );
}
