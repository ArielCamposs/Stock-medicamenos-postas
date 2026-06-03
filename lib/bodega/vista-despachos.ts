import {
  etiquetaInstanteChile24h,
  fechaCalendarioEnZonaIANA,
  ZONA_CALENDARIO_OPERACION,
} from "@/lib/domain/fecha-mes";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseSrv = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type BodegaDespachoFila = {
  id: string;
  postaId: string;
  tipo: "medicamentos" | "insumos";
  postaNombre: string;
  postaCodigo: string | null;
  mesTitulo: string;
  /** Fecha calendario Chile del despacho (YYYY-MM-DD), para filtros. */
  fechaDespachoCalendario: string;
  despachadoEnMs: number;
  despachadoEtiqueta: string;
  estado: "DESPACHADO" | "RECIBIDO";
  nLineas: number;
  totalUnidades: number;
  pedidoTipo?: "GENERAL" | "CONTRA_RECETA";
};

export type BodegaPedidoPendienteFila = {
  id: string;
  tipo: "medicamentos" | "insumos";
  postaNombre: string;
  postaCodigo: string | null;
  mesTitulo: string;
  enviadoEtiqueta: string;
  nLineas: number;
  totalUnidades: number;
  pedidoTipo?: "GENERAL" | "CONTRA_RECETA";
};

export type BodegaPostaOpcion = {
  id: string;
  nombre: string;
  codigo: string | null;
};

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function tituloMes(anio: number, mes: number) {
  return new Date(anio, mes - 1, 1).toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
}

function etiquetaFecha(iso: string | null | undefined) {
  if (!iso || typeof iso !== "string") return "—";
  return etiquetaInstanteChile24h(iso);
}

function fechaCalendarioDesdeIso(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION, new Date(ms));
}

function inicioHistorialIso(): string {
  const hoy = fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(hoy);
  if (!m) return new Date(Date.now() - 365 * 86400000).toISOString();
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const ref = new Date(anio, mes - 1, dia);
  ref.setMonth(ref.getMonth() - 12);
  return ref.toISOString();
}

async function totalesDetalleMed(
  supabase: SupabaseSrv,
  pedidoIds: string[]
): Promise<Map<string, { n: number; u: number }>> {
  const map = new Map<string, { n: number; u: number }>();
  if (pedidoIds.length === 0) return map;
  const { data } = await supabase
    .from("detalle_pedido_mensual")
    .select("pedido_id, cantidad_final")
    .in("pedido_id", pedidoIds)
    .gt("cantidad_final", 0);
  if (data && Array.isArray(data)) {
    for (const row of data) {
      const r = row as Record<string, unknown>;
      const pid = typeof r.pedido_id === "string" ? r.pedido_id : null;
      if (!pid) continue;
      const prev = map.get(pid) ?? { n: 0, u: 0 };
      prev.n += 1;
      prev.u += toInt(r.cantidad_final);
      map.set(pid, prev);
    }
  }
  return map;
}

async function totalesDetalleIns(
  supabase: SupabaseSrv,
  pedidoIds: string[]
): Promise<Map<string, { n: number; u: number }>> {
  const map = new Map<string, { n: number; u: number }>();
  if (pedidoIds.length === 0) return map;
  const { data } = await supabase
    .from("detalle_pedido_insumos")
    .select("pedido_id, cantidad_pedido")
    .in("pedido_id", pedidoIds)
    .gt("cantidad_pedido", 0);
  if (data && Array.isArray(data)) {
    for (const row of data) {
      const r = row as Record<string, unknown>;
      const pid = typeof r.pedido_id === "string" ? r.pedido_id : null;
      if (!pid) continue;
      const prev = map.get(pid) ?? { n: 0, u: 0 };
      prev.n += 1;
      prev.u += toInt(r.cantidad_pedido);
      map.set(pid, prev);
    }
  }
  return map;
}

function metaPosta(row: Record<string, unknown>): {
  postaId: string;
  nombre: string;
  codigo: string | null;
} {
  const postaId = typeof row.posta_id === "string" ? row.posta_id : "";
  const posta = row.postas as Record<string, unknown> | null;
  return {
    postaId,
    nombre: posta && typeof posta.nombre === "string" ? posta.nombre : "Posta",
    codigo:
      posta && (posta.codigo === null || typeof posta.codigo === "string")
        ? (posta.codigo as string | null)
        : null,
  };
}

export async function cargarVistaBodega(supabase: SupabaseSrv): Promise<{
  pendientes: BodegaPedidoPendienteFila[];
  historial: BodegaDespachoFila[];
  postas: BodegaPostaOpcion[];
  errorHistorial: string | null;
}> {
  const historialDesde = inicioHistorialIso();

  const [
    { data: medsAprob },
    { data: insAprob },
    { data: medsHist, error: errMedHist },
    { data: insHist, error: errInsHist },
    { data: postasRows },
  ] = await Promise.all([
    supabase
      .from("pedidos_mensuales")
      .select("id, posta_id, anio, mes, tipo, enviado_en, postas ( nombre, codigo )")
      .eq("estado", "APROBADO")
      .order("enviado_en", { ascending: true }),
    supabase
      .from("pedidos_insumos")
      .select("id, posta_id, enviado_en, postas ( nombre, codigo )")
      .eq("estado", "APROBADO")
      .order("enviado_en", { ascending: true }),
    supabase
      .from("pedidos_mensuales")
      .select(
        "id, posta_id, anio, mes, tipo, estado, despachado_en, postas ( nombre, codigo )"
      )
      .in("estado", ["DESPACHADO", "RECIBIDO"])
      .not("despachado_en", "is", null)
      .gte("despachado_en", historialDesde)
      .order("despachado_en", { ascending: false }),
    supabase
      .from("pedidos_insumos")
      .select("id, posta_id, estado, despachado_en, postas ( nombre, codigo )")
      .in("estado", ["DESPACHADO", "RECIBIDO"])
      .not("despachado_en", "is", null)
      .gte("despachado_en", historialDesde)
      .order("despachado_en", { ascending: false }),
    supabase
      .from("postas")
      .select("id, nombre, codigo")
      .eq("activa", true)
      .order("nombre", { ascending: true }),
  ]);

  const errorHistorial =
    errMedHist?.message ?? errInsHist?.message ?? null;

  const pendienteMedIds = (medsAprob ?? [])
    .map((r) => String((r as { id: unknown }).id))
    .filter((id) => id && id !== "undefined");
  const pendienteInsIds = (insAprob ?? [])
    .map((r) => String((r as { id: unknown }).id))
    .filter((id) => id && id !== "undefined");

  const histMedIds = (medsHist ?? [])
    .map((r) => String((r as { id: unknown }).id))
    .filter((id) => id && id !== "undefined");
  const histInsIds = (insHist ?? [])
    .map((r) => String((r as { id: unknown }).id))
    .filter((id) => id && id !== "undefined");

  const [totalesPendMed, totalesPendIns, totalesHistMed, totalesHistIns] = await Promise.all([
    totalesDetalleMed(supabase, pendienteMedIds),
    totalesDetalleIns(supabase, pendienteInsIds),
    totalesDetalleMed(supabase, histMedIds),
    totalesDetalleIns(supabase, histInsIds),
  ]);

  const pendientes: BodegaPedidoPendienteFila[] = [];

  for (const row of medsAprob ?? []) {
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : null;
    if (!id) continue;
    const { nombre, codigo } = metaPosta(r);
    const tot = totalesPendMed.get(id) ?? { n: 0, u: 0 };
    pendientes.push({
      id,
      tipo: "medicamentos",
      postaNombre: nombre,
      postaCodigo: codigo,
      mesTitulo: tituloMes(toInt(r.anio), toInt(r.mes)),
      enviadoEtiqueta: etiquetaFecha(r.enviado_en as string | null),
      nLineas: tot.n,
      totalUnidades: tot.u,
      pedidoTipo: r.tipo === "CONTRA_RECETA" ? "CONTRA_RECETA" : "GENERAL",
    });
  }

  for (const row of insAprob ?? []) {
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : null;
    if (!id) continue;
    const { nombre, codigo } = metaPosta(r);
    const tot = totalesPendIns.get(id) ?? { n: 0, u: 0 };
    pendientes.push({
      id,
      tipo: "insumos",
      postaNombre: nombre,
      postaCodigo: codigo,
      mesTitulo: "Pedido de insumos",
      enviadoEtiqueta: etiquetaFecha(r.enviado_en as string | null),
      nLineas: tot.n,
      totalUnidades: tot.u,
    });
  }

  pendientes.sort((a, b) => a.postaNombre.localeCompare(b.postaNombre, "es"));

  const historial: BodegaDespachoFila[] = [];

  for (const row of medsHist ?? []) {
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : null;
    const desp = typeof r.despachado_en === "string" ? r.despachado_en : null;
    if (!id || !desp) continue;
    const estadoRaw = r.estado === "RECIBIDO" ? "RECIBIDO" : "DESPACHADO";
    const { postaId, nombre, codigo } = metaPosta(r);
    const tot = totalesHistMed.get(id) ?? { n: 0, u: 0 };
    historial.push({
      id,
      postaId,
      tipo: "medicamentos",
      postaNombre: nombre,
      postaCodigo: codigo,
      mesTitulo: tituloMes(toInt(r.anio), toInt(r.mes)),
      fechaDespachoCalendario: fechaCalendarioDesdeIso(desp),
      despachadoEnMs: Date.parse(desp),
      despachadoEtiqueta: etiquetaFecha(desp),
      estado: estadoRaw,
      nLineas: tot.n,
      totalUnidades: tot.u,
      pedidoTipo: r.tipo === "CONTRA_RECETA" ? "CONTRA_RECETA" : "GENERAL",
    });
  }

  for (const row of insHist ?? []) {
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : null;
    const desp = typeof r.despachado_en === "string" ? r.despachado_en : null;
    if (!id || !desp) continue;
    const estadoRaw = r.estado === "RECIBIDO" ? "RECIBIDO" : "DESPACHADO";
    const { postaId, nombre, codigo } = metaPosta(r);
    const tot = totalesHistIns.get(id) ?? { n: 0, u: 0 };
    historial.push({
      id,
      postaId,
      tipo: "insumos",
      postaNombre: nombre,
      postaCodigo: codigo,
      mesTitulo: "Pedido de insumos",
      fechaDespachoCalendario: fechaCalendarioDesdeIso(desp),
      despachadoEnMs: Date.parse(desp),
      despachadoEtiqueta: etiquetaFecha(desp),
      estado: estadoRaw,
      nLineas: tot.n,
      totalUnidades: tot.u,
    });
  }

  historial.sort((a, b) => b.despachadoEnMs - a.despachadoEnMs);

  const postas: BodegaPostaOpcion[] = [];
  if (postasRows && Array.isArray(postasRows)) {
    for (const row of postasRows) {
      const r = row as Record<string, unknown>;
      if (typeof r.id !== "string") continue;
      const nombre = typeof r.nombre === "string" ? r.nombre.trim() : "";
      postas.push({
        id: r.id,
        nombre: nombre || `Posta (${r.id.slice(0, 8)}…)`,
        codigo:
          r.codigo === null || typeof r.codigo === "string"
            ? (r.codigo as string | null)
            : null,
      });
    }
  }

  return { pendientes, historial, postas, errorHistorial };
}

/** Rango por defecto en filtros: primer día del mes actual → hoy (Chile). */
export function rangoFechasFiltroHistorialBodega(): { desde: string; hasta: string } {
  const hasta = fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION);
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(hasta);
  if (!m) return { desde: hasta, hasta };
  return { desde: `${m[1]}-${m[2]}-01`, hasta };
}
