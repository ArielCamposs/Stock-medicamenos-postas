"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useActionState, useEffect, useMemo, useRef, useState } from "react";

import {
  pedidoMensualSubmitAction,
  type PedidoMensualActionState,
} from "@/app/actions/pedido-mensual";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/providers/toast-provider";
import {
  CategoriaGrupoCabeceraContenido,
  CategoriasColapsarTodasBar,
  useCategoriasColapsables,
} from "@/components/medicamentos/categoria-grupo-colapsable";
import { PedidoEstadoBadge } from "@/components/posta/pedido-estado-badge";
import { StockNivelFiltroBar } from "@/components/posta/stock-nivel-filtro-bar";
import {
  CATEGORIAS_AGRUPACION_UI,
  categoriaAgrupacionListado,
  etiquetaMedicamentoCategoria,
  type MedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import type { TipoPedido } from "@/app/actions/pedido-mensual";
import {
  lineaCoincideFiltroStock,
  nivelAlertaStock,
  type NivelStockFiltro,
} from "@/lib/posta/admin-stock-alerta-postas";
import { cn } from "@/lib/utils";

export type PedidoMensualLineaCliente = {
  medicamentoId: string;
  nombre: string;
  codigo_interno: string;
  unidad_medida: string;
  categoria: MedicamentoCategoria;
  stock_recomendado: number;
  stock_critico: number;
  disponible: number;
  cantidad_sugerida: number;
  cantidad_final: number;
};

type LineaResumenEnvio = PedidoMensualLineaCliente & { cantidadPedido: number };

type Props = {
  postaId: string;
  anio: number;
  mes: number;
  mesTitulo: string;
  postaNombre: string | null;
  postaCodigo: string | null;
  ymQuery: string;
  tipoPedido: TipoPedido;
  pedidoId: string | null;
  estado:
    | "BORRADOR"
    | "ENVIADO"
    | "OBSERVADO"
    | "RECHAZADO"
    | "APROBADO"
    | "DESPACHADO"
    | "RECIBIDO"
    | null;
  /** Texto ya formateado en el servidor (evita hydration mismatch con `toLocaleString` en el cliente). */
  enviadoEtiqueta: string | null;
  pedidoEnviadoHoy: boolean;
  pedidoEnProceso: boolean;
  puedeEditar: boolean;
  comentarioPosta: string | null;
  lineas: PedidoMensualLineaCliente[];
};

function leerCantidadInput(raw: string | null, fallback: number): number {
  const t = (raw ?? "").trim();
  if (t === "") return fallback;
  const n = Number.parseInt(t, 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return n;
}

function resumenDesdeFormulario(
  form: HTMLFormElement,
  lineas: PedidoMensualLineaCliente[]
): LineaResumenEnvio[] {
  const fd = new FormData(form);
  return lineas.map((l) => ({
    ...l,
    cantidadPedido: leerCantidadInput(
      fd.get(`final_${l.medicamentoId}`)?.toString() ?? null,
      l.cantidad_final
    ),
  }));
}

function armarResumenEnvio(lineas: LineaResumenEnvio[]) {
  const conPedido = lineas.filter((l) => l.cantidadPedido > 0);
  const totalUnidades = conPedido.reduce((acc, l) => acc + l.cantidadPedido, 0);
  return { conPedido, totalUnidades, nMedicamentos: conPedido.length };
}

function normalizaBusqueda(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function lineaCoincideBusqueda(m: PedidoMensualLineaCliente, q: string) {
  if (!q) return true;
  const nombre = m.nombre.toLowerCase();
  const ci = m.codigo_interno.toLowerCase();
  return nombre.includes(q) || ci.includes(q);
}

function lineaVisibleEnListado(
  m: PedidoMensualLineaCliente,
  queryBusqueda: string,
  filtroStock: NivelStockFiltro | null
) {
  return (
    lineaCoincideBusqueda(m, queryBusqueda) &&
    lineaCoincideFiltroStock(
      m.disponible,
      m.stock_critico,
      m.stock_recomendado,
      filtroStock
    )
  );
}

function textoCondicionesFiltroPedido(
  busqueda: string,
  filtroStock: NivelStockFiltro | null
): string {
  const partes: string[] = [];
  const q = busqueda.trim();
  if (q) partes.push(`la búsqueda «${q}»`);
  if (filtroStock === "holgado") partes.push("stock holgado");
  if (filtroStock === "cerca") partes.push("cerca del crítico");
  if (filtroStock === "critico") partes.push("crítico o bajo");
  if (partes.length === 0) return "los filtros aplicados";
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

function PedidoListadoSinResultadosFiltro({
  condiciones,
  onLimpiarFiltros,
}: {
  condiciones: string;
  onLimpiarFiltros: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <p className="text-sm font-semibold text-foreground">
        No hay medicamentos con estas condiciones
      </p>
      <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
        No encontramos ningún medicamento que coincida con {condiciones}. Puedes quitar los
        filtros, elegir otro nivel de stock o buscar con otro término.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onLimpiarFiltros}>
        Quitar filtros
      </Button>
    </div>
  );
}

/** Campo editable de cantidad a pedir: fondo blanco fijo para destacar sobre la fila coloreada. */
function claseInputCantidadPedido(tamano: "tabla" | "mobile") {
  return cn(
    "rounded-md border border-primary/50 bg-white px-2 text-right font-semibold tabular-nums text-foreground shadow-sm ring-1 ring-primary/20 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-primary/40 dark:bg-white dark:text-zinc-900",
    tamano === "tabla" ? "h-8 w-20 text-sm" : "h-9 w-24 text-sm"
  );
}

function clasesFilaStock(
  disponible: number,
  stock_critico: number,
  stock_recomendado: number
) {
  const nivel = nivelAlertaStock(disponible, stock_critico, stock_recomendado);
  if (nivel === "critico") {
    return {
      filaClass:
        "bg-destructive/10 dark:bg-destructive/15 border-l-4 border-l-destructive",
      claseDisponible: "text-destructive",
    };
  }
  if (nivel === "cerca") {
    return {
      filaClass:
        "bg-amber-400/14 dark:bg-amber-500/12 border-l-4 border-l-amber-500",
      claseDisponible: "text-amber-950 dark:text-amber-100",
    };
  }
  return {
    filaClass:
      "bg-emerald-500/10 dark:bg-emerald-500/10 border-l-4 border-l-emerald-500",
    claseDisponible: "text-emerald-900 dark:text-emerald-100",
  };
}

function PedidoLineaMobileCard({
  m,
  soloLectura,
  tooltipTexto,
}: {
  m: PedidoMensualLineaCliente;
  soloLectura: boolean;
  tooltipTexto: string;
}) {
  const { filaClass, claseDisponible } = clasesFilaStock(
    m.disponible,
    m.stock_critico,
    m.stock_recomendado
  );
  return (
    <div className={cn("rounded-lg border border-border p-3", filaClass)}>
      <p className="font-medium leading-snug">{m.nombre}</p>
      <p className="font-mono text-[11px] text-muted-foreground">{m.codigo_interno}</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Disponible</dt>
          <dd className={cn("font-semibold tabular-nums", claseDisponible)}>{m.disponible}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sugerida</dt>
          <dd className="font-semibold tabular-nums">{m.cantidad_sugerida}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Stock ref.</dt>
          <dd className="tabular-nums">{m.stock_recomendado}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Crítico</dt>
          <dd className="tabular-nums">{m.stock_critico}</dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Pedido</span>
        {soloLectura ? (
          <span 
            className="text-lg font-semibold tabular-nums cursor-not-allowed text-muted-foreground/80 flex items-center gap-1"
            title={tooltipTexto}
          >
            {m.cantidad_final}
            <span className="text-xs select-none">🔒</span>
          </span>
        ) : (
          <input
            name={`final_${m.medicamentoId}`}
            type="number"
            min={0}
            step={1}
            defaultValue={m.cantidad_final}
            className={claseInputCantidadPedido("mobile")}
            aria-label={`Cantidad a pedir de ${m.nombre}`}
          />
        )}
      </div>
    </div>
  );
}

export function PedidoMensualPanel({
  postaId,
  anio,
  mes,
  mesTitulo,
  postaNombre,
  postaCodigo,
  ymQuery,
  tipoPedido,
  pedidoId,
  estado,
  enviadoEtiqueta,
  pedidoEnviadoHoy,
  pedidoEnProceso,
  puedeEditar,
  comentarioPosta,
  lineas,
}: Props) {
  const router = useRouter();
  const esFormularioNuevo = estado === null;
  const esEditableEstado = estado === "BORRADOR" || estado === "OBSERVADO";
  const tooltipTexto = !puedeEditar
    ? "No se puede editar: el periodo mensual está cerrado o no tienes permisos."
    : pedidoEnProceso
      ? "No se puede editar: hay un pedido en trámite con administración."
      : pedidoEnviadoHoy
        ? "No se puede editar: ya enviaste un pedido de este tipo hoy."
        : !esFormularioNuevo && !esEditableEstado
          ? "No se puede editar: el pedido ya fue enviado."
          : "No se puede editar.";
  const formRef = useRef<HTMLFormElement>(null);
  const submitEnviarRef = useRef<HTMLButtonElement>(null);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroStock, setFiltroStock] = useState<NivelStockFiltro | null>(null);
  const queryBusqueda = useMemo(() => normalizaBusqueda(busqueda), [busqueda]);
  const hayFiltroListado = queryBusqueda.length > 0 || filtroStock !== null;
  const nCoincidenciasVisibles = useMemo(
    () => lineas.filter((l) => lineaVisibleEnListado(l, queryBusqueda, filtroStock)).length,
    [lineas, queryBusqueda, filtroStock]
  );
  const colapsables = useCategoriasColapsables();
  const forzarExpandidas = hayFiltroListado;
  const categoriasVisibles = useMemo(
    () =>
      CATEGORIAS_AGRUPACION_UI.filter((cat) =>
        lineas.some((l) => categoriaAgrupacionListado(l.categoria) === cat)
      ),
    [lineas]
  );
  const [resumenEnvio, setResumenEnvio] = useState<{
    conPedido: LineaResumenEnvio[];
    totalUnidades: number;
    nMedicamentos: number;
  } | null>(null);

  const bound = pedidoMensualSubmitAction.bind(null, postaId);
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(
    bound as (s: PedidoMensualActionState, fd: FormData) => Promise<PedidoMensualActionState>,
    {}
  );

  useEffect(() => {
    if (state.ok) {
      setConfirmarAbierto(false);
      router.refresh();
    }
  }, [state.ok, router]);

  useEffect(() => {
    if (state.success) toast(state.success, "success");
    if (state.error) toast(state.error, "error");
  }, [state.success, state.error, toast]);

  const soloLectura =
    !puedeEditar ||
    pedidoEnProceso ||
    pedidoEnviadoHoy ||
    (!esFormularioNuevo && !esEditableEstado);
  const puedePdf = Boolean(pedidoId) && estado !== "BORRADOR" && estado !== null;
  const esReenvioObservado = estado === "OBSERVADO";
  const despachado = estado === "DESPACHADO";

  function abrirConfirmacionEnvio() {
    const form = formRef.current;
    if (!form) return;
    const lineasForm = resumenDesdeFormulario(form, lineas);
    const resumenNuevo = armarResumenEnvio(lineasForm);
    if (resumenNuevo.nMedicamentos === 0) {
      toast(
        "Debes pedir al menos un medicamento con cantidad mayor que 0 antes de enviar.",
        "error"
      );
      return;
    }
    setResumenEnvio(resumenNuevo);
    setConfirmarAbierto(true);
  }

  function confirmarEnvio() {
    submitEnviarRef.current?.click();
  }

  const resumen = resumenEnvio;
  const pedidoVacio = resumen !== null && resumen.nMedicamentos === 0;
  const sinResultadosFiltro = hayFiltroListado && nCoincidenciasVisibles === 0;
  const condicionesFiltroTexto = textoCondicionesFiltroPedido(busqueda, filtroStock);

  function limpiarFiltrosListado() {
    setBusqueda("");
    setFiltroStock(null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b bg-muted/40">
          <CardTitle className="text-lg">Líneas y stock</CardTitle>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {estado ? (
              <>
                <PedidoEstadoBadge estado={estado} />
                {enviadoEtiqueta ? (
                  <span className="text-xs text-muted-foreground">
                    Enviado: {enviadoEtiqueta}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                Nuevo pedido para este mes. Puedes enviar uno por día calendario de este tipo.
              </span>
            )}
          </div>
          <StockNivelFiltroBar
            className="mt-3"
            value={filtroStock}
            onChange={setFiltroStock}
          />
        </CardHeader>
        <CardContent className="pt-4">
          {pedidoEnProceso ? (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300">
              <div className="flex items-start gap-2.5">
                <span className="text-lg leading-none">⚠️</span>
                <div>
                  <h4 className="font-semibold leading-none">
                    Pedido {tipoPedido === "CONTRA_RECETA" ? "contra receta" : "general"} en trámite
                  </h4>
                  <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                    Este pedido está en estado{" "}
                    <span className="font-bold uppercase">{estado}</span>. Cuando administración lo cierre
                    (recibido o rechazado), podrás enviar otro si lo necesitas.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {pedidoEnviadoHoy && !pedidoEnProceso && puedeEditar ? (
            <div className="mb-4 rounded-md border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:border-amber-600/30 dark:bg-amber-950/20 dark:text-amber-100">
              Ya enviaste un pedido {tipoPedido === "CONTRA_RECETA" ? "contra receta" : "general"} hoy. Puedes
              enviar otro <strong>mañana</strong> (un envío por día calendario de cada tipo).
            </div>
          ) : null}

          {estado === "RECHAZADO" && !pedidoEnviadoHoy && !pedidoEnProceso && puedeEditar ? (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              El pedido anterior fue rechazado. Cuando puedas (un envío por día), completa el formulario y
              envía uno nuevo.
            </div>
          ) : null}

          {estado === "RECIBIDO" && !pedidoEnviadoHoy && !pedidoEnProceso && puedeEditar ? (
            <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-600/30 dark:bg-emerald-950/20 dark:text-emerald-100">
              El último pedido fue recibido. Puedes enviar un pedido extra cuando lo necesites; las cantidades
              se calculan según tu stock actual.
            </div>
          ) : null}

          {despachado ? (
            <div className="mb-4 rounded-md border border-violet-500/40 bg-violet-50 px-4 py-3 text-sm text-violet-950 dark:border-violet-600/30 dark:bg-violet-950/25 dark:text-violet-100">
              <p className="font-medium mb-1">Pedido despachado por bodega</p>
              <p className="text-violet-900/90 dark:text-violet-100/90">
                Registra lo recibido en{" "}
                <Link
                  href={`/postas/${postaId}/ingresos?ym=${ymQuery}`}
                  className="font-medium underline"
                >
                  Entradas de stock
                </Link>
                , igual que con el pedido general. Si hay más de un despacho en el mes, ingresa primero el
                que llegó antes.
              </p>
            </div>
          ) : null}

          {state.error ? (
            <p
              className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p
              className="mb-3 rounded-md border border-emerald-600/35 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-950 dark:text-emerald-50"
              role="status"
            >
              {state.success}
            </p>
          ) : null}

          {lineas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay medicamentos activos en el catálogo.</p>
          ) : (
            <form ref={formRef} action={formAction} className="space-y-4">
              <input type="hidden" name="anio" value={anio} />
              <input type="hidden" name="mes" value={mes} />
              <input type="hidden" name="tipo_pedido" value={tipoPedido} />
              <input
                type="hidden"
                name="medicamento_ids_json"
                value={JSON.stringify(lineas.map((l) => l.medicamentoId))}
              />

              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1 space-y-1.5" style={{ minWidth: "14rem" }}>
                  <Label htmlFor={`ped-buscar-${tipoPedido}`} className="text-xs font-medium">
                    Buscar medicamento
                  </Label>
                  <Input
                    id={`ped-buscar-${tipoPedido}`}
                    type="search"
                    autoComplete="off"
                    placeholder="Nombre o código interno…"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    disabled={soloLectura}
                  />
                </div>
              </div>

              {hayFiltroListado && nCoincidenciasVisibles > 0 ? (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground tabular-nums">
                    {nCoincidenciasVisibles}
                  </span>{" "}
                  de {lineas.length}{" "}
                  {lineas.length === 1 ? "medicamento" : "medicamentos"}
                  {filtroStock && queryBusqueda ? " (búsqueda y stock)" : null}
                </p>
              ) : null}

              <CategoriasColapsarTodasBar
                categorias={categoriasVisibles}
                onExpandirTodas={colapsables.expandirTodas}
                onColapsarTodas={colapsables.colapsarTodas}
                className="px-0.5"
              />

              <div className="space-y-4 md:hidden">
                {sinResultadosFiltro ? (
                  <div className="rounded-lg border border-border bg-muted/15">
                    <PedidoListadoSinResultadosFiltro
                      condiciones={condicionesFiltroTexto}
                      onLimpiarFiltros={limpiarFiltrosListado}
                    />
                  </div>
                ) : null}
                {!sinResultadosFiltro
                  ? CATEGORIAS_AGRUPACION_UI.map((cat) => {
                  const lineasCat = lineas.filter(
                    (l) => categoriaAgrupacionListado(l.categoria) === cat
                  );
                  const lineasCatVisibles = lineasCat.filter((l) =>
                    lineaVisibleEnListado(l, queryBusqueda, filtroStock)
                  );
                  if (lineasCatVisibles.length === 0) return null;
                  const expandida = colapsables.estaExpandida(cat, forzarExpandidas);
                  return (
                    <section key={`m-${cat}`} className="space-y-2">
                      <div className="rounded-md border border-border/60 bg-muted/70 px-2 py-1">
                        <CategoriaGrupoCabeceraContenido
                          etiqueta={etiquetaMedicamentoCategoria[cat]}
                          expandida={expandida}
                          onToggle={() => colapsables.toggle(cat)}
                          cantidad={lineasCatVisibles.length}
                          className="px-1 py-1.5"
                        />
                      </div>
                      {expandida ? (
                      <div className="space-y-2">
                        {lineasCat.map((m) => (
                          <div
                            key={m.medicamentoId}
                            className={cn(
                              !lineaVisibleEnListado(m, queryBusqueda, filtroStock) && "hidden"
                            )}
                            aria-hidden={
                              !lineaVisibleEnListado(m, queryBusqueda, filtroStock)
                            }
                          >
                            <PedidoLineaMobileCard
                              m={m}
                              soloLectura={soloLectura}
                              tooltipTexto={tooltipTexto}
                            />
                          </div>
                        ))}
                      </div>
                      ) : null}
                    </section>
                  );
                  })
                  : null}
              </div>

              <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
                <table className="w-full min-w-[52rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/80 text-left text-xs font-medium text-muted-foreground">
                      <th className="sticky left-0 z-10 min-w-[10rem] bg-muted/95 px-2 py-2 backdrop-blur">
                        Medicamento
                      </th>
                      <th className="px-2 py-2">Unidad</th>
                      <th className="px-2 py-2 text-right">Stock ref.</th>
                      <th className="px-2 py-2 text-right">Crítico</th>
                      <th className="px-2 py-2 text-right">Disponible</th>
                      <th className="px-2 py-2 text-right">Sugerida</th>
                      <th className="px-2 py-2 text-right">Pedido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sinResultadosFiltro ? (
                      <tr>
                        <td colSpan={7} className="bg-muted/10">
                          <PedidoListadoSinResultadosFiltro
                            condiciones={condicionesFiltroTexto}
                            onLimpiarFiltros={limpiarFiltrosListado}
                          />
                        </td>
                      </tr>
                    ) : null}
                    {!sinResultadosFiltro
                      ? (() => {
                      return CATEGORIAS_AGRUPACION_UI.map((cat) => {
                        const lineasCat = lineas.filter(
                          (l) =>
                            categoriaAgrupacionListado(l.categoria) === cat &&
                            lineaVisibleEnListado(l, queryBusqueda, filtroStock)
                        );
                        if (lineasCat.length === 0) return null;
                        const expandida = colapsables.estaExpandida(cat, forzarExpandidas);
                        return (
                          <Fragment key={cat}>
                            <tr className="border-y-2 border-border/60 bg-muted/60">
                              <td colSpan={7} className="px-2 py-1">
                                <CategoriaGrupoCabeceraContenido
                                  etiqueta={etiquetaMedicamentoCategoria[cat]}
                                  expandida={expandida}
                                  onToggle={() => colapsables.toggle(cat)}
                                  cantidad={lineasCat.length}
                                  className="px-1 py-1.5"
                                />
                              </td>
                            </tr>
                            {expandida
                              ? lineas
                              .filter((l) => categoriaAgrupacionListado(l.categoria) === cat)
                              .map((m) => {
                              const visible = lineaVisibleEnListado(
                                m,
                                queryBusqueda,
                                filtroStock
                              );
                              const { filaClass, claseDisponible } = clasesFilaStock(
                                m.disponible,
                                m.stock_critico,
                                m.stock_recomendado
                              );
                              return (
                                <tr
                                  key={m.medicamentoId}
                                  className={cn(
                                    "border-b border-border/70",
                                    filaClass,
                                    !visible && "hidden"
                                  )}
                                  aria-hidden={!visible}
                                >
                                  <td className="sticky left-0 z-[1] min-w-[10rem] bg-inherit px-2 py-1.5 align-middle shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                                    <div className="flex min-w-0 flex-col gap-0.5">
                                      <span className="font-medium leading-snug">
                                        {m.nombre}
                                      </span>
                                      <span className="font-mono text-[11px] text-muted-foreground">
                                        {m.codigo_interno}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-2 py-1.5 text-muted-foreground">
                                    {m.unidad_medida}
                                  </td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">
                                    {m.stock_recomendado}
                                  </td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">
                                    {m.stock_critico}
                                  </td>
                                  <td
                                    className={cn(
                                      "px-2 py-1.5 text-right font-medium tabular-nums",
                                      claseDisponible
                                    )}
                                  >
                                    {m.disponible}
                                  </td>
                                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                    {m.cantidad_sugerida}
                                  </td>
                                  <td className="px-2 py-1.5 text-right">
                                    {soloLectura ? (
                                      <span 
                                        className="font-medium tabular-nums cursor-not-allowed text-muted-foreground/80 inline-flex items-center gap-1"
                                        title={tooltipTexto}
                                      >
                                        {m.cantidad_final}
                                        <span className="text-[10px] select-none">🔒</span>
                                      </span>
                                    ) : (
                                      <input
                                        name={`final_${m.medicamentoId}`}
                                        type="number"
                                        min={0}
                                        step={1}
                                        defaultValue={m.cantidad_final}
                                        className={claseInputCantidadPedido("tabla")}
                                        aria-label={`Cantidad a pedir de ${m.nombre}`}
                                      />
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                              : null}
                          </Fragment>
                        );
                      });
                    })()
                      : null}
                  </tbody>
                </table>
              </div>

              {!soloLectura ? (
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    disabled={pending || pedidoEnviadoHoy || pedidoEnProceso}
                    onClick={abrirConfirmacionEnvio}
                  >
                    {pending ? "Enviando…" : "Confirmar y enviar"}
                  </Button>
                  <button
                    ref={submitEnviarRef}
                    type="submit"
                    name="_intent"
                    value="enviar"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                  >
                    Enviar
                  </button>
                </div>
              ) : puedePdf ? (
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`/api/pedidos/${pedidoId}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "secondary" }), "inline-flex h-9 items-center")}
                  >
                    Descargar PDF
                  </a>
                </div>
              ) : null}
            </form>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmarAbierto} onOpenChange={setConfirmarAbierto}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {esReenvioObservado ? "Reenviar pedido corregido" : "Enviar pedido a administración"}
            </DialogTitle>
            <DialogDescription>
              Revisa el resumen del pedido antes de confirmar el envío.
            </DialogDescription>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <span className="font-medium capitalize text-foreground">{mesTitulo}</span>
                  {postaNombre ? (
                    <>
                      {" "}
                      · <span className="text-foreground">{postaNombre}</span>
                      {postaCodigo ? (
                        <span className="font-mono text-xs"> ({postaCodigo})</span>
                      ) : null}
                    </>
                  ) : null}
              </div>
              {resumen ? (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-foreground">
                    <>
                      Vas a pedir{" "}
                      <strong className="tabular-nums">
                        {resumen.totalUnidades.toLocaleString("es-CL")}
                      </strong>{" "}
                      unidades en{" "}
                      <strong className="tabular-nums">{resumen.nMedicamentos}</strong>{" "}
                      {resumen.nMedicamentos === 1 ? "medicamento" : "medicamentos"}.
                    </>
                </div>
              ) : null}
                {resumen && resumen.conPedido.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                    <ul className="divide-y divide-border text-xs">
                      {resumen.conPedido.map((l) => (
                        <li
                          key={l.medicamentoId}
                          className="flex items-baseline justify-between gap-3 px-3 py-2"
                        >
                          <span className="min-w-0 truncate text-foreground">{l.nombre}</span>
                          <span className="shrink-0 tabular-nums font-medium text-foreground">
                            {l.cantidadPedido} {l.unidad_medida}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              <p className="text-xs">
                {esReenvioObservado
                  ? "Al reenviar, administración verá las cantidades actualizadas. No podrás editarlas acá hasta que vuelvan a observar el pedido."
                  : "Después del envío no podrás cambiar las cantidades desde esta pantalla. Revisa bien antes de confirmar."}
              </p>
            </div>
          </DialogHeader>
          <DialogFooter className="border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmarAbierto(false)}
            >
              Volver a revisar
            </Button>
            <Button
              type="button"
              disabled={pending || pedidoVacio}
              onClick={confirmarEnvio}
            >
              {pending
                ? "Enviando…"
                : esReenvioObservado
                  ? "Reenviar pedido"
                  : "Enviar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/postas/${postaId}/descuento?ym=${ymQuery}`}
          className={cn(buttonVariants({ variant: "default" }), "w-fit")}
        >
          {puedeEditar ? "Ir a descuento" : "Ver descuento"}
        </Link>
        <Link
          href={`/postas/${postaId}/ingresos?ym=${ymQuery}`}
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
        >
          {puedeEditar ? "Ir a ingresos" : "Ver ingresos"}
        </Link>
      </div>
    </div>
  );
}
