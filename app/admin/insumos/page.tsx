import { redirect } from "next/navigation";

import { InsumosCatalogoPanel, type InsumoRow } from "@/components/admin/insumos-catalogo-panel";
import { PostaPageHeader } from "@/components/posta/posta-page-header";
import { esAdminGeneral, requirePerfilUsuario, tieneAccesoGlobalAdmin } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export default async function AdminInsumosPage() {
  const { profile } = await requirePerfilUsuario();

  if (!tieneAccesoGlobalAdmin(profile)) {
    redirect("/");
  }

  const puedeEditar = esAdminGeneral(profile);
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("insumos")
    .select("id, nombre, stock_objetivo, activo, updated_at")
    .order("nombre", { ascending: true });

  if (error) {
    return (
      <div className="space-y-4">
        <PostaPageHeader title="Catálogo de insumos" />
        <p className="text-sm text-destructive">Error al cargar insumos: {error.message}</p>
      </div>
    );
  }

  const insumos: InsumoRow[] = [];
  if (data && Array.isArray(data)) {
    for (const row of data) {
      const r = row as Record<string, unknown>;
      if (typeof r.id === "string" && typeof r.nombre === "string") {
        insumos.push({
          id: r.id,
          nombre: r.nombre,
          stock_objetivo: toInt(r.stock_objetivo),
          activo: r.activo === true,
          updated_at: typeof r.updated_at === "string" ? r.updated_at : null,
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      <PostaPageHeader
        title="Catálogo de insumos"
        description="Define los insumos y el stock que cada posta debe manejar. La encargada solo registra el stock actual al pedir."
      />
      <InsumosCatalogoPanel insumos={insumos} puedeEditar={puedeEditar} />
    </div>
  );
}
