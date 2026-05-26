"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/providers/toast-provider";
import { registrarIngresosStockLoteAction } from "@/app/actions/posta";
import type { PostaActionState } from "@/app/actions/posta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fechaIngresoParaMesMovimiento,
  fechaInputHoy,
} from "@/lib/domain/fecha-mes";
import { cn } from "@/lib/utils";

export type MedIngresoLoteRow = {
  id: string;
  nombre: string;
  codigo_interno: string;
  codigo_avis: string | null;
  unidad_medida: string;
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

function medCoincide(m: MedIngresoLoteRow, q: string) {
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
}: {
  postaId: string;
  medicamentos: MedIngresoLoteRow[];
  /** `YYYY-MM` alineado con la URL `?ym=`; al cambiar el mes se recarga la página con los totales correctos. */
  mesContableYm: string;
  ledgerPorMedicamento: Record<string, LedgerIngresoFila>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const bound = registrarIngresosStockLoteAction.bind(null, postaId);
  const [state, formAction, pending] = useActionState(
    bound as (s: PostaActionState, fd: FormData) => Promise<PostaActionState>,
    {}
  );

  const [totalModificados, setTotalModificados] = useState(0);

  const limpiarTodo = () => {
    const inputs = document.querySelectorAll("input[name^='cant_']");
    inputs.forEach((input) => {
      if (input instanceof HTMLInputElement) {
        input.value = "";
      }
    });
    setTotalModificados(0);
  };

  useEffect(() => {
    if (state.success) {
      toast(state.success, "success");
      const inputs = document.querySelectorAll("input[name^='cant_']");
      inputs.forEach((input) => {
        if (input instanceof HTMLInputElement) {
          input.value = "";
        }
      });
      setTotalModificados(0);
    }
    if (state.error) toast(state.error, "error");
  }, [state.success, state.error, toast]);

  const handleFormChange = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const formData = new FormData(form);
    let count = 0;
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("cant_") && value && Number(value) > 0) {
        count++;
      }
    }
    if (count !== totalModificados) {
      setTotalModificados(count);
    }
  };

  const fechaApunte = useMemo(() => {
    const f = fechaIngresoParaMesMovimiento(mesContableYm, new Date());
    return f ?? fechaInputHoy();
  }, [mesContableYm]);

  const [busqueda, setBusqueda] = useState("");
  const query = useMemo(() => normalizaBusqueda(busqueda), [busqueda]);
  const filtrados = useMemo(
    () => medicamentos.filter((m) => medCoincide(m, query)),
    [medicamentos, query]
  );

  const idsJson = useMemo(
    () => JSON.stringify(medicamentos.map((m) => m.id)),
    [medicamentos]
  );

  return (
    <form
      action={formAction}
      onChange={handleFormChange}
      className={cn("flex flex-col gap-4", totalModificados > 0 && "pb-24")}
    >
      <input type="hidden" name="medicamento_ids_json" value={idsJson} />
      <input type="hidden" name="fecha" value={fechaApunte} />
      <input type="hidden" name="mes_movimiento" value={mesContableYm} />

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <Label htmlFor="ing-tipo-origen">Origen</Label>
          <select
            id="ing-tipo-origen"
            name="tipo_origen"
            defaultValue="OTRO"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="COMPRA">Compra</option>
            <option value="TRASLADO">Traslado</option>
            <option value="AJUSTE">Ajuste</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ing-referencia">Referencia</Label>
          <Input
            id="ing-referencia"
            name="referencia"
            maxLength={500}
            placeholder="Guía, folio, origen…"
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
        <div className="space-y-2">
          <div className="mx-auto max-w-xl space-y-1.5 sm:max-w-none">
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
        </div>
      ) : null}

      {medicamentos.length === 0 ? (
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
      ) : filtrados.length === 0 ? (
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
        <div className="relative max-h-[min(60vh,640px)] overflow-auto rounded-lg border border-border shadow-sm">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/90 text-left text-xs font-medium text-muted-foreground">
                <th className="sticky top-0 z-10 bg-muted/95 px-2 py-2">Medicamento</th>
                <th className="sticky top-0 z-10 w-[4.5rem] bg-muted/95 px-1 py-2 text-right whitespace-nowrap">
                  Stock ref.
                </th>
                <th className="sticky top-0 z-10 w-[3.5rem] bg-muted/95 px-1 py-2 text-right">
                  Crít.
                </th>
                <th className="sticky top-0 z-10 w-[4.5rem] bg-muted/95 px-1 py-2 text-right whitespace-nowrap">
                  Disponible
                </th>
                <th className="sticky top-0 z-10 w-[7rem] bg-muted/95 px-2 py-2 text-center">
                  Cantidad
                </th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m, idx) => {
                const rowBg = idx % 2 === 1 ? "bg-muted/20" : "bg-background";
                const L = ledgerPorMedicamento[m.id];
                const bajoCritico =
                  L !== undefined &&
                  L.stock_critico > 0 &&
                  L.disponible <= L.stock_critico;
                return (
                  <tr
                    key={m.id}
                    className={cn(
                      "border-b border-border/70",
                      rowBg,
                      bajoCritico && "bg-amber-500/10 dark:bg-amber-500/15"
                    )}
                  >
                    <td className={cn("px-2 py-1.5 align-middle", rowBg)}>
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
                    <td className={cn("px-1 py-1.5 text-right tabular-nums", rowBg)}>
                      {L?.stock_recomendado ?? "—"}
                    </td>
                    <td className={cn("px-1 py-1.5 text-right tabular-nums", rowBg)}>
                      {L?.stock_critico ?? "—"}
                    </td>
                    <td
                      className={cn(
                        "px-1 py-1.5 text-right font-medium tabular-nums",
                        rowBg,
                        bajoCritico && "text-amber-900 dark:text-amber-100"
                      )}
                    >
                      {L?.disponible ?? "—"}
                    </td>
                    <td className={cn("p-1 align-middle", rowBg)}>
                      <input
                        type="number"
                        name={`cant_${m.id}`}
                        min={1}
                        step={1}
                        placeholder="—"
                        className={cantInputClass}
                        aria-label={`Cantidad ingresada de ${m.nombre}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalModificados === 0 && (
        <Button type="submit" disabled={pending || medicamentos.length === 0}>
          {pending ? "Guardando…" : "Registrar ingresos"}
        </Button>
      )}

      {totalModificados > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md py-4 px-6 shadow-xl animate-in slide-in-from-bottom duration-200">
          <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                {totalModificados}
              </span>
              <p className="text-sm font-medium text-muted-foreground">
                {totalModificados === 1
                  ? "medicamento con cantidad ingresada"
                  : "medicamentos con cantidades ingresadas"}
              </p>
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
              <Button type="submit" disabled={pending} className="h-9 px-4 shadow-sm hover:shadow-md transition-all font-semibold">
                {pending ? "Guardando…" : `Registrar ${totalModificados} ingresos`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
