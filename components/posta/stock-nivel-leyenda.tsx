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
        "flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground",
        className
      )}
      role="note"
      aria-label="Leyenda de colores de stock"
    >
      {!compact ? <span className="font-medium text-foreground">Leyenda:</span> : null}
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className={cn("h-3 w-1 rounded-full", item.bar)}
            aria-hidden
          />
          <span
            className={cn("hidden h-3 w-3 rounded border border-border/60 sm:inline-block", item.cell)}
            aria-hidden
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
