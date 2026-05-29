"use client";

import { useRouter } from "next/navigation";
import { ClipboardList, Package } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type InsumosTab = "stock" | "pedido";

type Props = {
  postaId: string;
  tabActiva: InsumosTab;
  nStockCritico: number;
  pedidoPendienteAtencion: boolean;
  panelStock: ReactNode;
  panelPedido: ReactNode;
};

const TABS: { id: InsumosTab; label: string; Icon: typeof Package }[] = [
  { id: "stock", label: "Stock", Icon: Package },
  { id: "pedido", label: "Pedido", Icon: ClipboardList },
];

export function InsumosSeccionTabs({
  postaId,
  tabActiva,
  nStockCritico,
  pedidoPendienteAtencion,
  panelStock,
  panelPedido,
}: Props) {
  const router = useRouter();

  function cambiarTab(tab: InsumosTab) {
    if (tab === tabActiva) return;
    router.replace(`/postas/${postaId}/insumos?tab=${tab}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div
        className="flex border-b border-border/60"
        role="tablist"
        aria-label="Secciones de insumos"
      >
        {TABS.map(({ id, label, Icon }) => {
          const activa = tabActiva === id;
          const badge =
            id === "stock" && nStockCritico > 0 ? (
              <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                {nStockCritico}
              </span>
            ) : id === "pedido" && pedidoPendienteAtencion ? (
              <span
                className="ml-1.5 size-2 rounded-full bg-amber-500"
                aria-label="Pedido con observación"
              />
            ) : null;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => cambiarTab(id)}
              className={cn(
                "inline-flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 px-4 transition-all duration-150 -mb-px shrink-0",
                activa
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
              {badge}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" hidden={tabActiva !== "stock"}>
        {tabActiva === "stock" ? panelStock : null}
      </div>
      <div role="tabpanel" hidden={tabActiva !== "pedido"}>
        {tabActiva === "pedido" ? panelPedido : null}
      </div>
    </div>
  );
}
