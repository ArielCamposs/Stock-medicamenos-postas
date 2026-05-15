"use client";

import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState } from "react";

import {
  guardarDeclaracionStockAvisMensualAction,
  type PostaActionState,
} from "@/app/actions/posta";
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
  const bound = guardarDeclaracionStockAvisMensualAction.bind(null, postaId);
  const [state, formAction, pending] = useActionState(
    bound as (s: PostaActionState, fd: FormData) => Promise<PostaActionState>,
    {}
  );

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
        <p className="text-sm text-muted-foreground">
          No hay medicamentos activos en el catálogo.
        </p>
      ) : (
        <>
          {query && filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin resultados para la búsqueda.</p>
          ) : null}
          {puedeRegistrar ? (
        <form action={formAction} className="flex flex-col gap-3">
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
