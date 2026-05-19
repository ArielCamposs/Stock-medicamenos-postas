"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import {
  cerrarMesPostaAction,
  reabrirCierreMensualPostaAction,
  type PostaActionState,
} from "@/app/actions/posta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CerrarMesButton({
  postaId,
  anio,
  mes,
  habilitado,
}: {
  postaId: string;
  anio: number;
  mes: number;
  /** Solo `true` en la ventana de cierre; validación en servidor. */
  habilitado: boolean;
}) {
  const router = useRouter();
  const bound = cerrarMesPostaAction.bind(null, postaId);
  const [state, formAction, pending] = useActionState(
    bound as (s: PostaActionState, fd: FormData) => Promise<PostaActionState>,
    {}
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="anio" value={anio} />
      <input type="hidden" name="mes" value={mes} />
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-emerald-700">{state.success}</p> : null}
      <Button
        type="submit"
        disabled={pending || !habilitado}
        onClick={(e) => {
          if (!habilitado) {
            e.preventDefault();
            return;
          }
          if (!window.confirm("¿Cerrar este mes? No se podrán cargar ni corregir movimientos sin reapertura.")) {
            e.preventDefault();
          }
        }}
      >
        {pending ? "Cerrando…" : "Cerrar mes"}
      </Button>
    </form>
  );
}

export function ReabrirMesForm({
  postaId,
  cierreId,
}: {
  postaId: string;
  cierreId: string;
}) {
  const router = useRouter();
  const bound = reabrirCierreMensualPostaAction.bind(null, postaId);
  const [state, formAction, pending] = useActionState(
    bound as (s: PostaActionState, fd: FormData) => Promise<PostaActionState>,
    {}
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="cierre_id" value={cierreId} />
      <div className="space-y-2">
        <Label htmlFor="motivo-reapertura">Motivo de reapertura</Label>
        <Input
          id="motivo-reapertura"
          name="motivo_reapertura"
          required
          maxLength={500}
          placeholder="Ej: corrección respaldada por administración"
        />
      </div>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-emerald-700">{state.success}</p> : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Reabriendo…" : "Reabrir mes"}
      </Button>
    </form>
  );
}
