"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/providers/toast-provider";
import { registrarIngresosStockLoteAction } from "@/app/actions/posta";
import type { PostaActionState } from "@/app/actions/posta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fechaInputHoy } from "@/lib/domain/fecha-mes";
import type { PedidoDespachadoActivoIngreso } from "@/lib/posta/pedido-despachado-ingreso";
import { cn } from "@/lib/utils";

export type MedIngresoLoteRow = {
  id: string;
  nombre: string;
  codigo_interno: string;
  codigo_avis: string | null;
  unidad_medida: string;
  /** Cantidad del pedido mensual enviado para este mes (0 si no hay pedido). */
  cantidadPedida: number;
  /** Cantidad ya ingresada este mes en lotes anteriores (no anulada). */
  cantidadYaIngresada: number;
  /** cantidadPedida - cantidadYaIngresada, mínimo 0. Valor sugerido para el input. */
  cantidadSugerida: number;
};

/** Totales del mes contable (misma lógica que descuento / pedidos). */
export type LedgerIngresoFila = {
  stock_recomendado: number;
  stock_critico: number;
  disponible: number;
};

function normalizaBusqueda(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function medCoincide(m: MedIngresoLoteRow, q: string, soloPedido: boolean) {
  if (soloPedido && m.cantidadPedida === 0) return false;
  if (!q) return true;
  const nombre = m.nombre.toLowerCase();
  const ci = m.codigo_interno.toLowerCase();
  const avis = (m.codigo_avis ?? "").toLowerCase();
  return nombre.includes(q) || ci.includes(q) || (avis.length > 0 && avis.includes(q));
}

const cantInputClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-center text-sm tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function IngresoStockLoteForm({
  postaId,
  medicamentos,
  mesContableYm,
  ledgerPorMedicamento,
  hayPedidoMes,
  pedidoDespachadoActivo,
  totalIngresadoMes,
  fechaApunteIngreso,
  ingresoBloqueadoMismoDia,
}: {
  postaId: string;
  medicamentos: MedIngresoLoteRow[];
  mesContableYm: string;
  ledgerPorMedicamento: Record<string, LedgerIngresoFila>;
  /** True si hay un pedido despachado pendiente de ingresar este mes. */
  hayPedidoMes: boolean;
  pedidoDespachadoActivo: PedidoDespachadoActivoIngreso | null;
  /** Suma total de unidades ya ingresadas este mes (para mostrar aviso). */
  totalIngresadoMes: number;
  fechaApunteIngreso: string;
  ingresoBloqueadoMismoDia: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const bound = registrarIngresosStockLoteAction.bind(null, postaId);
  const [state, formAction, pending] = useActionState(
    bound as (s: PostaActionState, fd: FormData) => Promise<PostaActionState>,
    {}
  );

  // Inicializar con las cantidades sugeridas pre-cargadas (pedido - ya ingresado).
  const [editados, setEditados] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const m of medicamentos) {
      if (m.cantidadSugerida > 0) s.add(m.id);
    }
    return s;
  });
  const [totalUnidades, setTotalUnidades] = useState(() =>
    medicamentos.reduce((sum, m) => sum + m.cantidadSugerida, 0)
  );

  const formRef = useRef<HTMLFormElement>(null);

  const limpiarTodo = useCallback(() => {
    const inputs = formRef.current?.querySelectorAll("input[name^='cant_']");
    inputs?.forEach((input) => {
      if (input instanceof HTMLInputElement) input.value = "";
    });
    setEditados(new Set());
    setTotalUnidades(0);
  }, []);

  useEffect(() => {
    if (state.success) {
      toast(state.success, "success");
      limpiarTodo();
    }
    if (state.error) toast(state.error, "error");
  }, [state.success, state.error, toast, limpiarTodo]);

  // Navegar al siguiente input de cantidad al presionar Enter.
  const handleKeyDownCant = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const inputs = Array.from(form.querySelectorAll<HTMLInputElement>("input[name^='cant_']"));
    const idx = inputs.indexOf(e.currentTarget);
    if (idx >= 0 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
      inputs[idx + 1].select();
    }
  }, []);

  const handleFormChange = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const formData = new FormData(form);
    const nuevosEditados = new Set<string>();
    let unidades = 0;
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("cant_")) {
        const n = Number(value);
        if (n > 0) {
          nuevosEditados.add(key.slice(5));
          unidades += n;
        }
      }
    }
    setEditados(nuevosEditados);
    setTotalUnidades(unidades);
  }, []);

  const fechaApunte = fechaApunteIngreso;

  const [busqueda, setBusqueda] = useState("");
  const [soloPedido, setSoloPedido] = useState(
    () => pedidoDespachadoActivo?.tipo === "CONTRA_RECETA"
  );
  const query = useMemo(() => normalizaBusqueda(busqueda), [busqueda]);
  const filtrados = useMemo(
    () => medicamentos.filter((m) => medCoincide(m, query, soloPedido)),
    [medicamentos, query, soloPedido]
  );

  const idsJson = useMemo(
    () => JSON.stringify(medicamentos.map((m) => m.id)),
    [medicamentos]
  );

  // Filas del pedido que el usuario aún no ha llenado.
  const pendiendosPedido = useMemo(() => {
    if (!hayPedidoMes) return 0;
    return medicamentos.filter(
      (m) => m.cantidadPedida > 0 && !editados.has(m.id)
    ).length;
  }, [medicamentos, editados, hayPedidoMes]);

  const totalModificados = editados.size;

  return (
    <form
      ref={formRef}
      action={formAction}
      onChange={handleFormChange}
      className={cn("flex flex-col gap-4", totalModificados > 0 && "pb-32 md:pb-24")}
    >
      <input type="hidden" name="medicamento_ids_json" value={idsJson} />
      <input type="hidden" name="fecha" value={fechaApunte} />
      <input type="hidden" name="mes_movimiento" value={mesContableYm} />
      {pedidoDespachadoActivo ? (
        <input type="hidden" name="pedido_despachado_id" value={pedidoDespachadoActivo.pedidoId} />
      ) : null}

      {state.error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p
          className="rounded-md border border-emerald-600/35 bg-emerald-600/10 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-50"
          role="status"
        >
          {state.success}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ing-lote-mes">Mes del ingreso</Label>
          <Input
            id="ing-lote-mes"
            type="month"
            value={mesContableYm}
            onChange={(e) => {
              const v = e.target.value || fechaInputHoy().slice(0, 7);
              router.replace(`/postas/${postaId}/ingresos?ym=${v}`);
            }}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ing-observacion">Observación</Label>
          <Input
            id="ing-observacion"
            name="observacion"
            maxLength={500}
            placeholder="Opcional"
          />
        </div>
      </div>

      {medicamentos.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 space-y-1.5" style={{ minWidth: "14rem" }}>
            <Label htmlFor="ing-buscar-med" className="text-xs font-medium">
              Buscar medicamento
            </Label>
            <Input
              id="ing-buscar-med"
              type="search"
              autoComplete="off"
              placeholder="Nombre o código interno…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          {hayPedidoMes ? (
            <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={soloPedido}
                onChange={(e) => setSoloPedido(e.target.checked)}
              />
              <span className="font-medium">Solo ítems del pedido</span>
            </label>
          ) : null}
        </div>
      ) : null}

      {/* Resumen en tiempo real */}
      {pedidoDespachadoActivo ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-violet-500/40 bg-violet-50 px-3 py-2.5 text-xs text-violet-950 dark:border-violet-600/30 dark:bg-violet-950/25 dark:text-violet-100">
          <span className="mt-0.5 text-base leading-none">📦</span>
          <div>
            <strong>
              Pedido {pedidoDespachadoActivo.etiquetaTipo} despachado
            </strong>{" "}
            ({pedidoDespachadoActivo.despachadoEtiqueta}). Registra aquí lo que llegó, igual que con el
            pedido general. Si también hay otro despacho después, lo verás cuando termines este.
          </div>
        </div>
      ) : null}

      {ingresoBloqueadoMismoDia ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
          <span className="mt-0.5 text-base leading-none">📅</span>
          <div>
            <strong>Ya registraste una recepción hoy</strong> ({fechaApunte}).
            {" "}Puedes volver a ingresar lo pendiente del pedido <strong>mañana u otro día</strong>.
            {" "}Revisa el historial de abajo si necesitas ver lo ya cargado.
          </div>
        </div>
      ) : totalIngresadoMes > 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-sky-500/35 bg-sky-500/8 px-3 py-2.5 text-xs text-sky-800 dark:text-sky-300">
          <span className="mt-0.5 text-base leading-none">📦</span>
          <div>
            <strong>Puedes registrar otra recepción</strong> ({totalIngresadoMes.toLocaleString("es-CL")} unidades ya ingresadas este mes).
            {" "}La columna <strong>Ingresado</strong> muestra lo recibido; <strong>Recibido</strong> trae lo que falta del pedido.
            {hayPedidoMes
              ? " Solo una carga por día calendario."
              : " Registra solo lo que llegó en esta carga."}
          </div>
        </div>
      ) : hayPedidoMes && medicamentos.some((m) => m.cantidadPedida > 0) ? (
        <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/8 px-3 py-2 text-xs text-sky-800 dark:text-sky-300">
          <span className="text-base">📋</span>
          <span>
            Los campos <strong>Recibido</strong> están pre-cargados con las cantidades del pedido.
            Ajusta solo lo que difiera de lo que llegó realmente.
          </span>
        </div>
      ) : null}

      {medicamentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted/5">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground/70 mb-4 border border-border/40">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-7">
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
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted/5 animate-fade-in">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/5 text-primary/70 mb-4 border border-primary/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-7 text-primary/60">
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
        <>
          {/* Escritorio */}
          <div className="relative hidden max-h-[min(60vh,640px)] overflow-auto rounded-lg border border-border shadow-sm md:block">
            <table className="w-full min-w-[42rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/90 text-left text-xs font-medium text-muted-foreground">
                  <th className="sticky top-0 z-10 bg-muted/95 px-2 py-2 backdrop-blur">Medicamento</th>
                  <th className="sticky top-0 z-10 w-[4.5rem] bg-muted/95 px-1 py-2 text-right whitespace-nowrap backdrop-blur">
                    Stock ref.
                  </th>
                  <th className="sticky top-0 z-10 w-[3.5rem] bg-muted/95 px-1 py-2 text-right backdrop-blur">
                    Crít.
                  </th>
                  <th className="sticky top-0 z-10 w-[4.5rem] bg-muted/95 px-1 py-2 text-right whitespace-nowrap backdrop-blur">
                    Disponible
                  </th>
                  {hayPedidoMes ? (
                    <th className="sticky top-0 z-10 w-[4.5rem] bg-muted/95 px-1 py-2 text-right whitespace-nowrap backdrop-blur text-sky-700 dark:text-sky-400">
                      Pedido
                    </th>
                  ) : null}
                  {totalIngresadoMes > 0 ? (
                    <th className="sticky top-0 z-10 w-[4.5rem] bg-muted/95 px-1 py-2 text-right whitespace-nowrap backdrop-blur text-amber-700 dark:text-amber-400">
                      Ingresado
                    </th>
                  ) : null}
                  <th className="sticky top-0 z-10 w-[7rem] bg-muted/95 px-2 py-2 text-center backdrop-blur">
                    Recibido
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((m) => {
                  const L = ledgerPorMedicamento[m.id];
                  const bajoCritico =
                    L !== undefined &&
                    L.stock_critico > 0 &&
                    L.disponible <= L.stock_critico;
                  const editado = editados.has(m.id);
                  const pendientePedido =
                    hayPedidoMes && m.cantidadPedida > 0 && !editado;

                  return (
                    <tr
                      key={m.id}
                      className={cn(
                        "border-b border-border/70 transition-colors",
                        editado
                          ? "border-l-2 border-l-emerald-500 bg-emerald-500/8 dark:bg-emerald-500/10"
                          : pendientePedido
                            ? "border-l-2 border-l-sky-400/60 bg-sky-500/5"
                            : bajoCritico
                              ? "bg-amber-500/10 dark:bg-amber-500/15"
                              : "odd:bg-muted/20"
                      )}
                    >
                      <td className="px-2 py-1.5 align-middle">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-medium leading-snug">{m.nombre}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {m.codigo_interno} · {m.unidad_medida}
                            {m.codigo_avis ? (
                              <span className="ml-1">· AVIS {m.codigo_avis}</span>
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td className="px-1 py-1.5 text-right tabular-nums">
                        {L?.stock_recomendado ?? "—"}
                      </td>
                      <td className="px-1 py-1.5 text-right tabular-nums">
                        {L?.stock_critico ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "px-1 py-1.5 text-right font-medium tabular-nums",
                          bajoCritico && "text-amber-900 dark:text-amber-100"
                        )}
                      >
                        {L?.disponible ?? "—"}
                      </td>
                      {hayPedidoMes ? (
                        <td className="px-1 py-1.5 text-right tabular-nums text-sky-700 dark:text-sky-400 font-medium">
                          {m.cantidadPedida > 0 ? m.cantidadPedida : (
                            <span className="text-muted-foreground/40 font-normal">—</span>
                          )}
                        </td>
                      ) : null}
                      {totalIngresadoMes > 0 ? (
                        <td className="px-1 py-1.5 text-right tabular-nums font-medium text-amber-700 dark:text-amber-400">
                          {m.cantidadYaIngresada > 0 ? m.cantidadYaIngresada : (
                            <span className="text-muted-foreground/30 font-normal">—</span>
                          )}
                        </td>
                      ) : null}
                      <td className="p-1 align-middle">
                        <input
                          type="number"
                          name={`cant_${m.id}`}
                          min={0}
                          step={1}
                          placeholder="—"
                          defaultValue={m.cantidadSugerida > 0 ? m.cantidadSugerida : undefined}
                          className={cn(
                            cantInputClass,
                            editado && "border-emerald-500/60 bg-emerald-500/5 font-semibold"
                          )}
                          aria-label={`Cantidad recibida de ${m.nombre}`}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={handleKeyDownCant}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Móvil */}
          <div className="max-h-[min(60vh,640px)] divide-y divide-border/60 overflow-auto rounded-lg border border-border shadow-sm md:hidden">
            {filtrados.map((m) => {
              const L = ledgerPorMedicamento[m.id];
              const bajoCritico =
                L !== undefined &&
                L.stock_critico > 0 &&
                L.disponible <= L.stock_critico;
              const editado = editados.has(m.id);
              const pendientePedido = hayPedidoMes && m.cantidadPedida > 0 && !editado;

              return (
                <div
                  key={m.id}
                  className={cn(
                    "p-3",
                    editado
                      ? "border-l-4 border-l-emerald-500 bg-emerald-500/8"
                      : pendientePedido
                        ? "border-l-4 border-l-sky-400/60 bg-sky-500/5"
                        : bajoCritico
                          ? "border-l-4 border-l-amber-500 bg-amber-500/10"
                          : ""
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{m.nombre}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {m.codigo_interno} · {m.unidad_medida}
                      {m.codigo_avis ? <span> · AVIS {m.codigo_avis}</span> : null}
                    </p>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
                    <div>
                      <dt className="text-muted-foreground">Stock ref.</dt>
                      <dd className="font-medium tabular-nums">{L?.stock_recomendado ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Crít.</dt>
                      <dd className="font-medium tabular-nums">{L?.stock_critico ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Disponible</dt>
                      <dd
                        className={cn(
                          "font-medium tabular-nums",
                          bajoCritico && "text-amber-900 dark:text-amber-100"
                        )}
                      >
                        {L?.disponible ?? "—"}
                      </dd>
                    </div>
                    {hayPedidoMes ? (
                      <div>
                        <dt className="text-muted-foreground">Pedido</dt>
                        <dd className="font-medium tabular-nums text-sky-700 dark:text-sky-400">
                          {m.cantidadPedida > 0 ? m.cantidadPedida : "—"}
                        </dd>
                      </div>
                    ) : null}
                    {totalIngresadoMes > 0 ? (
                      <div>
                        <dt className="text-muted-foreground">Ingresado</dt>
                        <dd className="font-medium tabular-nums text-amber-700 dark:text-amber-400">
                          {m.cantidadYaIngresada > 0 ? m.cantidadYaIngresada : "—"}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="mt-3">
                    <Label className="mb-1.5 block text-xs text-muted-foreground">Recibido</Label>
                    <input
                      type="number"
                      name={`cant_${m.id}`}
                      min={0}
                      step={1}
                      placeholder="—"
                      defaultValue={m.cantidadSugerida > 0 ? m.cantidadSugerida : undefined}
                      className={cn(
                        cantInputClass,
                        "max-w-[8rem]",
                        editado && "border-emerald-500/60 bg-emerald-500/5 font-semibold"
                      )}
                      aria-label={`Cantidad recibida de ${m.nombre}`}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={handleKeyDownCant}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {totalModificados === 0 && (
        <Button type="submit" disabled={pending || medicamentos.length === 0}>
          {pending ? "Guardando…" : "Registrar ingreso"}
        </Button>
      )}

      {totalModificados > 0 && (
        <div className="fixed-above-posta-nav fixed left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md py-3 px-5 shadow-xl animate-in slide-in-from-bottom duration-200 md:bottom-0">
          <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                  {totalModificados}
                </span>
                <span className="text-muted-foreground">
                  {totalModificados === 1 ? "medicamento" : "medicamentos"}
                </span>
              </span>
              <span className="text-muted-foreground">
                <strong className="text-foreground tabular-nums">{totalUnidades}</strong>{" "}
                unidades totales
              </span>
              {pendiendosPedido > 0 ? (
                <span className="text-sky-700 dark:text-sky-400">
                  <strong className="tabular-nums">{pendiendosPedido}</strong> del pedido sin completar
                </span>
              ) : hayPedidoMes && pendiendosPedido === 0 && medicamentos.filter((m) => m.cantidadPedida > 0).length > 0 ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">✓ Pedido completo</span>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={limpiarTodo}
                disabled={pending}
                className="h-9 px-3"
              >
                Limpiar todo
              </Button>
              <Button
                type="submit"
                disabled={pending || ingresoBloqueadoMismoDia}
                className="h-9 px-4 shadow-sm hover:shadow-md transition-all font-semibold"
              >
                {pending ? "Guardando…" : `Registrar ingreso (${totalModificados})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
