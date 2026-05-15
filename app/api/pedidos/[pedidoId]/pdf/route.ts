import { NextResponse } from "next/server";

export const runtime = "nodejs";

import { cantidadPedidoSegunStockReferencial } from "@/lib/domain/pedido-mensual";
import { buildPedidoMensualPdfBytes, type PedidoPdfLinea } from "@/lib/pdf/pedido-mensual-pdf";
import { snapshotLedgerMesPosta, type MedLedgerMin } from "@/lib/posta/snapshot-ledger-mes-posta";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteCtx = { params: Promise<{ pedidoId: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const { pedidoId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const { data: pedido, error: pe } = await supabase
    .from("pedidos_mensuales")
    .select("id, posta_id, anio, mes, estado, enviado_en")
    .eq("id", pedidoId)
    .maybeSingle();

  if (pe || !pedido || typeof pedido !== "object") {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const estado = String((pedido as { estado: string }).estado);
  if (estado === "BORRADOR") {
    return new NextResponse("El pedido aun no esta enviado.", { status: 400 });
  }

  const postaId = String((pedido as { posta_id: string }).posta_id);
  const anio = Number((pedido as { anio: number }).anio);
  const mes = Number((pedido as { mes: number }).mes);
  const enviadoEn = (pedido as { enviado_en: string | null }).enviado_en;

  const { data: postaRow } = await supabase
    .from("postas")
    .select("nombre, codigo")
    .eq("id", postaId)
    .maybeSingle();

  const postaNombre =
    postaRow && typeof postaRow === "object" && "nombre" in postaRow
      ? String((postaRow as { nombre: string }).nombre)
      : "Posta";
  const postaCodigo =
    postaRow && typeof postaRow === "object" && "codigo" in postaRow
      ? (postaRow as { codigo: string | null }).codigo
      : null;

  const { data: medsData } = await supabase
    .from("medicamentos")
    .select("id, nombre, codigo_interno, unidad_medida, stock_recomendado_default, stock_critico_default")
    .eq("activo", true)
    .order("nombre");

  const meds: MedLedgerMin[] = [];
  const medMeta: { id: string; nombre: string; codigo_interno: string; unidad_medida: string }[] = [];
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
      medMeta.push({
        id: r.id,
        nombre: typeof r.nombre === "string" ? r.nombre : "",
        codigo_interno: typeof r.codigo_interno === "string" ? r.codigo_interno : "",
        unidad_medida: typeof r.unidad_medida === "string" ? r.unidad_medida : "",
      });
    }
  }

  const snap = await snapshotLedgerMesPosta(supabase, postaId, anio, mes, meds);

  const { data: detalles } = await supabase
    .from("detalle_pedido_mensual")
    .select("medicamento_id, cantidad_sugerida, cantidad_final")
    .eq("pedido_id", pedidoId);

  const detMap = new Map<string, { sug: number; fin: number }>();
  if (detalles && Array.isArray(detalles)) {
    for (const d of detalles) {
      const r = d as Record<string, unknown>;
      if (typeof r.medicamento_id !== "string") continue;
      detMap.set(r.medicamento_id, {
        sug: Number.isFinite(Number(r.cantidad_sugerida))
          ? Math.max(0, Math.trunc(Number(r.cantidad_sugerida)))
          : 0,
        fin: Number.isFinite(Number(r.cantidad_final))
          ? Math.max(0, Math.trunc(Number(r.cantidad_final)))
          : 0,
      });
    }
  }

  const lineas: PedidoPdfLinea[] = [];
  for (const meta of medMeta) {
    const s = snap.get(meta.id);
    const disp = s?.disponible ?? 0;
    const ref = s?.stock_recomendado ?? 0;
    const sugCalc = cantidadPedidoSegunStockReferencial(disp, ref);
    const det = detMap.get(meta.id);
    lineas.push({
      nombre: meta.nombre,
      codigo_interno: meta.codigo_interno,
      unidad_medida: meta.unidad_medida,
      stock_recomendado: ref,
      disponible: disp,
      cantidad_sugerida: det?.sug ?? sugCalc,
      cantidad_final: det?.fin ?? sugCalc,
    });
  }

  const enviadoEnLabel = enviadoEn
    ? new Date(enviadoEn).toLocaleString("es-CL", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;

  const bytes = await buildPedidoMensualPdfBytes({
    postaNombre,
    postaCodigo,
    anio,
    mes,
    estado,
    enviadoEnLabel,
    lineas,
  });

  const safeName = `pedido-${anio}-${String(mes).padStart(2, "0")}-${postaNombre.slice(0, 24).replace(/[^\w\-]+/g, "_")}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
