import Link from "next/link";

import { PostaRowForm } from "@/components/admin/posta-row-form";
import type { PostaRow } from "@/components/admin/posta-row-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type PostaResumenMetricas = {
  usuariosEnSede: number;
  descuentosHoy: number;
  ingresosHoy: number;
  medicamentosEnCritico: number;
  medicamentosCercaCritico: number;
};

type Props = {
  posta: PostaRow;
  /** ISO `created_at` de la fila en `postas` */
  creadaEnIso: string;
  metricas: PostaResumenMetricas;
  /** `YYYY-MM` para enlaces de descuento / ingresos / consumo */
  ymOperacion: string;
  /** Etiqueta del mes de stock (ej. `05/2026`) */
  mesStockEtiqueta: string;
  puedeEditar: boolean;
};

function fechaCorta(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", { dateStyle: "medium" });
}

export function PostaAdminResumenCard({
  posta,
  creadaEnIso,
  metricas,
  ymOperacion,
  mesStockEtiqueta,
  puedeEditar,
}: Props) {
  const q = `ym=${encodeURIComponent(ymOperacion)}`;
  const hayAlerta =
    metricas.medicamentosEnCritico > 0 || metricas.medicamentosCercaCritico > 0;

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden border-2 shadow-sm transition-shadow",
        !posta.activa && "border-dashed opacity-90"
      )}
    >
      <CardHeader className="border-b bg-muted/30 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base leading-snug">{posta.nombre}</CardTitle>
            <CardDescription className="font-mono text-xs">
              Código: {posta.codigo?.trim() ? posta.codigo : "—"}
            </CardDescription>
          </div>
          <Badge variant={posta.activa ? "default" : "secondary"}>
            {posta.activa ? "Activa" : "Inactiva"}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Alta en el sistema: {fechaCorta(creadaEnIso)} · Stock visto al mes {mesStockEtiqueta}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-4">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
          <div className="rounded-md border bg-background/80 px-2 py-1.5">
            <dt className="text-muted-foreground">Usuarios en sede</dt>
            <dd className="font-heading text-lg font-semibold tabular-nums text-foreground">
              {metricas.usuariosEnSede}
            </dd>
          </div>
          <div className="rounded-md border bg-background/80 px-2 py-1.5">
            <dt className="text-muted-foreground">Descuentos hoy</dt>
            <dd className="font-heading text-lg font-semibold tabular-nums text-foreground">
              {metricas.descuentosHoy}
            </dd>
          </div>
          <div className="rounded-md border bg-background/80 px-2 py-1.5">
            <dt className="text-muted-foreground">Ingresos hoy</dt>
            <dd className="font-heading text-lg font-semibold tabular-nums text-foreground">
              {metricas.ingresosHoy}
            </dd>
          </div>
        </dl>

        {hayAlerta ? (
          <div
            className={cn(
              "rounded-md border px-2.5 py-2 text-xs",
              metricas.medicamentosEnCritico > 0
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-50"
            )}
          >
            <span className="font-medium">Stock en el mes: </span>
            {metricas.medicamentosEnCritico > 0 ? (
              <span>
                {metricas.medicamentosEnCritico} medicamento
                {metricas.medicamentosEnCritico === 1 ? "" : "s"} en o bajo crítico
              </span>
            ) : null}
            {metricas.medicamentosEnCritico > 0 && metricas.medicamentosCercaCritico > 0
              ? " · "
              : null}
            {metricas.medicamentosCercaCritico > 0 ? (
              <span>
                {metricas.medicamentosCercaCritico} cerca del crítico
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sin alertas de stock en el mes calendario ({mesStockEtiqueta}).
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/postas/${posta.id}/dashboard`}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "h-8")}
          >
            Resumen
          </Link>
          <Link
            href={`/postas/${posta.id}/descuento?${q}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
          >
            Descuento
          </Link>
          <Link
            href={`/postas/${posta.id}/ingresos?${q}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
          >
            Ingresos
          </Link>
          <Link
            href={`/postas/${posta.id}/consumo?${q}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
          >
            Consumo
          </Link>
          <Link
            href={`/postas/${posta.id}/pedidos?${q}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
          >
            Pedidos
          </Link>
        </div>

        {puedeEditar ? (
          <details className="group rounded-lg border border-dashed bg-muted/20 p-1 text-sm">
            <summary className="cursor-pointer list-none px-2 py-2 font-medium text-foreground outline-none marker:content-none [&::-webkit-details-marker]:hidden hover:bg-muted/40 rounded-md">
              Editar nombre, código o estado de la sede
            </summary>
            <div className="border-t bg-card px-2 pb-3 pt-3">
              <PostaRowForm posta={posta} />
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
