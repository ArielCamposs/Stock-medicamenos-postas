"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  togglePedidoBandejaListoAdminAction,
  type PedidoMensualActionState,
} from "@/app/actions/pedido-mensual";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PedidoBandejaListoButton({
  pedidoId,
  listo,
}: {
  pedidoId: string;
  listo: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    togglePedidoBandejaListoAdminAction as (
      s: PedidoMensualActionState,
      fd: FormData
    ) => Promise<PedidoMensualActionState>,
    {}
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={formAction} className="inline-flex flex-col items-end justify-center gap-0.5">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      {state.error ? (
        <span className="max-w-[10rem] text-right text-[10px] text-destructive">{state.error}</span>
      ) : null}
      <Button
        type="submit"
        size="sm"
        variant={listo ? "outline" : "secondary"}
        disabled={pending}
        className={cn(
          "h-8 text-xs",
          listo &&
            "border-emerald-600/50 bg-emerald-500/15 text-emerald-950 hover:bg-emerald-500/25 dark:text-emerald-50"
        )}
      >
        {pending ? "…" : listo ? "Quitar listo" : "Marcar listo"}
      </Button>
    </form>
  );
}
