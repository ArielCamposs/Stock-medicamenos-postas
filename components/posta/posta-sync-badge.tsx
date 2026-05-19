"use client";

import { useCallback, useEffect, useState } from "react";

import { getErrorMovements, getPendingMovements } from "@/lib/offline/db";
import { cn } from "@/lib/utils";

type Props = {
  postaId: string;
  className?: string;
};

export function PostaSyncBadge({ postaId, className }: Props) {
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState(0);

  const reload = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([
        getPendingMovements(postaId),
        getErrorMovements(postaId),
      ]);
      setPending(p.length);
      setErrors(e.length);
    } catch {
      setPending(0);
      setErrors(0);
    }
  }, [postaId]);

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => void reload(), 8000);
    const onVis = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reload]);

  const total = pending + errors;
  if (total === 0) return null;

  const titulo =
    errors > 0
      ? `${pending} pendiente(s), ${errors} con error. Revisa Descuento.`
      : `${pending} descuento(s) por sincronizar.`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
        errors > 0
          ? "bg-destructive/15 text-destructive"
          : "bg-amber-500/20 text-amber-950 dark:text-amber-50",
        className
      )}
      title={titulo}
    >
      <span aria-hidden>{total}</span>
      <span className="sr-only">{titulo}</span>
    </span>
  );
}
