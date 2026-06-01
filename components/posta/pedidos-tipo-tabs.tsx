"use client";

import { useRouter } from "next/navigation";
import { ClipboardList, FileText } from "lucide-react";

import type { TipoPedido } from "@/app/actions/pedido-mensual";
import { etiquetaPedidoEstadoCorto } from "@/lib/domain/pedido-estado-ui";
import { cn } from "@/lib/utils";

type EstadoPedidoTab =
  | "BORRADOR"
  | "ENVIADO"
  | "APROBADO"
  | "OBSERVADO"
  | "RECHAZADO"
  | "DESPACHADO"
  | "RECIBIDO"
  | null;

type Tab = {
  id: TipoPedido;
  label: string;
  labelCorto: string;
  Icon: typeof ClipboardList;
  descripcion: string;
};

const TABS: Tab[] = [
  {
    id: "GENERAL",
    label: "Pedido general",
    labelCorto: "General",
    Icon: ClipboardList,
    descripcion: "Medicamentos del catálogo general de la posta.",
  },
  {
    id: "CONTRA_RECETA",
    label: "Contra receta",
    labelCorto: "Contra receta",
    Icon: FileText,
    descripcion: "Medicamentos con entrega contra receta (pedido separado).",
  },
];

export function PedidosTipoTabs({
  postaId,
  tabActiva,
  ymQuery,
  hayContraReceta,
  estadoGeneral,
  estadoContraReceta,
  queryExtra,
  children,
}: {
  postaId: string;
  tabActiva: TipoPedido;
  ymQuery: string;
  /** Si no hay medicamentos contra receta, el tab se muestra deshabilitado. */
  hayContraReceta: boolean;
  estadoGeneral: EstadoPedidoTab;
  estadoContraReceta: EstadoPedidoTab;
  queryExtra?: Record<string, string>;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function irTab(tab: TipoPedido) {
    if (tab === tabActiva) return;
    const q = new URLSearchParams({ ym: ymQuery, ...queryExtra });
    q.set("tab", tab === "CONTRA_RECETA" ? "contra-receta" : "general");
    router.replace(`/postas/${postaId}/pedidos?${q.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/80 bg-muted/50 p-1.5 shadow-sm sm:max-w-lg">
        <div className="grid grid-cols-2 gap-1.5">
          {TABS.map(({ id, label, labelCorto, Icon }) => {
            const activa = tabActiva === id;
            const sinMedicamentosContraReceta = id === "CONTRA_RECETA" && !hayContraReceta;
            const estadoTab = id === "GENERAL" ? estadoGeneral : estadoContraReceta;
            const estadoEtiqueta = estadoTab ? etiquetaPedidoEstadoCorto(estadoTab) : "Sin pedido";
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => irTab(id)}
                title={
                  sinMedicamentosContraReceta
                    ? "Abrir pedido contra receta (falta configurar medicamentos en administración)."
                    : undefined
                }
                className={cn(
                  "inline-flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-150",
                  activa
                    ? "border border-primary/25 bg-background text-primary shadow-sm ring-1 ring-primary/15"
                    : sinMedicamentosContraReceta
                      ? "border border-transparent text-muted-foreground/70 hover:border-border/60 hover:bg-background/70 hover:text-foreground"
                      : "border border-transparent text-muted-foreground hover:border-border/60 hover:bg-background/70 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-[1.125rem] shrink-0",
                    activa ? "text-primary" : "opacity-70"
                  )}
                  aria-hidden
                />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{labelCorto}</span>
                <span
                  className={cn(
                    "ml-0.5 inline-flex max-w-[7rem] truncate rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                    activa
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/60 bg-background/80 text-muted-foreground"
                  )}
                  title={estadoEtiqueta}
                >
                  {estadoEtiqueta}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}
