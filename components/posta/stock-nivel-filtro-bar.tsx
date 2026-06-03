"use client";

import type { NivelStockFiltro } from "@/lib/posta/admin-stock-alerta-postas";
import { cn } from "@/lib/utils";

const ITEMS: {
  id: NivelStockFiltro;
  label: string;
  bar: string;
  activo: string;
}[] = [
  {
    id: "holgado",
    label: "Stock holgado",
    bar: "bg-emerald-500",
    activo:
      "border-emerald-600/50 bg-emerald-500/15 text-emerald-950 ring-emerald-500/40 dark:text-emerald-100",
  },
  {
    id: "cerca",
    label: "Cerca del crítico",
    bar: "bg-amber-500",
    activo:
      "border-amber-600/50 bg-amber-500/15 text-amber-950 ring-amber-500/40 dark:text-amber-100",
  },
  {
    id: "critico",
    label: "Crítico o bajo",
    bar: "bg-destructive",
    activo:
      "border-destructive/50 bg-destructive/12 text-destructive ring-destructive/35 dark:text-red-200",
  },
];

type Props = {
  value: NivelStockFiltro | null;
  onChange: (value: NivelStockFiltro | null) => void;
  className?: string;
};

/** Leyenda de colores de stock como botones de filtro (toggle: otro clic quita el filtro). */
export function StockNivelFiltroBar({ value, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground",
        className
      )}
      role="group"
      aria-label="Filtrar por nivel de stock"
    >
      <span className="font-medium text-foreground mr-0.5">Filtrar stock:</span>
      {ITEMS.map((item) => {
        const activo = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(activo ? null : item.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors",
              "border-border/50 bg-muted/40 text-muted-foreground hover:bg-muted/70",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              activo && "ring-2 ring-offset-1 ring-offset-background",
              activo && item.activo
            )}
          >
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", item.bar)} aria-hidden />
            {item.label}
          </button>
        );
      })}
      {value ? (
        <button
          type="button"
          className="text-[10px] font-medium text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => onChange(null)}
        >
          Ver todos
        </button>
      ) : null}
    </div>
  );
}
