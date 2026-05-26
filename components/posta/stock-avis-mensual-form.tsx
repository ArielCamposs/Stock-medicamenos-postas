"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

import {
  guardarDeclaracionStockAvisMensualAction,
  type PostaActionState,
} from "@/app/actions/posta";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fechaInputHoy } from "@/lib/domain/fecha-mes";
import { cn } from "@/lib/utils";

export type StockAvisMedRow = {
  id: string;
  nombre: string;
  codigo_interno: string;
  codigo_avis: string | null;
  unidad_medida: string;
  /** Valor guardado en `stock_avis_mensual` para el mes, o 0 si no hay fila. */
  declarado_avis: number;
};

function normalizaBusqueda(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function medCoincide(m: StockAvisMedRow, q: string) {
  if (!q) return true;
  const nombre = m.nombre.toLowerCase();
  const ci = m.codigo_interno.toLowerCase();
  const avis = (m.codigo_avis ?? "").toLowerCase();
  return nombre.includes(q) || ci.includes(q) || (avis.length > 0 && avis.includes(q));
}

const cantInputClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-center text-sm tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function StockAvisMensualForm({
  postaId,
  medicamentos,
  mesYm,
  puedeRegistrar,
}: {
  postaId: string;
  medicamentos: StockAvisMedRow[];
  mesYm: string;
  puedeRegistrar: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const bound = guardarDeclaracionStockAvisMensualAction.bind(null, postaId);
  const [state, formAction, pending] = useActionState(
    bound as (s: PostaActionState, fd: FormData) => Promise<PostaActionState>,
    {}
  );

  useEffect(() => {
    if (state.success) toast(state.success, "success");
    if (state.error) toast(state.error, "error");
  }, [state.success, state.error, toast]);

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
    <div className="flex flex-col gap-4">
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

      <div className="max-w-xs space-y-2">
        <Label htmlFor="avis-mes">Mes de la declaración</Label>
        <Input
          id="avis-mes"
          type="month"
          min="2020-01"
          max="2100-12"
          value={mesYm}
          onChange={(e) => {
            const v = e.target.value || fechaInputHoy().slice(0, 7);
            router.replace(`/postas/${postaId}/avis?ym=${v}`);
          }}
          className="font-mono"
        />
      </div>

      {medicamentos.length > 0 ? (
        <div className="space-y-2">
          <div className="mx-auto max-w-xl space-y-1.5 sm:max-w-none">
            <Label htmlFor="avis-buscar-med" className="text-xs font-medium">
              Buscar medicamento
            </Label>
            <Input
              id="avis-buscar-med"
              type="search"
              autoComplete="off"
              placeholder="Nombre, código interno o AVIS…"
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
      ) : (
        <>
          {query && filtrados.length === 0 ? (
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
          ) : null}

          {puedeRegistrar ? (
            <form action={formAction} className={cn("flex flex-col gap-3", filtrados.length === 0 && "hidden")}>
              <input type="hidden" name="medicamento_ids_json" value={idsJson} />
              <input type="hidden" name="ym" value={mesYm} />

              <div className="relative max-h-[min(60vh,640px)] overflow-auto rounded-lg border border-border shadow-sm">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/90 text-left text-xs font-medium text-muted-foreground">
                      <th className="sticky top-0 z-10 bg-muted/90 px-3 py-2">Medicamento</th>
                      <th className="sticky top-0 z-10 w-28 bg-muted/90 px-2 py-2 text-center">
                        Stock en AVIS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicamentos.map((m) => (
                      <tr
                        key={m.id}
                        className={cn(
                          "border-b border-border/70 odd:bg-background even:bg-muted/20",
                          !medCoincide(m, query) && "hidden"
                        )}
                      >
                        <td className="px-3 py-2 align-middle">
                          <div className="font-medium leading-snug text-foreground">
                            {m.nombre}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {m.codigo_interno} · {m.unidad_medida}
                            {m.codigo_avis ? <span> · AVIS {m.codigo_avis}</span> : null}
                          </div>
                        </td>
                        <td className="px-2 py-2 align-middle">
                          <input
                            name={`avis_${m.id}`}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            defaultValue={String(m.declarado_avis)}
                            className={cantInputClass}
                            aria-label={`Stock AVIS ${m.nombre}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "Guardando…" : "Guardar declaración AVIS"}
                </Button>
              </div>
            </form>
          ) : (
            <div className={cn("relative max-h-[min(60vh,640px)] overflow-auto rounded-lg border border-border shadow-sm", filtrados.length === 0 && "hidden")}>
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/90 text-left text-xs font-medium text-muted-foreground">
                    <th className="sticky top-0 z-10 bg-muted/90 px-3 py-2">Medicamento</th>
                    <th className="sticky top-0 z-10 w-28 bg-muted/90 px-2 py-2 text-center">
                      Stock en AVIS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {medicamentos.map((m) => (
                    <tr
                      key={m.id}
                      className={cn(
                        "border-b border-border/70 odd:bg-background even:bg-muted/20",
                        !medCoincide(m, query) && "hidden"
                      )}
                    >
                      <td className="px-3 py-2 align-middle">
                        <div className="font-medium leading-snug text-foreground">{m.nombre}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {m.codigo_interno} · {m.unidad_medida}
                          {m.codigo_avis ? <span> · AVIS {m.codigo_avis}</span> : null}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center align-middle tabular-nums font-medium">
                        {m.declarado_avis}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
