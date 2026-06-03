import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { tituloMesChile } from "@/components/posta/posta-mes-toolbar";
import type { VistaCierreMes } from "@/lib/posta/cierre-mensual";
import { cn } from "@/lib/utils";

type Props = {
  postaId: string;
  anio: number;
  mes: number;
  vista: VistaCierreMes;
  className?: string;
};

function formatCerradoEn(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" });
}

/** Aviso cuando el mes consultado ya fue cerrado (enlace al detalle guardado). */
export function CierreMesVistaAviso({ postaId, anio, mes, vista, className }: Props) {
  if (!vista.cierre) return null;

  const href = `/postas/${postaId}/cierre?ym=${anio}-${String(mes).padStart(2, "0")}`;

  return (
    <div
      className={cn(
        "rounded-lg border border-violet-500/35 bg-violet-50 px-4 py-3 text-sm text-violet-950 dark:border-violet-600/30 dark:bg-violet-950/25 dark:text-violet-100",
        className
      )}
    >
      <p className="font-medium">
        {tituloMesChile(anio, mes)} está cerrado
      </p>
      <p className="mt-1 text-xs text-violet-900/90 dark:text-violet-100/90">
        Cerrado el {formatCerradoEn(vista.cierre.cerradoEn)}.
        {vista.origen === "snapshot" ? (
          <>
            {" "}
            La tabla de conciliación en{" "}
            <Link href={href} className="font-semibold underline">
              Cierre mensual
            </Link>{" "}
            muestra los valores guardados ese día (no se recalculan).
          </>
        ) : (
          <>
            {" "}
            El detalle por medicamento no quedó guardado en el cierre; en{" "}
            <Link href={href} className="font-semibold underline">
              Cierre mensual
            </Link>{" "}
            verás un cálculo con los datos actuales.
          </>
        )}
      </p>
      <Link
        href={href}
        className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-3")}
      >
        Ver cierre del mes
      </Link>
    </div>
  );
}
