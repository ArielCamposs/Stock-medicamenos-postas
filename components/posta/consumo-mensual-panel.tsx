"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ConsumoDiaModal } from "@/components/posta/consumo-dia-modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mesAnterior, mesSiguiente } from "@/lib/domain/fecha-mes";
import {
  etiquetaMedicamentoCategoria,
  MEDICAMENTO_CATEGORIAS,
  type MedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import { nivelAlertaStock } from "@/lib/posta/admin-stock-alerta-postas";
import { cn } from "@/lib/utils";

function normalizaBusqueda(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function medCoincideBusqueda(m: ConsumoMensualMedPayload, q: string) {
  if (!q) return true;
  const nombre = m.nombre.toLowerCase();
  const ci = m.codigo_interno.toLowerCase();
  const avis = (m.codigo_avis ?? "").toLowerCase();
  const cat = normalizaBusqueda(etiquetaMedicamentoCategoria[m.categoria]);
  return (
    nombre.includes(q) ||
    ci.includes(q) ||
    (avis.length > 0 && avis.includes(q)) ||
    cat.includes(q)
  );
}

export type ConsumoDiaCelda = {
  dia: number;
  fechaISO: string;
  con: number;
  sin: number;
  total: number;
  /** Texto libre guardado con el descuento del día (si existe). */
  observacion: string | null;
};

export type ConsumoMensualMedPayload = {
  id: string;
  nombre: string;
  codigo_interno: string;
  codigo_avis: string | null;
  unidad_medida: string;
  categoria: MedicamentoCategoria;
  stock_recomendado: number;
  stock_critico: number;
  cierre_mes_anterior: number;
  ingreso_mes: number;
  descuento_acumulado_mes: number;
  /** Stock en AVIS declarado manualmente para este mes (misma pantalla «Stock AVIS»). */
  stock_declarado_avis: number;
  disponible: number;
  dias: ConsumoDiaCelda[];
};

function ymParam(anio: number, mes: number) {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

function tituloMes(anio: number, mes: number) {
  return new Date(anio, mes - 1, 1).toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
}

type CeldaAbierta = {
  med: ConsumoMensualMedPayload;
  celda: ConsumoDiaCelda;
};

/** Saldo del mes al ir cerrando cada día (misma base que el disponible final del mes). */
function indicadoresDiasDescuento(med: ConsumoMensualMedPayload) {
  const base = med.cierre_mes_anterior + med.ingreso_mes;
  let descAcum = 0;
  return med.dias.map((d) => {
    descAcum += d.total;
    const saldoFinDia = base - descAcum;
    const nv = nivelAlertaStock(saldoFinDia, med.stock_critico, med.stock_recomendado);
    const alerta: "critico" | "cerca" | null =
      saldoFinDia < 0 || nv === "critico"
        ? "critico"
        : nv === "cerca"
          ? "cerca"
          : null;
    return { d, saldoFinDia, alerta };
  });
}

function MedicamentoMesCard({
  med,
  onOpen,
}: {
  med: ConsumoMensualMedPayload;
  onOpen: (c: CeldaAbierta) => void;
}) {
  const diasIndicados = indicadoresDiasDescuento(med);
  const nivelDisponible = nivelAlertaStock(
    med.disponible,
    med.stock_critico,
    med.stock_recomendado
  );
  const dispClass =
    med.disponible < 0
      ? "text-destructive"
      : nivelDisponible === "critico"
        ? "text-destructive"
        : nivelDisponible === "cerca"
          ? "text-amber-700 dark:text-amber-200"
          : "text-emerald-800 dark:text-emerald-100";

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm ring-1 ring-border/60">
      <div className="border-b border-border/80 px-3 py-2 sm:px-4">
        <h3 className="text-sm font-semibold leading-snug text-foreground">
          {med.nombre}
        </h3>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {med.codigo_interno} · {med.unidad_medida}
          {med.codigo_avis ? <span> · AVIS {med.codigo_avis}</span> : null}
        </p>
      </div>

      <div className="px-2 py-3 sm:px-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Días del mes
        </p>
        <div className="flex max-w-full flex-wrap gap-1.5">
          {diasIndicados.map(({ d, saldoFinDia, alerta }) => {
            const tiene = d.total > 0;
            const parteSaldo = `Saldo en el mes al cierre del día: ${saldoFinDia} ${med.unidad_medida}.`;
            const parteZona =
              alerta === "critico"
                ? "Zona crítica."
                : alerta === "cerca"
                  ? "Cerca del crítico."
                  : "Holgado respecto al crítico.";
            const tituloCelda = tiene
              ? `${parteSaldo} ${parteZona} Total descuento: ${d.total}. Con AVIS: ${d.con}. Sin AVIS: ${d.sin}.${d.observacion ? ` Observación: ${d.observacion}` : ""} Clic para ver o editar.`
              : `${parteSaldo} ${parteZona} Sin descuento registrado. Clic para cargar.`;
            return (
              <button
                key={d.fechaISO}
                type="button"
                title={tituloCelda}
                aria-label={tituloCelda}
                onClick={() => onOpen({ med, celda: d })}
                className={cn(
                  "flex min-h-[3.25rem] w-[2.85rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 py-1 text-[10px] transition-colors",
                  alerta === "critico" &&
                  "border-destructive/60 bg-destructive/15 font-medium text-foreground dark:bg-destructive/20",
                  alerta === "cerca" &&
                  "border-amber-500/55 bg-amber-500/15 font-medium text-foreground dark:bg-amber-950/35 dark:ring-1 dark:ring-amber-500/25",
                  alerta === null &&
                  (tiene
                    ? "border-primary/50 bg-primary/10 font-medium text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/60")
                )}
              >
                <span className="leading-none opacity-80">{d.dia}</span>
                {tiene ? (
                  <>
                    <span className="text-xs font-semibold tabular-nums leading-none">
                      {d.total}
                    </span>
                    <span
                      className="text-[8px] leading-none text-muted-foreground tabular-nums"
                      aria-hidden
                    >
                      {d.con}+{d.sin}
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-medium leading-none">·</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-b-xl border-t border-border bg-muted/25 px-3 py-3 sm:px-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Disponible en el mes
        </p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3 lg:grid-cols-4 min-[1200px]:grid-cols-7">
          <div>
            <dt className="text-muted-foreground">Stock ref.</dt>
            <dd className="font-semibold tabular-nums">{med.stock_recomendado}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Crítico</dt>
            <dd className="font-semibold tabular-nums">{med.stock_critico}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cierre mes ant.</dt>
            <dd className="font-semibold tabular-nums">{med.cierre_mes_anterior}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ingreso mes</dt>
            <dd className="font-semibold tabular-nums">{med.ingreso_mes}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Descuento mes</dt>
            <dd className="font-semibold tabular-nums">{med.descuento_acumulado_mes}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Stock en AVIS</dt>
            <dd className="font-semibold tabular-nums text-sky-900 dark:text-sky-100">
              {med.stock_declarado_avis}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1 lg:col-span-2 min-[1200px]:col-span-1">
            <dt className="text-muted-foreground">Disponible</dt>
            <dd className={cn("text-sm font-bold tabular-nums", dispClass)}>
              {med.disponible}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export function ConsumoMensualPanel({
  postaId,
  basePath,
  anio,
  mes,
  puedeRegistrar,
  soloLecturaDescuentoVariante,
  medicamentos,
}: {
  postaId: string;
  basePath: string;
  anio: number;
  mes: number;
  puedeRegistrar: boolean;
  /** Si no se puede registrar: tono del aviso en el modal del día. */
  soloLecturaDescuentoVariante?: "admin" | "resto";
  medicamentos: ConsumoMensualMedPayload[];
}) {
  const [abierta, setAbierta] = useState<CeldaAbierta | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const prev = mesAnterior(anio, mes);
  const next = mesSiguiente(anio, mes);
  const ymActual = ymParam(anio, mes);

  const query = useMemo(() => normalizaBusqueda(busqueda), [busqueda]);

  const medicamentosFiltrados = useMemo(
    () => medicamentos.filter((m) => medCoincideBusqueda(m, query)),
    [medicamentos, query]
  );

  /** Top 5 por suma de descuentos del mes (con+sin AVIS por día). */
  const topDescuentoMes = useMemo(() => {
    const conTotal = medicamentos.map((m) => ({
      med: m,
      total: m.dias.reduce((acc, d) => acc + d.total, 0),
    }));
    conTotal.sort((a, b) => b.total - a.total);
    return conTotal.filter((x) => x.total > 0).slice(0, 10);
  }, [medicamentos]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/15 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <label htmlFor="descuento-ym" className="text-xs font-medium text-foreground">
              Mes a trabajar
            </label>
            <input
              id="descuento-ym"
              name="ym"
              type="month"
              min="2020-01"
              max="2100-12"
              defaultValue={ymActual}
              className={cn(
                "flex h-8 rounded-lg border border-input bg-transparent px-2 py-1 text-sm outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              )}
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Ver mes
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${basePath}?ym=${ymParam(prev.anio, prev.mes)}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            ← Mes anterior
          </Link>
          <Link
            href={`${basePath}?ym=${ymParam(next.anio, next.mes)}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Mes siguiente →
          </Link>
        </div>
      </div>

      <p
        className="text-center font-heading text-lg font-semibold capitalize leading-tight tracking-tight text-foreground sm:text-xl md:text-2xl"
        aria-live="polite"
      >
        {tituloMes(anio, mes)}
      </p>

      {medicamentos.length > 0 ? (
        <div className="space-y-2">
          <div className="mx-auto max-w-xl space-y-1.5">
            <Label htmlFor="descuento-buscar-med" className="text-xs font-medium">
              Buscar medicamento
            </Label>
            <Input
              id="descuento-buscar-med"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Nombre o código interno"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      ) : null}

      {topDescuentoMes.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Los 10 más descontados del mes
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Sugerencias según el total de los mas descontados.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {topDescuentoMes.map(({ med, total }) => (
              <button
                key={med.id}
                type="button"
                title={`${total} ${med.unidad_medida} descontados en el mes`}
                className="rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                onClick={() => setBusqueda(med.nombre)}
              >
                <span className="font-medium">{med.nombre}</span>
                <span className="ml-1 tabular-nums text-muted-foreground">({total})</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {medicamentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay medicamentos activos en el catálogo.
        </p>
      ) : medicamentosFiltrados.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin resultados para la búsqueda.
        </p>
      ) : (
        <div className="space-y-8">
          {MEDICAMENTO_CATEGORIAS.map((cat) => {
            const lista = medicamentosFiltrados.filter((m) => m.categoria === cat);
            if (lista.length === 0) return null;
            return (
              <section key={cat} className="space-y-3">
                <h3 className="border-b border-border pb-1.5 text-sm font-semibold tracking-wide text-foreground">
                  {etiquetaMedicamentoCategoria[cat]}
                </h3>
                <div className="space-y-6">
                  {lista.map((m) => (
                    <MedicamentoMesCard key={m.id} med={m} onOpen={setAbierta} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {abierta ? (
        <ConsumoDiaModal
          key={`${abierta.med.id}-${abierta.celda.fechaISO}`}
          postaId={postaId}
          medicamentoId={abierta.med.id}
          puedeRegistrar={puedeRegistrar}
          soloLecturaDescuentoVariante={soloLecturaDescuentoVariante}
          medNombre={abierta.med.nombre}
          medCodigo={abierta.med.codigo_interno}
          unidad={abierta.med.unidad_medida}
          fechaISO={abierta.celda.fechaISO}
          dia={abierta.celda.dia}
          initialCon={abierta.celda.con}
          initialSin={abierta.celda.sin}
          initialObservacion={abierta.celda.observacion}
          stockRecomendado={abierta.med.stock_recomendado}
          disponibleMes={abierta.med.disponible}
          stockCritico={abierta.med.stock_critico}
          onClose={() => setAbierta(null)}
        />
      ) : null}
    </div>
  );
}
