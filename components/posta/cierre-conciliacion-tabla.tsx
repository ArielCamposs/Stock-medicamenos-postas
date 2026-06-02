import type { FilaConciliacionCierre } from "@/lib/posta/cierre-conciliacion-filas";
import { cn } from "@/lib/utils";

function filaToneClasses(f: FilaConciliacionCierre) {
  const tieneDiferencia = f.diferenciaAvis !== 0;
  const bajoCritico = f.stock_critico > 0 && f.disponible <= f.stock_critico;
  return {
    tieneDiferencia,
    bajoCritico,
    rowClass: bajoCritico
      ? "bg-rose-500/5 dark:bg-rose-500/8"
      : tieneDiferencia
        ? "bg-amber-500/5 dark:bg-amber-500/8"
        : "",
    borderClass: bajoCritico
      ? "border-l-rose-500"
      : tieneDiferencia
        ? "border-l-amber-500"
        : "border-l-transparent",
  };
}

function CierreFilaMobile({ f }: { f: FilaConciliacionCierre }) {
  const { bajoCritico, tieneDiferencia, borderClass } = filaToneClasses(f);

  return (
    <div className={cn("border-l-4 p-4", borderClass)}>
      <div className="min-w-0">
        <p className="font-medium leading-snug">{f.nombre}</p>
        <p className="text-xs text-muted-foreground">
          {f.codigo} · {f.unidad}
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Cierre ant.</dt>
          <dd className="font-medium tabular-nums">{f.cierreAnterior}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ingresos</dt>
          <dd className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
            {f.ingresoMes > 0 ? `+${f.ingresoMes}` : f.ingresoMes}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Descuentos</dt>
          <dd className="font-medium tabular-nums">{f.descuentoMes}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Registro</dt>
          <dd
            className={cn(
              "font-semibold tabular-nums",
              bajoCritico && "text-rose-600 dark:text-rose-400"
            )}
          >
            {f.disponible}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">AVIS</dt>
          <dd className="font-medium tabular-nums">{f.stockAvis}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dif.</dt>
          <dd
            className={cn(
              "font-semibold tabular-nums",
              f.diferenciaAvis > 0
                ? "text-emerald-700 dark:text-emerald-400"
                : f.diferenciaAvis < 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
            )}
          >
            {f.diferenciaAvis > 0 ? `+${f.diferenciaAvis}` : f.diferenciaAvis}
          </dd>
        </div>
      </dl>
      {bajoCritico ? (
        <p className="mt-2 text-[11px] font-medium text-rose-600 dark:text-rose-400">
          Bajo nivel crítico
        </p>
      ) : tieneDiferencia ? (
        <p className="mt-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          Diferencia con AVIS
        </p>
      ) : null}
    </div>
  );
}

export function CierreConciliacionTabla({ filas }: { filas: FilaConciliacionCierre[] }) {
  if (filas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay medicamentos activos en el catálogo.
      </p>
    );
  }

  return (
    <>
      {/* Escritorio */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[54rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
              <th className="px-2 py-2">Medicamento</th>
              <th className="px-2 py-2 text-right">Cierre ant.</th>
              <th className="px-2 py-2 text-right">Ingresos</th>
              <th className="px-2 py-2 text-right">Descuentos</th>
              <th className="px-2 py-2 text-right">Registro</th>
              <th className="px-2 py-2 text-right">AVIS</th>
              <th className="px-2 py-2 text-right">Dif.</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const { bajoCritico, tieneDiferencia, rowClass, borderClass } = filaToneClasses(f);
              return (
                <tr
                  key={f.id}
                  className={cn("border-b border-border/70 transition-colors", rowClass)}
                >
                  <td className={cn("px-2 py-2.5 border-l-4", borderClass)}>
                    <span className="font-medium">{f.nombre}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({f.codigo} · {f.unidad})
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                    {f.cierreAnterior}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                    {f.ingresoMes > 0 ? `+${f.ingresoMes}` : f.ingresoMes}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                    {f.descuentoMes}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-2.5 text-right font-semibold tabular-nums",
                      bajoCritico && "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {f.disponible}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{f.stockAvis}</td>
                  <td
                    className={cn(
                      "px-2 py-2.5 text-right font-semibold tabular-nums",
                      f.diferenciaAvis > 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : f.diferenciaAvis < 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {f.diferenciaAvis > 0 ? `+${f.diferenciaAvis}` : f.diferenciaAvis}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Móvil */}
      <div className="divide-y divide-border/60 rounded-lg border md:hidden">
        {filas.map((f) => (
          <CierreFilaMobile key={f.id} f={f} />
        ))}
      </div>
    </>
  );
}

export function CierreResumenTarjetas({
  resumen,
}: {
  resumen: {
    disponible: number;
    avis: number;
    diferencias: number;
    bajoCritico: number;
  };
}) {
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-sky-500/20 bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Stock según registro
        </p>
        <p className="text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-400 mt-1">
          {resumen.disponible}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">unidades totales calculadas</p>
      </div>
      <div className="rounded-xl border border-sky-500/20 bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Stock AVIS declarado
        </p>
        <p className="text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-400 mt-1">
          {resumen.avis}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">unidades contadas físicamente</p>
      </div>
      <div
        className={
          resumen.diferencias > 0
            ? "rounded-xl border border-amber-500/30 bg-card p-4"
            : "rounded-xl border border-emerald-500/20 bg-card p-4"
        }
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Diferencias
        </p>
        <p
          className={`text-2xl font-bold tabular-nums mt-1 ${
            resumen.diferencias > 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {resumen.diferencias}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          {resumen.diferencias === 0 ? "Sin diferencias" : "medicamentos con diferencia"}
        </p>
      </div>
      <div
        className={
          resumen.bajoCritico > 0
            ? "rounded-xl border border-rose-500/30 bg-card p-4"
            : "rounded-xl border border-emerald-500/20 bg-card p-4"
        }
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bajo nivel crítico
        </p>
        <p
          className={`text-2xl font-bold tabular-nums mt-1 ${
            resumen.bajoCritico > 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {resumen.bajoCritico}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          {resumen.bajoCritico === 0
            ? "Todo en niveles normales"
            : "requieren reposición"}
        </p>
      </div>
    </div>
  );
}
