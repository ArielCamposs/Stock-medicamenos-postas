"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  cambiarEstadoPedidoMensualAdminAction,
  type PedidoMensualActionState,
} from "@/app/actions/pedido-mensual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AprobarPedidoButton({
  pedidoId,
  estado,
}: {
  pedidoId: string;
  estado: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    cambiarEstadoPedidoMensualAdminAction as (
      s: PedidoMensualActionState,
      fd: FormData
    ) => Promise<PedidoMensualActionState>,
    {}
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <Input
        name="comentario_admin"
        maxLength={500}
        placeholder="Comentario"
        className="h-8 w-40 text-xs"
      />
      {state.error ? (
        <span className="max-w-[14rem] text-right text-xs text-destructive">{state.error}</span>
      ) : null}
      <div className="flex flex-wrap justify-end gap-1">
        {estado === "ENVIADO" ? (
          <>
            <Button type="submit" name="estado" value="OBSERVADO" size="sm" variant="outline" disabled={pending}>
              Observar
            </Button>
            <Button type="submit" name="estado" value="RECHAZADO" size="sm" variant="destructive" disabled={pending}>
              Rechazar
            </Button>
            <Button type="submit" name="estado" value="APROBADO" size="sm" variant="default" disabled={pending}>
              {pending ? "…" : "Aprobar"}
            </Button>
          </>
        ) : estado === "APROBADO" ? (
          <Button type="submit" name="estado" value="DESPACHADO" size="sm" variant="default" disabled={pending}>
            Despachar
          </Button>
        ) : estado === "DESPACHADO" ? (
          <Button type="submit" name="estado" value="RECIBIDO" size="sm" variant="default" disabled={pending}>
            Recibido
          </Button>
        ) : null}
      </div>
    </form>
  );
}
