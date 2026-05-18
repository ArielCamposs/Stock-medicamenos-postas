import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { mesAnterior, mesSiguiente } from "@/lib/domain/fecha-mes";
import { cn } from "@/lib/utils";

function ymParam(anio: number, mes: number) {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

type Props = {
  basePath: string;
  anio: number;
  mes: number;
  /** Parámetros extra en los links de mes (ej. from=admin). */
  queryExtra?: Record<string, string>;
  className?: string;
};

function hrefMes(
  basePath: string,
  anio: number,
  mes: number,
  queryExtra?: Record<string, string>
) {
  const q = new URLSearchParams({ ym: ymParam(anio, mes), ...queryExtra });
  return `${basePath}?${q.toString()}`;
}

export function PostaMesToolbar({
  basePath,
  anio,
  mes,
  queryExtra,
  className,
}: Props) {
  const ymActual = ymParam(anio, mes);
  const prev = mesAnterior(anio, mes);
  const next = mesSiguiente(anio, mes);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:justify-between",
        className
      )}
    >
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
        {queryExtra
          ? Object.entries(queryExtra).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))
          : null}
        <div className="space-y-1.5">
          <label htmlFor="posta-mes-ym" className="text-xs font-medium text-foreground">
            Mes a trabajar
          </label>
          <input
            id="posta-mes-ym"
            name="ym"
            type="month"
            min="2020-01"
            max="2100-12"
            defaultValue={ymActual}
            className={cn(
              "flex h-9 rounded-lg border border-input bg-transparent px-2 py-1 text-sm outline-none",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            )}
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Ver mes
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Link
          href={hrefMes(basePath, prev.anio, prev.mes, queryExtra)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          ← Mes anterior
        </Link>
        <Link
          href={hrefMes(basePath, next.anio, next.mes, queryExtra)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Mes siguiente →
        </Link>
      </div>
    </div>
  );
}

export function tituloMesChile(anio: number, mes: number) {
  return new Date(anio, mes - 1, 1).toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
}
