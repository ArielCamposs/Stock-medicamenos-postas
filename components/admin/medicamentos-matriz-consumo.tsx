"use client";

import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { Maximize2, X } from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  etiquetaMedicamentoCategoria,
  MEDICAMENTO_CATEGORIAS,
  compararMedicamentoPorCategoriaNombre,
  normalizarMedicamentoCategoria,
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
  unidadMedida: string;
  categoria: string;
  activo: boolean;
  /** Referencia del catálogo (columna Stock) */
  stockRecomendadoDefault: number;
  /** Referencia del catálogo (columna Crít.) */
  stockCriticoDefault: number;
};

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
  contenedorClassName?: string;
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
  const blob = normalizaBusqueda(`${m.nombre} ${m.codigoInterno} ${m.unidadMedida}`);
  return blob.includes(t);
}

function MatrizStockTabla({
  postas,
  medicamentosVisibles,
  stockFinalPorMedYPosta,
  puedeEditarFicha,
  contenedorClassName,
}: MatrizTablaProps) {
  const filasOrdenadas = useMemo(
    () =>
      [...medicamentosVisibles].sort((a, b) =>
        compararMedicamentoPorCategoriaNombre(
          normalizarMedicamentoCategoria(a.categoria),
          a.nombre,
          normalizarMedicamentoCategoria(b.categoria),
          b.nombre
        )
      ),
    [medicamentosVisibles]
  );

  const grupos = useMemo(() => {
    const g: { cat: (typeof MEDICAMENTO_CATEGORIAS)[number]; meds: MedicamentoMatrizRow[] }[] =
      [];
    for (const cat of MEDICAMENTO_CATEGORIAS) {
      const meds = filasOrdenadas.filter(
        (m) => normalizarMedicamentoCategoria(m.categoria) === cat
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
          {grupos.map(({ cat, meds }) => (
            <Fragment key={cat}>
              <tr className="border-b border-border bg-muted/90">
                <td
                  colSpan={4 + postas.length}
                  className="sticky left-0 z-[28] bg-muted/95 px-2 py-2 text-xs font-semibold tracking-wide text-foreground shadow-[4px_0_12px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.35)]"
                >
                  {etiquetaMedicamentoCategoria[cat]}
                </td>
              </tr>
              {meds.map((med) => {
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
                        <span className="line-clamp-2 font-medium leading-snug text-foreground">
                          {med.nombre}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {med.codigoInterno} · {med.unidadMedida}
                          {!med.activo ? (
                            <span className="ml-1 text-destructive">· inactivo</span>
                          ) : null}
                        </span>
                        {puedeEditarFicha ? (
                          <Link
                            href={`/admin/medicamentos/${med.id}/edit`}
                            className={cn(
                              buttonVariants({ variant: "link", size: "sm" }),
                              "h-auto min-h-0 justify-start p-0 text-[11px] text-primary"
                            )}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Editar medicamento
                          </Link>
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
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MedicamentosMatrizConsumo({
  mesStockEtiqueta,
  postas,
  medicamentos,
  stockFinalPorMedYPosta,
  puedeEditarFicha,
}: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  const medicamentosFiltrados = useMemo(
    () => medicamentos.filter((m) => medicamentoCoincide(m, consulta)),
    [medicamentos, consulta]
  );

  const matrizPropsBase = {
    postas,
    stockFinalPorMedYPosta,
    puedeEditarFicha,
  };

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Maximize2 className="size-3.5 shrink-0 opacity-70" aria-hidden />
        Clic en la tabla para ampliarla a pantalla completa y filtrar por nombre, código o unidad.
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
            if ((e.target as HTMLElement).closest("a")) return;
            e.preventDefault();
            setModalAbierto(true);
          }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) return;
            setModalAbierto(true);
          }}
        >
          <MatrizStockTabla
            {...matrizPropsBase}
            medicamentosVisibles={medicamentos}
            contenedorClassName="max-h-[min(78vh,920px)]"
          />
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
                    Mes {mesStockEtiqueta}. Filtra por nombre, código interno o unidad de medida.
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
                <Label htmlFor="filtro-matriz-medicamentos" className="text-xs font-medium">
                  Buscar
                </Label>
                <Input
                  ref={inputBusquedaRef}
                  id="filtro-matriz-medicamentos"
                  type="search"
                  placeholder="Ej.: paracetamol, código, caja…"
                  value={consulta}
                  onChange={(e) => setConsulta(e.target.value)}
                  className="max-w-md"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Mostrando {medicamentosFiltrados.length} de {medicamentos.length} medicamentos.
                </p>
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
