import { PostaMesToolbar, tituloMesChile } from "@/components/posta/posta-mes-toolbar";
import { PostaPageHeader } from "@/components/posta/posta-page-header";
import {
  StockAvisMensualForm,
  type StockAvisMedRow,
} from "@/components/posta/stock-avis-mensual-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  puedeRegistrarStockYAvisPosta,
  requirePerfilUsuario,
} from "@/lib/auth/session";
import { anioMesActual } from "@/lib/domain/fecha-mes";
import { CierreMesVistaAviso } from "@/components/posta/cierre-mes-vista-aviso";
import {
  obtenerCierreMensualPosta,
  vistaCierreDesdeRegistro,
} from "@/lib/posta/cierre-mensual";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ postaId: string }>;
  searchParams: Promise<{ ym?: string }>;
};

function parseYm(raw: string | undefined): { anio: number; mes: number; ym: string } {
  if (raw && typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw.trim())) {
    const [a, m] = raw.trim().split("-").map(Number);
    if (a >= 2020 && a <= 2100 && m >= 1 && m <= 12) {
      return { anio: a, mes: m, ym: raw.trim() };
    }
  }
  const cur = anioMesActual();
  return {
    anio: cur.anio,
    mes: cur.mes,
    ym: `${cur.anio}-${String(cur.mes).padStart(2, "0")}`,
  };
}

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.trunc(v);
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export default async function PostaStockAvisPage({ params, searchParams }: PageProps) {
  const { postaId } = await params;
  const qs = await searchParams;
  const { anio, mes, ym } = parseYm(qs?.ym);

  const { profile } = await requirePerfilUsuario();
  const puedeRegistrarPorRol = puedeRegistrarStockYAvisPosta(profile, postaId);
  const supabase = await createServerSupabaseClient();
  const cierre = await obtenerCierreMensualPosta(supabase, postaId, anio, mes);
  const vistaCierreMes = cierre ? vistaCierreDesdeRegistro(cierre) : null;
  const puedeRegistrar = puedeRegistrarPorRol && !cierre;

  const [{ data: medicamentos }, { data: avisRows }] = await Promise.all([
    supabase
      .from("medicamentos")
      .select("id, nombre, codigo_interno, codigo_avis, unidad_medida")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("stock_avis_mensual")
      .select("medicamento_id, stock_avis_cantidad")
      .eq("posta_id", postaId)
      .eq("anio", anio)
      .eq("mes", mes),
  ]);

  const avisPorMed = new Map<string, number>();
  if (avisRows && Array.isArray(avisRows)) {
    for (const row of avisRows) {
      const r = row as Record<string, unknown>;
      if (typeof r.medicamento_id === "string") {
        avisPorMed.set(r.medicamento_id, toInt(r.stock_avis_cantidad));
      }
    }
  }

  const rows: StockAvisMedRow[] = [];
  if (medicamentos && Array.isArray(medicamentos)) {
    for (const row of medicamentos) {
      const r = row as Record<string, unknown>;
      if (
        typeof r.id === "string" &&
        typeof r.nombre === "string" &&
        typeof r.codigo_interno === "string" &&
        typeof r.unidad_medida === "string"
      ) {
        rows.push({
          id: r.id,
          nombre: r.nombre,
          codigo_interno: r.codigo_interno,
          codigo_avis: typeof r.codigo_avis === "string" ? r.codigo_avis : null,
          unidad_medida: r.unidad_medida,
          declarado_avis: avisPorMed.get(r.id) ?? 0,
        });
      }
    }
  }

  const basePath = `/postas/${postaId}/avis`;

  return (
    <div className="space-y-6">
      <PostaPageHeader
        title="Stock declarado en AVIS"
        description={
          <>
            Declaración mensual por medicamento.
            {cierre ? (
              <span className="block pt-1">
                Mes cerrado. Solicita reapertura antes de modificar AVIS.
              </span>
            ) : !puedeRegistrar ? (
              <span className="block pt-1">
                En esta sesión no tienes permiso para guardar cambios.
              </span>
            ) : null}
          </>
        }
      />

      <PostaMesToolbar
        basePath={basePath}
        anio={anio}
        mes={mes}
        mesCerrado={Boolean(cierre)}
      />

      {vistaCierreMes ? (
        <CierreMesVistaAviso
          postaId={postaId}
          anio={anio}
          mes={mes}
          vista={vistaCierreMes}
        />
      ) : null}

      <p className="text-center font-heading text-lg font-semibold capitalize text-foreground">
        {tituloMesChile(anio, mes)}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Declaración del mes</CardTitle>
        </CardHeader>
        <CardContent>
          <StockAvisMensualForm
            postaId={postaId}
            medicamentos={rows}
            mesYm={ym}
            puedeRegistrar={puedeRegistrar}
          />
        </CardContent>
      </Card>
    </div>
  );
}
