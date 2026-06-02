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
        className="rounded-xl border border-border/80 bg-muted/50 p-1.5 shadow-sm sm:max-w-md"
        role="tablist"
        aria-label="Secciones de insumos"
      >
        <div className="grid grid-cols-2 gap-1.5">
          {TABS.map(({ id, label, Icon }) => {
            const activa = tabActiva === id;
            const badge =
              id === "stock" && nStockCritico > 0 ? (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                  {nStockCritico}
                </span>
              ) : id === "pedido" && pedidoPendienteAtencion ? (
                <span
                  className="size-2 shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-500/30"
                  aria-label="Pedido requiere tu atención"
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
                  "inline-flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-150",
                  activa
                    ? "border border-primary/25 bg-background text-primary shadow-sm ring-1 ring-primary/15"
                    : "border border-transparent text-muted-foreground hover:border-border/60 hover:bg-background/70 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn("size-[1.125rem] shrink-0", activa ? "text-primary" : "opacity-70")}
                  aria-hidden
                />
                <span>{label}</span>
                {badge}
              </button>
            );
          })}
        </div>
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
