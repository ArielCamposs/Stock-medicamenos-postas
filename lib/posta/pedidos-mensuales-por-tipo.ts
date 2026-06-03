import type { TipoPedido } from "@/app/actions/pedido-mensual";
import { postaEnvioPedidoMensualHoy } from "@/lib/posta/reglas-repeticion-dia";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseSrv = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type PedidoMensualCabecera = {
  id: string;
  estado: string;
  enviado_en: string | null;
  despachado_en: string | null;
  tipo: TipoPedido | null;
  fecha_creacion: string | null;
  comentario_posta: string | null;
};

export type PedidoMensualVistaTipo = {
  /** Pedido a mostrar; null = formulario nuevo para otro envío del mes. */
  pedido: PedidoMensualCabecera | null;
  pedidoEnProceso: boolean;
  pedidoEnviadoHoy: boolean;
};

export type PedidosMensualesMes = {
  general: PedidoMensualVistaTipo;
  contraReceta: PedidoMensualVistaTipo;
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
  const fecha_creacion =
    row.fecha_creacion === null || typeof row.fecha_creacion === "string"
      ? (row.fecha_creacion as string | null)
      : null;
  const comentario_posta =
    row.comentario_posta === null || typeof row.comentario_posta === "string"
      ? (row.comentario_posta as string | null)
      : null;
  const despachado_en =
    row.despachado_en === null || typeof row.despachado_en === "string"
      ? (row.despachado_en as string | null)
      : null;
  return { id: row.id, estado, enviado_en, despachado_en, tipo, fecha_creacion, comentario_posta };
}

const EN_PROCESO = new Set(["ENVIADO", "APROBADO", "DESPACHADO"]);

function resolverVistaPedidoTipo(
  filas: PedidoMensualCabecera[],
  pedidoEnviadoHoy: boolean
): Omit<PedidoMensualVistaTipo, "pedidoEnviadoHoy"> {
  const byRecency = [...filas].sort((a, b) => {
    const ta = a.fecha_creacion ?? a.enviado_en ?? "";
    const tb = b.fecha_creacion ?? b.enviado_en ?? "";
    return tb.localeCompare(ta);
  });

  for (const p of byRecency) {
    if (p.estado === "OBSERVADO") {
      return { pedido: p, pedidoEnProceso: false };
    }
  }
  for (const p of byRecency) {
    if (p.estado === "BORRADOR") {
      return { pedido: p, pedidoEnProceso: false };
    }
  }
  const despachados = byRecency.filter((p) => p.estado === "DESPACHADO");
  if (despachados.length > 0) {
    const primero = [...despachados].sort((a, b) =>
      (a.despachado_en ?? "9999").localeCompare(b.despachado_en ?? "9999")
    )[0];
    return { pedido: primero, pedidoEnProceso: true };
  }
  for (const p of byRecency) {
    if (EN_PROCESO.has(p.estado)) {
      return { pedido: p, pedidoEnProceso: true };
    }
  }
  if (pedidoEnviadoHoy) {
    return { pedido: byRecency[0] ?? null, pedidoEnProceso: false };
  }
  return { pedido: null, pedidoEnProceso: false };
}

/**
 * Carga pedidos del mes y resuelve cuál mostrar por tipo (general / contra receta).
 * Permite varios pedidos por mes; el límite diario se aplica al enviar.
 */
export async function cargarPedidosMensualesMes(
  supabase: SupabaseSrv,
  postaId: string,
  anio: number,
  mes: number
): Promise<PedidosMensualesMes> {
  const { data, error } = await supabase
    .from("pedidos_mensuales")
    .select("id, estado, enviado_en, despachado_en, tipo, fecha_creacion, comentario_posta")
    .eq("posta_id", postaId)
    .eq("anio", anio)
    .eq("mes", mes)
    .order("fecha_creacion", { ascending: false });

  if (error) {
    const msg = error.message ?? "";
    if (/tipo/i.test(msg) && /column|schema/i.test(msg)) {
      const legacy = await supabase
        .from("pedidos_mensuales")
        .select("id, estado, enviado_en, fecha_creacion")
        .eq("posta_id", postaId)
        .eq("anio", anio)
        .eq("mes", mes)
        .order("fecha_creacion", { ascending: false });
      if (legacy.error) {
        return {
          general: { pedido: null, pedidoEnProceso: false, pedidoEnviadoHoy: false },
          contraReceta: { pedido: null, pedidoEnProceso: false, pedidoEnviadoHoy: false },
          error: legacy.error.message,
        };
      }
      const filas = (legacy.data ?? [])
        .map((r) => parseFila({ ...(r as Record<string, unknown>), tipo: "GENERAL" }))
        .filter((x): x is PedidoMensualCabecera => x !== null);
      const enviadoHoy = await postaEnvioPedidoMensualHoy(supabase, postaId, "GENERAL", null);
      const vista = resolverVistaPedidoTipo(filas, enviadoHoy);
      return {
        general: { ...vista, pedidoEnviadoHoy: enviadoHoy },
        contraReceta: { pedido: null, pedidoEnProceso: false, pedidoEnviadoHoy: false },
        error: null,
      };
    }
    return {
      general: { pedido: null, pedidoEnProceso: false, pedidoEnviadoHoy: false },
      contraReceta: { pedido: null, pedidoEnProceso: false, pedidoEnviadoHoy: false },
      error: msg,
    };
  }

  const generalFilas: PedidoMensualCabecera[] = [];
  const contraFilas: PedidoMensualCabecera[] = [];

  for (const row of data ?? []) {
    const parsed = parseFila(row as Record<string, unknown>);
    if (!parsed) continue;
    if (parsed.tipo === "CONTRA_RECETA") {
      contraFilas.push(parsed);
    } else {
      generalFilas.push({ ...parsed, tipo: "GENERAL" });
    }
  }

  const [enviadoHoyGeneral, enviadoHoyContra] = await Promise.all([
    postaEnvioPedidoMensualHoy(supabase, postaId, "GENERAL", null),
    postaEnvioPedidoMensualHoy(supabase, postaId, "CONTRA_RECETA", null),
  ]);

  const generalVista = resolverVistaPedidoTipo(generalFilas, enviadoHoyGeneral);
  const contraVista = resolverVistaPedidoTipo(contraFilas, enviadoHoyContra);

  return {
    general: { ...generalVista, pedidoEnviadoHoy: enviadoHoyGeneral },
    contraReceta: { ...contraVista, pedidoEnviadoHoy: enviadoHoyContra },
    error: null,
  };
}
