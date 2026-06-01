import type { TipoPedido } from "@/app/actions/pedido-mensual";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseSrv = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type PedidoMensualCabecera = {
  id: string;
  estado: string;
  enviado_en: string | null;
  tipo: TipoPedido | null;
};

export type PedidosMensualesMes = {
  general: PedidoMensualCabecera | null;
  contraReceta: PedidoMensualCabecera | null;
  error: string | null;
};

function parseFila(row: Record<string, unknown>): PedidoMensualCabecera | null {
  if (typeof row.id !== "string") return null;
  const estado = typeof row.estado === "string" ? row.estado : "BORRADOR";
  const enviado_en =
    row.enviado_en === null || typeof row.enviado_en === "string"
      ? (row.enviado_en as string | null)
      : null;
  const tipoRaw = row.tipo;
  const tipo: TipoPedido | null =
    tipoRaw === "CONTRA_RECETA" ? "CONTRA_RECETA" : tipoRaw === "GENERAL" ? "GENERAL" : null;
  return { id: row.id, estado, enviado_en, tipo };
}

/**
 * Carga todos los pedidos del mes y los separa por tipo en código.
 * Así el pedido general enviado nunca se asocia al tab contra receta.
 */
export async function cargarPedidosMensualesMes(
  supabase: SupabaseSrv,
  postaId: string,
  anio: number,
  mes: number
): Promise<PedidosMensualesMes> {
  const { data, error } = await supabase
    .from("pedidos_mensuales")
    .select("id, estado, enviado_en, tipo")
    .eq("posta_id", postaId)
    .eq("anio", anio)
    .eq("mes", mes);

  if (error) {
    const msg = error.message ?? "";
    if (/tipo/i.test(msg) && /column|schema/i.test(msg)) {
      const legacy = await supabase
        .from("pedidos_mensuales")
        .select("id, estado, enviado_en")
        .eq("posta_id", postaId)
        .eq("anio", anio)
        .eq("mes", mes);
      if (legacy.error) {
        return { general: null, contraReceta: null, error: legacy.error.message };
      }
      const filas = (legacy.data ?? [])
        .map((r) => parseFila(r as Record<string, unknown>))
        .filter((x): x is PedidoMensualCabecera => x !== null);
      const unico = filas.length === 1 ? filas[0] : filas[0] ?? null;
      return {
        general: unico ? { ...unico, tipo: "GENERAL" } : null,
        contraReceta: null,
        error: null,
      };
    }
    return { general: null, contraReceta: null, error: msg };
  }

  let general: PedidoMensualCabecera | null = null;
  let contraReceta: PedidoMensualCabecera | null = null;

  for (const row of data ?? []) {
    const parsed = parseFila(row as Record<string, unknown>);
    if (!parsed) continue;
    if (parsed.tipo === "CONTRA_RECETA") {
      contraReceta = parsed;
    } else {
      if (!general) general = { ...parsed, tipo: "GENERAL" };
    }
  }

  return { general, contraReceta, error: null };
}
