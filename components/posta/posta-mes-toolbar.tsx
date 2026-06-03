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
  /** Si el mes tiene un cierre vigente (no reabierto). */
  mesCerrado?: boolean;
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
  mesCerrado = false,
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
        "rounded-xl border border-border bg-card shadow-sm p-3",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {/* Navegación de meses */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            href={hrefMes(basePath, prev.anio, prev.mes, queryExtra)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 shrink-0 px-2.5 gap-1 shadow-sm hover:shadow-md transition-all sm:px-3")}
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline text-xs font-semibold">Mes anterior</span>
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 min-h-[36px] sm:flex-none sm:px-3">
            <CalendarDays className="size-4 text-primary shrink-0" />
            <span className="min-w-0 truncate font-heading text-sm font-bold capitalize text-foreground leading-none sm:text-base">
              {tituloMesChile(anio, mes)}
            </span>
            {esMesActual ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 max-sm:sr-only">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                En curso
              </span>
            ) : mesCerrado ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/25 px-2 py-0.5 text-[10px] font-bold text-violet-800 dark:text-violet-300 max-sm:sr-only">
                <span className="size-1.5 rounded-full bg-violet-500" />
                Cerrado
              </span>
            ) : esMesPasado ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-bold text-muted-foreground max-sm:sr-only">
                <span className="size-1.5 rounded-full bg-muted-foreground/45" />
                Pasado
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-400 max-sm:sr-only">
                <span className="size-1.5 rounded-full bg-sky-500" />
                Futuro
              </span>
            )}
          </div>

          <Link
            href={hrefMes(basePath, next.anio, next.mes, queryExtra)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 shrink-0 px-2.5 gap-1 shadow-sm hover:shadow-md transition-all sm:px-3")}
          >
            <span className="hidden sm:inline text-xs font-semibold">Mes siguiente</span>
            <ChevronRight className="size-4" />
          </Link>
          
          {!esMesActual && (
            <Link
              href={hrefMes(basePath, actual.anio, actual.mes, queryExtra)}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-9 shrink-0 px-2 gap-1.5 text-xs text-primary hover:text-primary/90 font-bold hover:bg-primary/5 transition-all")}
            >
              <span className="size-1.5 rounded-full bg-primary" />
              <span className="hidden sm:inline">Mes actual</span>
              <span className="sm:hidden">Hoy</span>
            </Link>
          )}
        </div>

        {/* Ir a otro mes */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <form method="get" action={basePath} className="flex w-full items-center gap-1.5 sm:w-auto">
            {queryExtra
              ? Object.entries(queryExtra).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))
              : null}
            <input
              id="posta-mes-ym"
              name="ym"
              type="month"
              min="2020-01"
              max="2100-12"
              defaultValue={ymActual}
              className={cn(
                "h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-xs outline-none transition-colors sm:w-[135px] sm:flex-none sm:text-sm",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              )}
            />
            <Button type="submit" variant="secondary" size="sm" className="h-9 shrink-0 text-xs px-3 font-semibold border border-border/60">
              Ir
            </Button>
          </form>
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

