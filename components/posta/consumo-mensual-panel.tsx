"use client";

import { Package } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  CategoriaGrupoCabeceraContenido,
  CategoriasColapsarTodasBar,
  useCategoriasColapsables,
} from "@/components/medicamentos/categoria-grupo-colapsable";
import { ConsumoDiaModal } from "@/components/posta/consumo-dia-modal";
import { DescuentoOfflineBar } from "@/components/posta/descuento-offline-bar";
import { StockNivelLeyenda } from "@/components/posta/stock-nivel-leyenda";
import { PostaMesToolbar, tituloMesChile } from "@/components/posta/posta-mes-toolbar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATEGORIAS_AGRUPACION_UI,
  categoriaAgrupacionListado,
  etiquetaMedicamentoCategoria,
  type MedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import { getLocalMovementsByPostaMonth } from "@/lib/offline/db";
import { mergePendingIntoMedicamentos } from "@/lib/offline/merge-pending-descuento";
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
  syncPendiente?: boolean;
  syncError?: boolean;
  syncErrorMessage?: string;
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
                  "relative flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1.5 text-[11px] transition-colors sm:min-h-[3.25rem] sm:min-w-[2.85rem] sm:text-[10px]",
                  d.syncPendiente && "ring-2 ring-amber-500 ring-offset-1",
                  d.syncError && "ring-2 ring-destructive ring-offset-1",
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
                {d.syncPendiente ? (
                  <span className="absolute -right-0.5 -top-0.5 rounded bg-amber-500 px-0.5 text-[7px] font-bold text-white">
                    P
                  </span>
                ) : d.syncError ? (
                  <span className="absolute -right-0.5 -top-0.5 rounded bg-destructive px-0.5 text-[7px] font-bold text-white">
                    !
                  </span>
                ) : null}
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
  const [offlineRefresh, setOfflineRefresh] = useState(0);
  const [mergedMeds, setMergedMeds] =
    useState<ConsumoMensualMedPayload[]>(medicamentos);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const local = await getLocalMovementsByPostaMonth(postaId, anio, mes);
      if (!cancelled) {
        setMergedMeds(mergePendingIntoMedicamentos(medicamentos, local));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [medicamentos, postaId, anio, mes, offlineRefresh]);
  const query = useMemo(() => normalizaBusqueda(busqueda), [busqueda]);

  const medicamentosFiltrados = useMemo(
    () => mergedMeds.filter((m) => medCoincideBusqueda(m, query)),
    [mergedMeds, query]
  );

  const colapsables = useCategoriasColapsables();
  const forzarExpandidas = query.length > 0;
  const categoriasVisibles = useMemo(
    () =>
      CATEGORIAS_AGRUPACION_UI.filter((cat) =>
        medicamentosFiltrados.some((m) => categoriaAgrupacionListado(m.categoria) === cat)
      ),
    [medicamentosFiltrados]
  );

  /** Top 5 por suma de descuentos del mes (con+sin AVIS por día). */
  const topDescuentoMes = useMemo(() => {
    const conTotal = mergedMeds.map((m) => ({
      med: m,
      total: m.dias.reduce((acc, d) => acc + d.total, 0),
    }));
    conTotal.sort((a, b) => b.total - a.total);
    return conTotal.filter((x) => x.total > 0).slice(0, 10);
  }, [mergedMeds]);

  return (
    <div className="space-y-4">
      {puedeRegistrar ? (
        <DescuentoOfflineBar postaId={postaId} refreshToken={offlineRefresh} />
      ) : null}
      <PostaMesToolbar basePath={basePath} anio={anio} mes={mes} />

      <p
        className="text-center font-heading text-lg font-semibold capitalize leading-tight tracking-tight text-foreground sm:text-xl md:text-2xl"
        aria-live="polite"
      >
        {tituloMesChile(anio, mes)}
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
            Sugerencias según el total de los más descontados.
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

      <StockNivelLeyenda className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2" />

      {mergedMeds.length > 0 && medicamentosFiltrados.length > 0 ? (
        <CategoriasColapsarTodasBar
          categorias={categoriasVisibles}
          onExpandirTodas={colapsables.expandirTodas}
          onColapsarTodas={colapsables.colapsarTodas}
        />
      ) : null}

      {mergedMeds.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted/5">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground/70 mb-4 border border-border/40">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-7"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground">Catálogo vacío</h3>
          <p className="text-xs text-muted-foreground/80 mt-1 max-w-[280px]">
            No hay medicamentos o insumos activos registrados en el catálogo de esta posta.
          </p>
        </div>
      ) : medicamentosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted/5 animate-fade-in">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/5 text-primary/70 mb-4 border border-primary/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-7 text-primary/60"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
              <path d="M8 11h6" />
            </svg>
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground">Sin resultados</h3>
          <p className="text-xs text-muted-foreground/80 mt-1 max-w-[280px]">
            No encontramos coincidencias para &ldquo;<span className="font-medium text-foreground">{busqueda}</span>&rdquo;. Intente con otro término.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORIAS_AGRUPACION_UI.map((cat) => {
            const lista = medicamentosFiltrados.filter(
              (m) => categoriaAgrupacionListado(m.categoria) === cat
            );
            if (lista.length === 0) return null;
            const expandida = colapsables.estaExpandida(cat, forzarExpandidas);
            return (
              <section key={cat} className="space-y-3">
                <div className="rounded-md border border-border/60 bg-muted/70 px-2 py-1">
                  <CategoriaGrupoCabeceraContenido
                    etiqueta={etiquetaMedicamentoCategoria[cat]}
                    expandida={expandida}
                    onToggle={() => colapsables.toggle(cat)}
                    cantidad={lista.length}
                    className="px-1 py-1.5"
                  />
                </div>
                {expandida ? (
                <div className="space-y-6">
                  {lista.map((m) => (
                    <MedicamentoMesCard key={m.id} med={m} onOpen={setAbierta} />
                  ))}
                </div>
                ) : null}
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
          onLocalSaved={() => setOfflineRefresh((n) => n + 1)}
        />
      ) : null}
    </div>
  );
}
