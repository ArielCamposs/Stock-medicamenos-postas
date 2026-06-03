import type { PedidoPdfLinea } from "@/lib/pdf/pedido-mensual-pdf";
import { cargarDetallePedidoMensual } from "@/lib/posta/pedido-mensual-detalle";
import { snapshotLedgerMesPosta, type MedLedgerMin } from "@/lib/posta/snapshot-ledger-mes-posta";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseSrv = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export async function cargarDatosPdfPedidoMensual(
  supabase: SupabaseSrv,
  pedidoId: string
): Promise<
  | {
      ok: true;
      postaNombre: string;
      postaCodigo: string | null;
      anio: number;
      mes: number;
      estado: string;
      tipo: "GENERAL" | "CONTRA_RECETA";
      enviadoEnLabel: string | null;
      lineas: PedidoPdfLinea[];
    }
  | { ok: false; error: string; status: number }
> {
  const det = await cargarDetallePedidoMensual(supabase, pedidoId);
  if (!det.ok) return det;

  const { data } = det;
  if (data.estado === "BORRADOR") {
    return { ok: false, error: "El pedido aún no está enviado.", status: 400 };
  }

  const medIds = data.lineas.map((l) => l.medicamentoId);
  const meds: MedLedgerMin[] = [];
  if (medIds.length > 0) {
    const { data: medsData } = await supabase
      .from("medicamentos")
      .select("id, stock_recomendado_default, stock_critico_default")
      .in("id", medIds);
    if (medsData && Array.isArray(medsData)) {
      for (const row of medsData) {
        const r = row as Record<string, unknown>;
        if (typeof r.id !== "string") continue;
        const rec = Number(r.stock_recomendado_default);
        const crit = Number(r.stock_critico_default);
        meds.push({
          id: r.id,
          stock_recomendado_default: Number.isFinite(rec) ? Math.max(0, Math.trunc(rec)) : 0,
          stock_critico_default: Number.isFinite(crit) ? Math.max(0, Math.trunc(crit)) : 0,
        });
      }
    }
  }

  const snap = await snapshotLedgerMesPosta(supabase, data.postaId, data.anio, data.mes, meds);

  const lineas: PedidoPdfLinea[] = data.lineas.map((l) => {
    const s = snap.get(l.medicamentoId);
    const disp = s?.disponible ?? 0;
    const ref = s?.stock_recomendado ?? 0;
    return {
      nombre: l.nombre,
      codigo_interno: l.codigo_interno,
      unidad_medida: l.unidad_medida,
      categoria: l.categoria,
      stock_recomendado: ref,
      disponible: disp,
      cantidad_sugerida: l.cantidad_sugerida,
      cantidad_final: l.cantidad_final,
    };
  });

  const enviadoEnLabel = data.enviadoEn
    ? new Date(data.enviadoEn).toLocaleString("es-CL", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;

  return {
    ok: true,
    postaNombre: data.postaNombre,
    postaCodigo: data.postaCodigo,
    anio: data.anio,
    mes: data.mes,
    estado: data.estado,
    tipo: data.tipo,
    enviadoEnLabel,
    lineas,
  };
}
