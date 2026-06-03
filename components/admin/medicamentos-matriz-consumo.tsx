"use client";

import { Dialog } from "@base-ui/react/dialog";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, Maximize2, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { MedicamentoEditDialog } from "@/components/admin/medicamento-edit-dialog";
import type { MedicamentoRow } from "@/components/admin/medicamento-row-form";
import {
  CategoriaGrupoCabeceraContenido,
  CategoriasColapsarTodasBar,
  useCategoriasColapsables,
} from "@/components/medicamentos/categoria-grupo-colapsable";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATEGORIAS_AGRUPACION_ADMIN,
  CATEGORIAS_CATALOGO_FORMULARIO,
  categoriaAgrupacionAdmin,
  esMedicamentoContraReceta,
  etiquetaMedicamentoCategoria,
  compararMedicamentoPorCategoriaAdminNombre,
  normalizarMedicamentoCategoria,
  type MedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import { nivelStockListadoVisual } from "@/lib/posta/admin-stock-alerta-postas";
import { cn } from "@/lib/utils";

export type PostaColumn = {
  id: string;
  nombre: string;
  codigo: string | null;
};

export type MedicamentoMatrizRow = {
  id: string;
  nombre: string;
  codigoInterno: string;
  codigoAvis: string | null;
  unidadMedida: string;
  categoria: string;
  activo: boolean;
  esContraReceta: boolean;
  updatedAt: string;
  /** Referencia del catálogo (columna Stock) */
  stockRecomendadoDefault: number;
  /** Referencia del catálogo (columna Crít.) */
  stockCriticoDefault: number;
};

function matrizRowToMedicamentoRow(m: MedicamentoMatrizRow): MedicamentoRow {
  return {
    id: m.id,
    nombre: m.nombre,
    codigo_interno: m.codigoInterno,
    codigo_avis: m.codigoAvis,
    unidad_medida: m.unidadMedida,
    categoria: normalizarMedicamentoCategoria(m.categoria),
    stock_recomendado_default: m.stockRecomendadoDefault,
    stock_critico_default: m.stockCriticoDefault,
    activo: m.activo,
    es_contra_receta: m.esContraReceta,
    updated_at: m.updatedAt,
  };
}

type Props = {
  /** Mes del stock mensual mostrado (MM/AAAA) */
  mesStockEtiqueta: string;
  postas: PostaColumn[];
  medicamentos: MedicamentoMatrizRow[];
  /** medicamento_id → posta_id → stock_final del mes en curso */
  stockFinalPorMedYPosta: Map<string, Map<string, number>>;
  puedeEditarFicha: boolean;
};

type MatrizTablaProps = {
  postas: PostaColumn[];
  medicamentosVisibles: MedicamentoMatrizRow[];
  stockFinalPorMedYPosta: Map<string, Map<string, number>>;
  puedeEditarFicha: boolean;
  onEditarMedicamento?: (id: string) => void;
  contenedorClassName?: string;
  estaExpandida: (cat: string) => boolean;
  onToggleCategoria: (cat: string) => void;
};

function normalizaBusqueda(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function medicamentoCoincide(m: MedicamentoMatrizRow, consulta: string) {
  const t = normalizaBusqueda(consulta);
  if (!t) return true;
  const cat = etiquetaMedicamentoCategoria[normalizarMedicamentoCategoria(m.categoria)];
  const cr = esContraRecetaEnMatriz(m) ? "contra receta cr" : "";
  const blob = normalizaBusqueda(
    `${m.nombre} ${m.codigoInterno} ${m.unidadMedida} ${cat} ${cr}`
  );
  return blob.includes(t);
}

function medicamentoPasaFiltroCategoria(
  m: MedicamentoMatrizRow,
  categoriaFiltro: MedicamentoCategoria | ""
) {
  if (!categoriaFiltro) return true;
  return categoriaAgrupacionAdmin(m.categoria) === categoriaFiltro;
}

type FiltroContraReceta = "" | "contra_receta" | "general";

function esContraRecetaEnMatriz(m: MedicamentoMatrizRow): boolean {
  return esMedicamentoContraReceta({
    es_contra_receta: m.esContraReceta,
    categoria: m.categoria,
  });
}

function medicamentoPasaFiltroContraReceta(
  m: MedicamentoMatrizRow,
  filtro: FiltroContraReceta
) {
  if (!filtro) return true;
  const esCr = esContraRecetaEnMatriz(m);
  if (filtro === "contra_receta") return esCr;
  return !esCr;
}

function BadgeMedicamentoContraReceta({ compacto = false }: { compacto?: boolean }) {
  return (
    <Badge
      variant="outline"
      title="Incluido en el pedido mensual contra receta"
      className={cn(
        "shrink-0 gap-0.5 border-amber-600/45 bg-amber-500/15 font-semibold text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-100",
        compacto ? "px-1 py-0 text-[9px] uppercase tracking-wide" : "text-[10px]"
      )}
    >
      <FileText className={cn(compacto ? "size-2.5" : "size-3")} aria-hidden />
      {compacto ? "CR" : "Contra receta"}
    </Badge>
  );
}

function MatrizStockTabla({
  postas,
  medicamentosVisibles,
  stockFinalPorMedYPosta,
  puedeEditarFicha,
  onEditarMedicamento,
  contenedorClassName,
  estaExpandida,
  onToggleCategoria,
}: MatrizTablaProps) {
  const filasOrdenadas = useMemo(
    () =>
      [...medicamentosVisibles].sort((a, b) =>
        compararMedicamentoPorCategoriaAdminNombre(a.categoria, a.nombre, b.categoria, b.nombre)
      ),
    [medicamentosVisibles]
  );

  const grupos = useMemo(() => {
    const g: { cat: (typeof CATEGORIAS_AGRUPACION_ADMIN)[number]; meds: MedicamentoMatrizRow[] }[] =
      [];
    for (const cat of CATEGORIAS_AGRUPACION_ADMIN) {
      const meds = filasOrdenadas.filter(
        (m) => categoriaAgrupacionAdmin(m.categoria) === cat
      );
      if (meds.length > 0) g.push({ cat, meds });
    }
    return g;
  }, [filasOrdenadas]);

  let rowIdx = 0;

  return (
    <div
      className={cn(
        "relative overflow-auto rounded-lg border border-border shadow-sm",
        contenedorClassName ?? "max-h-[min(78vh,920px)]"
      )}
    >
      <table className="w-max min-w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-border">
            <th
              scope="col"
              className={cn(
                "sticky left-0 top-0 z-[45] min-w-[12.5rem] max-w-[16rem] border-r border-border bg-muted px-2 py-2.5 text-left text-xs font-semibold text-foreground shadow-[4px_0_12px_-4px_rgba(0,0,0,0.12)]",
                "dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.45)]"
              )}
            >
              Medicamento
            </th>
            <th
              scope="col"
              title="Stock recomendado del catálogo (referencia al crear el medicamento)."
              className="sticky top-0 z-[44] min-w-[3.25rem] border-r border-emerald-600/25 bg-emerald-600/18 px-1 py-2.5 text-center text-[11px] font-semibold text-emerald-950 dark:bg-emerald-950/45 dark:text-emerald-50"
            >
              Stock
            </th>
            <th
              scope="col"
              title="Stock crítico del catálogo."
              className="sticky top-0 z-[44] min-w-[3.25rem] border-r border-destructive/30 bg-destructive/14 px-1 py-2.5 text-center text-[11px] font-semibold text-destructive dark:bg-destructive/22 dark:text-red-100"
            >
              Crít.
            </th>
            {postas.map((p) => (
              <th
                key={p.id}
                scope="col"
                title={p.codigo ? `${p.nombre} (${p.codigo})` : p.nombre}
                className="sticky top-0 z-[35] min-w-[5rem] max-w-[9rem] border-r border-border bg-muted px-1 py-2 text-center align-bottom text-[11px] font-semibold leading-tight text-foreground"
              >
                <span className="line-clamp-3 hyphens-auto break-words">{p.nombre}</span>
                {p.codigo ? (
                  <span className="mt-0.5 block font-mono text-[10px] font-normal text-muted-foreground">
                    {p.codigo}
                  </span>
                ) : null}
              </th>
            ))}
            <th
              scope="col"
              title="Suma del stock en todas las postas (stock_final del mes)."
              className="sticky top-0 z-[36] min-w-[4rem] border-l-2 border-border bg-muted/90 px-1.5 py-2.5 text-center text-[11px] font-semibold text-foreground"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {grupos.map(({ cat, meds }) => {
            const expandida = estaExpandida(cat);
            return (
            <Fragment key={cat}>
              <tr className="border-b border-border bg-muted/90">
                <td
                  colSpan={4 + postas.length}
                  className="sticky left-0 z-[28] bg-muted/80 px-2 py-1 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.35)]"
                >
                  <CategoriaGrupoCabeceraContenido
                    etiqueta={etiquetaMedicamentoCategoria[cat]}
                    expandida={expandida}
                    onToggle={() => onToggleCategoria(cat)}
                    cantidad={meds.length}
                    className="px-1 py-1.5"
                  />
                </td>
              </tr>
              {expandida
                ? meds.map((med) => {
                const porPosta = stockFinalPorMedYPosta.get(med.id);
                const totalStockPostas = postas.reduce(
                  (acc, p) => acc + (porPosta?.get(p.id) ?? 0),
                  0
                );
                const rowBg = rowIdx % 2 === 1 ? "bg-muted/25" : "bg-background";
                rowIdx += 1;

                return (
                  <tr
                    key={med.id}
                    className={cn(
                      "border-b border-border/80 transition-colors hover:bg-muted/35",
                      rowBg
                    )}
                  >
                    <th
                      scope="row"
                      className={cn(
                        "sticky left-0 z-[25] border-r border-border px-2 py-1.5 text-left font-normal shadow-[4px_0_12px_-4px_rgba(0,0,0,0.08)]",
                        "dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.35)]",
                        rowBg
                      )}
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex flex-wrap items-start gap-1">
                          <span className="line-clamp-2 min-w-0 flex-1 font-medium leading-snug text-foreground">
                            {med.nombre}
                          </span>
                          {esContraRecetaEnMatriz(med) ? (
                            <BadgeMedicamentoContraReceta compacto />
                          ) : null}
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {med.codigoInterno} · {med.unidadMedida}
                          {!med.activo ? (
                            <span className="ml-1 text-destructive">· inactivo</span>
                          ) : null}
                        </span>
                        {puedeEditarFicha && onEditarMedicamento ? (
                          <button
                            type="button"
                            className={cn(
                              buttonVariants({ variant: "link", size: "sm" }),
                              "h-auto min-h-0 justify-start p-0 text-[11px] text-primary"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditarMedicamento(med.id);
                            }}
                          >
                            Editar
                          </button>
                        ) : null}
                      </div>
                    </th>
                    <td
                      className={cn(
                        "border-r border-emerald-600/20 bg-emerald-500/12 px-1 py-1.5 text-center text-xs font-semibold tabular-nums text-emerald-950 dark:bg-emerald-950/35 dark:text-emerald-100"
                      )}
                    >
                      {med.stockRecomendadoDefault}
                    </td>
                    <td
                      className={cn(
                        "border-r border-destructive/25 bg-destructive/10 px-1 py-1.5 text-center text-xs font-semibold tabular-nums text-destructive dark:bg-destructive/18 dark:text-red-100"
                      )}
                    >
                      {med.stockCriticoDefault}
                    </td>
                    {postas.map((p) => {
                      const sf = porPosta?.get(p.id) ?? 0;
                      const crit = med.stockCriticoDefault;
                      const rec = med.stockRecomendadoDefault;
                      const tono = nivelStockListadoVisual(sf, crit, rec);

                      return (
                        <td
                          key={`${med.id}-${p.id}`}
                          className={cn(
                            "border-r border-border/60 px-1 py-1.5 text-center align-middle tabular-nums",
                            tono === "alerta" &&
                              "bg-destructive/12 font-semibold text-destructive dark:bg-destructive/18 dark:text-red-100",
                            tono === "regular" &&
                              "bg-amber-400/16 font-semibold text-amber-950 dark:bg-amber-500/14 dark:text-amber-50",
                            tono === "ok" &&
                              "bg-emerald-500/12 font-semibold text-emerald-900 dark:bg-emerald-500/12 dark:text-emerald-50"
                          )}
                        >
                          {sf}
                        </td>
                      );
                    })}
                    <td
                      className={cn(
                        "border-l-2 border-border bg-muted/40 px-1.5 py-1.5 text-center text-xs font-semibold tabular-nums text-foreground",
                        rowBg === "bg-background" ? "bg-muted/35" : "bg-muted/45"
                      )}
                    >
                      {totalStockPostas}
                    </td>
                  </tr>
                );
              })
                : null}
            </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const selectFiltroClassName = cn(
  "h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
);

export function MedicamentosMatrizConsumo({
  mesStockEtiqueta,
  postas,
  medicamentos,
  stockFinalPorMedYPosta,
  puedeEditarFicha,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editarId, setEditarId] = useState<string | null>(null);
  const [consulta, setConsulta] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<MedicamentoCategoria | "">("");
  const [filtroContraReceta, setFiltroContraReceta] = useState<FiltroContraReceta>("");
  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  const totalContraReceta = useMemo(
    () => medicamentos.filter((m) => esContraRecetaEnMatriz(m)).length,
    [medicamentos]
  );

  const editarDesdeUrl = searchParams.get("editar");

  useEffect(() => {
    if (!puedeEditarFicha || !editarDesdeUrl) return;
    if (medicamentos.some((m) => m.id === editarDesdeUrl)) {
      setEditarId(editarDesdeUrl);
    }
  }, [editarDesdeUrl, medicamentos, puedeEditarFicha]);

  const medicamentoEnEdicion = useMemo(() => {
    if (!editarId) return null;
    const row = medicamentos.find((m) => m.id === editarId);
    return row ? matrizRowToMedicamentoRow(row) : null;
  }, [editarId, medicamentos]);

  const abrirEdicion = (id: string) => {
    setEditarId(id);
  };

  const cerrarEdicion = (open: boolean) => {
    if (open) return;
    setEditarId(null);
    if (searchParams.get("editar")) {
      router.replace(pathname);
    }
  };

  const medicamentosFiltrados = useMemo(
    () =>
      medicamentos.filter(
        (m) =>
          medicamentoPasaFiltroCategoria(m, categoriaFiltro) &&
          medicamentoPasaFiltroContraReceta(m, filtroContraReceta) &&
          medicamentoCoincide(m, consulta)
      ),
    [medicamentos, consulta, categoriaFiltro, filtroContraReceta]
  );

  const hayFiltrosActivos =
    consulta.trim() !== "" || categoriaFiltro !== "" || filtroContraReceta !== "";

  const colapsables = useCategoriasColapsables();
  const forzarExpandidas = consulta.trim() !== "";

  const categoriasVisibles = useMemo(() => {
    const presentes = new Set(
      medicamentosFiltrados.map((m) => categoriaAgrupacionAdmin(m.categoria))
    );
    return CATEGORIAS_AGRUPACION_ADMIN.filter((c) => presentes.has(c));
  }, [medicamentosFiltrados]);

  const matrizPropsBase = {
    postas,
    stockFinalPorMedYPosta,
    puedeEditarFicha,
    onEditarMedicamento: puedeEditarFicha ? abrirEdicion : undefined,
    estaExpandida: (cat: string) => colapsables.estaExpandida(cat, forzarExpandidas),
    onToggleCategoria: colapsables.toggle,
  };

  const renderFiltros = (scope: "main" | "modal") => (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-md">
        <Label htmlFor={`filtro-matriz-medicamentos-${scope}`} className="text-xs font-medium">
          Buscar
        </Label>
        <Input
          ref={scope === "modal" ? inputBusquedaRef : undefined}
          id={`filtro-matriz-medicamentos-${scope}`}
          type="search"
          placeholder="Nombre, código interno o unidad…"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="w-full space-y-1.5 sm:w-56">
        <Label htmlFor={`filtro-matriz-categoria-${scope}`} className="text-xs font-medium">
          Categoría
        </Label>
        <select
          id={`filtro-matriz-categoria-${scope}`}
          value={categoriaFiltro}
          onChange={(e) =>
            setCategoriaFiltro(
              e.target.value === "" ? "" : normalizarMedicamentoCategoria(e.target.value)
            )
          }
          className={selectFiltroClassName}
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS_CATALOGO_FORMULARIO.map((value) => (
            <option key={value} value={value}>
              {etiquetaMedicamentoCategoria[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full space-y-1.5 sm:w-52">
        <Label htmlFor={`filtro-matriz-contra-receta-${scope}`} className="text-xs font-medium">
          Contra receta
        </Label>
        <select
          id={`filtro-matriz-contra-receta-${scope}`}
          value={filtroContraReceta}
          onChange={(e) => {
            const v = e.target.value;
            setFiltroContraReceta(
              v === "contra_receta" || v === "general" ? v : ""
            );
          }}
          className={selectFiltroClassName}
        >
          <option value="">Todos</option>
          <option value="contra_receta">Solo contra receta ({totalContraReceta})</option>
          <option value="general">Solo pedido general</option>
        </select>
      </div>
      {hayFiltrosActivos ? (
        <button
          type="button"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0")}
          onClick={() => {
            setConsulta("");
            setCategoriaFiltro("");
            setFiltroContraReceta("");
          }}
        >
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-3">
      {puedeEditarFicha ? (
        <MedicamentoEditDialog
          medicamento={medicamentoEnEdicion}
          open={editarId !== null && medicamentoEnEdicion !== null}
          onOpenChange={cerrarEdicion}
        />
      ) : null}
      {renderFiltros("main")}
      <CategoriasColapsarTodasBar
        categorias={categoriasVisibles}
        onExpandirTodas={colapsables.expandirTodas}
        onColapsarTodas={colapsables.colapsarTodas}
      />
      <p className="text-xs text-muted-foreground">
        Mostrando {medicamentosFiltrados.length} de {medicamentos.length} medicamentos
        {categoriaFiltro
          ? ` · ${etiquetaMedicamentoCategoria[categoriaFiltro]}`
          : null}
        {filtroContraReceta === "contra_receta"
          ? " · solo contra receta"
          : filtroContraReceta === "general"
            ? " · solo pedido general"
            : null}
        {totalContraReceta > 0 ? ` · ${totalContraReceta} contra receta en catálogo` : null}.
      </p>
      {totalContraReceta > 0 ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Leyenda:</span>
          <BadgeMedicamentoContraReceta compacto />
          <span>= pedido mensual contra receta (además del general)</span>
        </p>
      ) : null}
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Maximize2 className="size-3.5 shrink-0 opacity-70" aria-hidden />
        Clic en la tabla para ampliarla a pantalla completa.
      </p>

      <Dialog.Root
        open={modalAbierto}
        onOpenChange={(open) => {
          setModalAbierto(open);
          if (!open) setConsulta("");
        }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Ampliar tabla de stock general de medicamentos"
          className={cn(
            "rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "cursor-zoom-in"
          )}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            if ((e.target as HTMLElement).closest("a, button")) return;
            e.preventDefault();
            setModalAbierto(true);
          }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a, button")) return;
            setModalAbierto(true);
          }}
        >
          {medicamentosFiltrados.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No hay medicamentos que coincidan con los filtros.
            </p>
          ) : (
            <MatrizStockTabla
              {...matrizPropsBase}
              medicamentosVisibles={medicamentosFiltrados}
              contenedorClassName="max-h-[min(78vh,920px)]"
            />
          )}
        </div>

        <Dialog.Portal>
          <Dialog.Backdrop
            className={cn(
              "fixed inset-0 z-50 bg-black/50 transition-opacity",
              "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
            )}
          />
          <Dialog.Viewport
            className={cn(
              "fixed inset-0 z-50 flex max-h-[100dvh] max-w-[100vw] items-stretch justify-stretch p-0 outline-none"
            )}
          >
            <Dialog.Popup
              className={cn(
                "flex max-h-[100dvh] w-[100vw] max-w-[100vw] flex-col bg-background shadow-2xl outline-none",
                "border-0 sm:border-0"
              )}
              initialFocus={inputBusquedaRef}
            >
              <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1 space-y-1">
                  <Dialog.Title className="font-heading text-lg font-semibold tracking-tight text-foreground">
                    Stock general de medicamentos
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-muted-foreground">
                    Mes {mesStockEtiqueta}. Mismos filtros de búsqueda, categoría y contra receta que en el listado.
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "shrink-0 gap-1.5"
                  )}
                  aria-label="Cerrar"
                >
                  <X className="size-4" aria-hidden />
                  Cerrar
                </Dialog.Close>
              </div>

              <div className="shrink-0 space-y-2 border-b bg-background px-4 py-3 sm:px-5">
                {renderFiltros("modal")}
                <CategoriasColapsarTodasBar
                  categorias={categoriasVisibles}
                  onExpandirTodas={colapsables.expandirTodas}
                  onColapsarTodas={colapsables.colapsarTodas}
                />
              </div>

              <div className="min-h-0 min-w-0 flex-1 overflow-auto px-2 pb-4 pt-2 sm:px-4">
                {medicamentosFiltrados.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                    No hay medicamentos que coincidan con la búsqueda.
                  </p>
                ) : (
                  <MatrizStockTabla
                    {...matrizPropsBase}
                    medicamentosVisibles={medicamentosFiltrados}
                    contenedorClassName="max-h-none"
                  />
                )}
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
