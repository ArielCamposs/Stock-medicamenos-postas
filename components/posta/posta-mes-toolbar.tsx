import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { mesAnterior, mesSiguiente, anioMesActual } from "@/lib/domain/fecha-mes";
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
  const actual = anioMesActual();
  const esMesActual = anio === actual.anio && mes === actual.mes;
  const esMesPasado = anio < actual.anio || (anio === actual.anio && mes < actual.mes);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm overflow-hidden",
        className
      )}
    >
      {/* Cabecera con el mes prominente */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="size-5 text-primary shrink-0" />
          <div>
            <p className="font-heading text-base font-semibold capitalize text-foreground">
              {tituloMesChile(anio, mes)}
            </p>
            <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
              Período de trabajo activo
            </p>
          </div>
        </div>
        {esMesActual ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Mes en curso
          </span>
        ) : esMesPasado ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
            Mes anterior
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-400">
            <span className="size-1.5 rounded-full bg-sky-500" />
            Mes futuro
          </span>
        )}
      </div>

      {/* Controles de navegación */}
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
          {queryExtra
            ? Object.entries(queryExtra).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))
            : null}
          <div className="space-y-1.5">
            <label htmlFor="posta-mes-ym" className="text-xs font-medium text-foreground">
              Ir a otro mes
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
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <ChevronLeft className="size-4" />
            Mes anterior
          </Link>
          <Link
            href={hrefMes(basePath, next.anio, next.mes, queryExtra)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            Mes siguiente
            <ChevronRight className="size-4" />
          </Link>
        </div>
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

