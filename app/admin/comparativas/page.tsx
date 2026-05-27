import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { requirePerfilUsuario, tieneAccesoGlobalAdmin } from "@/lib/auth/session";
import { fechaCalendarioEnZonaIANA, ZONA_CALENDARIO_OPERACION } from "@/lib/domain/fecha-mes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ComparativasPanel } from "@/components/admin/comparativas-panel";

export const dynamic = "force-dynamic";

export default async function AdminComparativasPage() {
  const { profile } = await requirePerfilUsuario();

  if (!tieneAccesoGlobalAdmin(profile)) {
    redirect("/");
  }

  const supabase = await createServerSupabaseClient();
  const hoyStr = fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION);
  const [y, m, d] = hoyStr.split("-").map(Number);

  // Calcular el inicio del mes de hace 6 meses para tener 6 meses de datos
  let startYear = y;
  let startMonth = m - 5;
  if (startMonth <= 0) {
    startMonth += 12;
    startYear -= 1;
  }
  const inicioSeisMesesStr = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;

  const [
    { data: postasRows },
    { data: medsRows },
    { data: movsRows },
    { data: ingresosRows },
    { data: stockRows }
  ] = await Promise.all([
    supabase
      .from("postas")
      .select("id, nombre, codigo")
      .eq("activa", true)
      .order("nombre"),
    supabase
      .from("medicamentos")
      .select("id, nombre, unidad_medida, categoria")
      .eq("activo", true)
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true }),
    supabase
      .from("movimientos_diarios_consumo")
      .select("posta_id, medicamento_id, fecha, total_dia")
      .eq("anulado", false)
      .gte("fecha", inicioSeisMesesStr),
    supabase
      .from("ingresos_stock_mes")
      .select("posta_id, medicamento_id, fecha, cantidad")
      .eq("anulado", false)
      .gte("fecha", inicioSeisMesesStr),
    supabase
      .from("stock_mensual_posta")
      .select("posta_id, medicamento_id, stock_final, stock_recomendado_config, stock_critico_config")
      .eq("anio", y)
      .eq("mes", m)
  ]);

  const postas = (postasRows ?? []).map((p) => ({
    id: String(p.id),
    nombre: String(p.nombre ?? ""),
    codigo: p.codigo ? String(p.codigo) : null,
  }));

  const medicamentos = (medsRows ?? []).map((m) => ({
    id: String(m.id),
    nombre: String(m.nombre ?? ""),
    unidadMedida: String(m.unidad_medida ?? ""),
    categoria: String(m.categoria ?? "OTROS"),
  }));

  const movimientos = (movsRows ?? []).map((mov) => ({
    postaId: String(mov.posta_id),
    medicamentoId: String(mov.medicamento_id),
    fecha: String(mov.fecha),
    totalDia: Number(mov.total_dia ?? 0),
  }));

  const ingresos = (ingresosRows ?? []).map((ing) => ({
    postaId: String(ing.posta_id),
    medicamentoId: String(ing.medicamento_id),
    fecha: String(ing.fecha),
    cantidad: Number(ing.cantidad ?? 0),
  }));

  const stockActual = (stockRows ?? []).map((st) => ({
    postaId: String(st.posta_id),
    medicamentoId: String(st.medicamento_id),
    stockFinal: Number(st.stock_final ?? 0),
    stockRecomendado: Number(st.stock_recomendado_config ?? 0),
    stockCritico: Number(st.stock_critico_config ?? 0),
  }));

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Comparativas de Consumo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Análisis de consumo semanal, mensual e histórico para control de stock en las postas.
          </p>
        </div>
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
        >
          <ArrowLeft className="size-3.5" />
          Volver a supervisión
        </Link>
      </div>

      <ComparativasPanel
        postas={postas}
        medicamentos={medicamentos}
        movimientos={movimientos}
        ingresos={ingresos}
        stockActual={stockActual}
        hoyStr={hoyStr}
      />
    </div>
  );
}
