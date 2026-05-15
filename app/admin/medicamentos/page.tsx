import Link from "next/link";

import { MedicamentosMatrizConsumo } from "@/components/admin/medicamentos-matriz-consumo";
import { MedicamentoCreateForm } from "@/components/admin/medicamento-create-form";
import type { MedicamentoRow } from "@/components/admin/medicamento-row-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { anioMesActual, etiquetaMes } from "@/lib/domain/fecha-mes";
import {
  compararMedicamentoPorCategoriaNombre,
  normalizarMedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import { esAdminGeneral, requirePerfilUsuario } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  return null;
}

export default async function AdminMedicamentosPage() {
  const { profile } = await requirePerfilUsuario();
  const canEdit = esAdminGeneral(profile);

  const supabase = await createServerSupabaseClient();
  const { anio, mes } = anioMesActual();
  const mesStockEtiqueta = etiquetaMes(anio, mes);

  const [{ data, error }, { data: postasRows }] = await Promise.all([
    supabase
      .from("medicamentos")
      .select(
        "id,nombre,codigo_interno,codigo_avis,unidad_medida,categoria,stock_recomendado_default,stock_critico_default,activo,updated_at"
      )
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true }),
    supabase
      .from("postas")
      .select("id,nombre,codigo")
      .eq("activa", true)
      .order("nombre"),
  ]);

  const medicamentos: MedicamentoRow[] = [];
  if (data && Array.isArray(data)) {
    for (const row of data) {
      const r = row as Record<string, unknown>;
      const rec = toInt(r.stock_recomendado_default);
      const crit = toInt(r.stock_critico_default);
      if (
        typeof r.id === "string" &&
        typeof r.nombre === "string" &&
        typeof r.codigo_interno === "string" &&
        typeof r.unidad_medida === "string" &&
        typeof r.activo === "boolean" &&
        typeof r.updated_at === "string" &&
        rec !== null &&
        crit !== null
      ) {
        medicamentos.push({
          id: r.id,
          nombre: r.nombre,
          codigo_interno: r.codigo_interno,
          codigo_avis:
            r.codigo_avis === null || typeof r.codigo_avis === "string"
              ? r.codigo_avis
              : null,
          unidad_medida: r.unidad_medida,
          categoria: normalizarMedicamentoCategoria(
            typeof r.categoria === "string" ? r.categoria : undefined
          ),
          stock_recomendado_default: rec,
          stock_critico_default: crit,
          activo: r.activo,
          updated_at: r.updated_at,
        });
      }
    }
  }

  medicamentos.sort((a, b) =>
    compararMedicamentoPorCategoriaNombre(
      a.categoria,
      a.nombre,
      b.categoria,
      b.nombre
    )
  );

  const postasActivas =
    postasRows?.map((p) => ({
      id: String((p as { id: unknown }).id),
      nombre: String((p as { nombre: unknown }).nombre ?? ""),
      codigo:
        (p as { codigo: unknown }).codigo === null ||
        typeof (p as { codigo: unknown }).codigo === "string"
          ? ((p as { codigo: string | null }).codigo ?? null)
          : null,
    })) ?? [];

  const medIds = medicamentos.map((m) => m.id);
  const postaIds = postasActivas.map((p) => p.id);

  let stockMesActual: {
    posta_id: string;
    medicamento_id: string;
    stock_final: number;
  }[] = [];

  if (medIds.length > 0 && postaIds.length > 0) {
    const { data: curData } = await supabase
      .from("stock_mensual_posta")
      .select("posta_id, medicamento_id, stock_final")
      .eq("anio", anio)
      .eq("mes", mes)
      .in("medicamento_id", medIds)
      .in("posta_id", postaIds);

    if (curData && Array.isArray(curData)) {
      stockMesActual = curData.map((row) => {
        const x = row as Record<string, unknown>;
        return {
          posta_id: String(x.posta_id),
          medicamento_id: String(x.medicamento_id),
          stock_final: toInt(x.stock_final) ?? 0,
        };
      });
    }
  }

  const stockFinalPorMedYPosta = new Map<string, Map<string, number>>();
  for (const row of stockMesActual) {
    if (!stockFinalPorMedYPosta.has(row.medicamento_id)) {
      stockFinalPorMedYPosta.set(row.medicamento_id, new Map());
    }
    stockFinalPorMedYPosta
      .get(row.medicamento_id)!
      .set(row.posta_id, row.stock_final);
  }

  const medicamentosMatriz = medicamentos.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    codigoInterno: m.codigo_interno,
    unidadMedida: m.unidad_medida,
    categoria: m.categoria,
    activo: m.activo,
    stockRecomendadoDefault: m.stock_recomendado_default,
    stockCriticoDefault: m.stock_critico_default,
  }));

  /** Medicamento + Stock + Crít. + cada posta + Total */
  const colsTotales = 4 + postasActivas.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Medicamentos
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Stock general de medicamentos: referencias del catálogo y saldo por posta en el
            mes calendario ({mesStockEtiqueta}).
          </p>
        </div>
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Volver al panel
        </Link>
      </div>

      {!canEdit ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">Solo lectura</Badge>
          Tu rol no permite crear ni editar el catálogo.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudieron cargar los medicamentos: {error.message}
        </p>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-heading text-lg font-medium">
            Stock general de medicamentos
          </h2>
          {canEdit ? (
            <Dialog>
              <DialogTrigger render={<Button />}>
                Agregar medicamento
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nuevo medicamento</DialogTitle>
                </DialogHeader>
                <MedicamentoCreateForm />
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
        {medicamentos.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {medicamentos.length} medicamentos en el catálogo · {colsTotales} columnas
            (referencias del catálogo y una columna por cada posta activa).
          </p>
        ) : null}
        {medicamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay medicamentos en el catálogo.
          </p>
        ) : postasActivas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay postas activas. Crea postas en el menú «Postas» para ver la
            matriz.
          </p>
        ) : (
          <MedicamentosMatrizConsumo
            mesStockEtiqueta={mesStockEtiqueta}
            postas={postasActivas}
            medicamentos={medicamentosMatriz}
            stockFinalPorMedYPosta={stockFinalPorMedYPosta}
            puedeEditarFicha={canEdit}
          />
        )}
      </section>
    </div>
  );
}
