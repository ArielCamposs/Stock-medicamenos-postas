"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";

import {
  despacharPedidoInsumosBodegaAction,
  despacharPedidoMensualBodegaAction,
  type BodegaPedidoActionState,
} from "@/app/actions/bodega-pedidos";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";

type Props = {
  pedidoId: string;
  tipo: "medicamentos" | "insumos";
  postaNombre: string;
};

export function DespacharPedidoButton({ pedidoId, tipo, postaNombre }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const action =
    tipo === "insumos" ? despacharPedidoInsumosBodegaAction : despacharPedidoMensualBodegaAction;
  const [state, formAction, pending] = useActionState(
    action as (s: BodegaPedidoActionState, fd: FormData) => Promise<BodegaPedidoActionState>,
    {}
  );

  useEffect(() => {
    if (state.ok) {
      toast(state.success ?? "Despachado.", "success");
      router.refresh();
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state, toast, router]);

  return (
    <form action={formAction} className="inline-flex">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <Button
        type="submit"
        size="sm"
        disabled={pending}
        title={`Marcar pedido de ${postaNombre} como despachado`}
        className="gap-1.5"
      >
        <Truck className="size-4" aria-hidden />
        {pending ? "Despachando…" : "Despachar"}
      </Button>
    </form>
  );
}
