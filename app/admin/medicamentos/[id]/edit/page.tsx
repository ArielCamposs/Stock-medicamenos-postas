import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MedicamentoRowForm } from "@/components/admin/medicamento-row-form";
import type { MedicamentoRow } from "@/components/admin/medicamento-row-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { esAdminGeneral, requirePerfilUsuario } from "@/lib/auth/session";
import { normalizarMedicamentoCategoria } from "@/lib/domain/medicamento-categoria";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  return null;
}

export default async function AdminMedicamentoEditPage({ params }: PageProps) {
  const { id } = await params;
  const { profile } = await requirePerfilUsuario();

  if (!esAdminGeneral(profile)) {
    redirect("/admin/medicamentos");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("medicamentos")
    .select(
      "id,nombre,codigo_interno,codigo_avis,unidad_medida,categoria,stock_recomendado_default,stock_critico_default,activo,updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data || typeof data !== "object") {
    notFound();
  }

  const r = data as Record<string, unknown>;
  const rec = toInt(r.stock_recomendado_default);
  const crit = toInt(r.stock_critico_default);

  if (
    typeof r.id !== "string" ||
    typeof r.nombre !== "string" ||
    typeof r.codigo_interno !== "string" ||
    typeof r.unidad_medida !== "string" ||
    typeof r.activo !== "boolean" ||
    typeof r.updated_at !== "string" ||
    rec === null ||
    crit === null
  ) {
    notFound();
  }

  const medicamento: MedicamentoRow = {
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
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {medicamento.nombre}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">
            Edita los datos del catálogo global. El desglose por posta está en el
            listado principal de medicamentos.
          </p>
        </div>
        <Link
          href="/admin/medicamentos"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Volver al listado
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Editar medicamento</CardTitle>
          <CardDescription>
            Códigos, unidad de medida y umbrales por defecto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MedicamentoRowForm medicamento={medicamento} />
        </CardContent>
      </Card>
    </div>
  );
}
