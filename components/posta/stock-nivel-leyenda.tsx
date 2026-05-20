import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  compact?: boolean;
};

export function StockNivelLeyenda({ className, compact }: Props) {
  const items = [
    {
      label: "Stock holgado",
      bar: "bg-emerald-500",
      cell: "bg-emerald-500/10",
    },
    {
      label: "Cerca del crítico",
      bar: "bg-amber-500",
      cell: "bg-amber-400/14 dark:bg-amber-500/12",
    },
    {
      label: "Crítico o bajo",
      bar: "bg-destructive",
      cell: "bg-destructive/10",
    },
  ] as const;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground",
        className
      )}
      role="note"
      aria-label="Leyenda de colores de stock"
    >
      {!compact ? <span className="font-medium text-foreground mr-1">Leyenda:</span> : null}
      {items.map((item) => (
        <span 
          key={item.label} 
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/40 border border-border/50 px-2 py-0.5 rounded-full"
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full", item.bar)}
            aria-hidden
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
