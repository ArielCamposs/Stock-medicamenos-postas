"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

export function useCategoriasColapsables() {
  const [colapsadas, setColapsadas] = useState<Set<string>>(() => new Set());

  const estaExpandida = useCallback(
    (cat: string, forzarExpandida = false) => forzarExpandida || !colapsadas.has(cat),
    [colapsadas]
  );

  const toggle = useCallback((cat: string) => {
    setColapsadas((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const expandirTodas = useCallback(() => setColapsadas(new Set()), []);

  const colapsarTodas = useCallback((categorias: readonly string[]) => {
    setColapsadas(new Set(categorias));
  }, []);

  return {
    estaExpandida,
    toggle,
    expandirTodas,
    colapsarTodas,
    hayAlgunaColapsada: colapsadas.size > 0,
  };
}

type CabeceraProps = {
  etiqueta: string;
  expandida: boolean;
  onToggle: () => void;
  cantidad?: number;
  className?: string;
};

export function CategoriaGrupoCabeceraContenido({
  etiqueta,
  expandida,
  onToggle,
  cantidad,
  className,
}: CabeceraProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expandida}
      className={cn(
        "flex w-full min-w-0 items-center justify-between gap-2 rounded-md text-left transition-colors",
        "hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            !expandida && "-rotate-90"
          )}
          aria-hidden
        />
        <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-primary/50" aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/75">
          {etiqueta}
        </span>
      </span>
      {cantidad !== undefined ? (
        <span className="shrink-0 rounded-full border border-border/60 bg-muted/95 px-2 py-0.5 font-mono text-[10px] font-semibold normal-case tracking-normal text-muted-foreground/80 tabular-nums">
          {cantidad} {cantidad === 1 ? "ítem" : "ítems"}
        </span>
      ) : null}
    </button>
  );
}

export function CategoriasColapsarTodasBar({
  categorias,
  onExpandirTodas,
  onColapsarTodas,
  className,
}: {
  categorias: readonly string[];
  onExpandirTodas: () => void;
  onColapsarTodas: (cats: readonly string[]) => void;
  className?: string;
}) {
  if (categorias.length < 2) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground",
        className
      )}
    >
      <span>Categorías:</span>
      <button
        type="button"
        className="font-medium text-foreground/80 underline-offset-2 hover:underline"
        onClick={onExpandirTodas}
      >
        Expandir todas
      </button>
      <span aria-hidden>·</span>
      <button
        type="button"
        className="font-medium text-foreground/80 underline-offset-2 hover:underline"
        onClick={() => onColapsarTodas(categorias)}
      >
        Colapsar todas
      </button>
    </div>
  );
}
