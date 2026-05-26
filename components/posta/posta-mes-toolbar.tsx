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
        "rounded-xl border border-border bg-card shadow-sm p-3",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Navegación de meses */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href={hrefMes(basePath, prev.anio, prev.mes, queryExtra)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 px-3 gap-1 shadow-sm hover:shadow-md transition-all")}
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline text-xs font-semibold">Mes anterior</span>
          </Link>

          <div className="flex items-center gap-2 bg-muted/40 border border-border/60 rounded-lg px-3 py-1.5 min-h-[36px]">
            <CalendarDays className="size-4 text-primary shrink-0" />
            <span className="font-heading text-sm sm:text-base font-bold capitalize text-foreground leading-none">
              {tituloMesChile(anio, mes)}
            </span>
            {esMesActual ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                En curso
              </span>
            ) : esMesPasado ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted border border-border px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                <span className="size-1.5 rounded-full bg-muted-foreground/45" />
                Pasado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-400">
                <span className="size-1.5 rounded-full bg-sky-500" />
                Futuro
              </span>
            )}
          </div>

          <Link
            href={hrefMes(basePath, next.anio, next.mes, queryExtra)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 px-3 gap-1 shadow-sm hover:shadow-md transition-all")}
          >
            <span className="hidden sm:inline text-xs font-semibold">Mes siguiente</span>
            <ChevronRight className="size-4" />
          </Link>
          
          {!esMesActual && (
            <Link
              href={hrefMes(basePath, actual.anio, actual.mes, queryExtra)}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-9 px-2.5 gap-1.5 text-xs text-primary hover:text-primary/90 font-bold hover:bg-primary/5 transition-all")}
            >
              <span className="size-1.5 rounded-full bg-primary" />
              Mes actual
            </Link>
          )}
        </div>

        {/* Ir a otro mes */}
        <div className="flex items-center gap-2">
          <form method="get" action={basePath} className="flex items-center gap-1.5">
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
                "flex h-9 w-[135px] rounded-lg border border-input bg-transparent px-2.5 py-1 text-xs sm:text-sm outline-none transition-colors",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              )}
            />
            <Button type="submit" variant="secondary" size="sm" className="h-9 text-xs px-3 font-semibold border border-border/60">
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

