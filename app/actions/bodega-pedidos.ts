"use server";

import { revalidatePath } from "next/cache";

import { esBodegaFarmacia, requirePerfilUsuario } from "@/lib/auth/session";
import { registrarAuditLog } from "@/lib/audit/stock-audit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type BodegaPedidoActionState = {
  error?: string | null;
  ok?: boolean;
  success?: string | null;
};

export async function despacharPedidoMensualBodegaAction(
  _prev: BodegaPedidoActionState,
  formData: FormData
): Promise<BodegaPedidoActionState> {
  const ctx = await requirePerfilUsuario();
  if (!esBodegaFarmacia(ctx.profile)) {
    return { error: "Solo bodega farmacia puede despachar pedidos." };
  }

  const pedidoId = formData.get("pedido_id")?.toString().trim();
  if (!pedidoId) return { error: "Pedido no válido." };

  const supabase = await createServerSupabaseClient();
  const { data: row, error: selErr } = await supabase
    .from("pedidos_mensuales")
    .select("id, posta_id, estado")
    .eq("id", pedidoId)
    .maybeSingle();

  if (selErr || !row || typeof row !== "object") {
    return { error: "No se encontró el pedido." };
  }

  const estado = (row as { estado: string }).estado;
  if (estado !== "APROBADO") {
    return { error: "Solo se pueden despachar pedidos en estado Aprobado." };
  }

  const postaId = (row as { posta_id: string }).posta_id;
  const now = new Date().toISOString();

  const { error: upErr } = await supabase
    .from("pedidos_mensuales")
    .update({ estado: "DESPACHADO", despachado_en: now })
    .eq("id", pedidoId)
    .eq("estado", "APROBADO");

  if (upErr) return { error: upErr.message };

  await registrarAuditLog(supabase, {
    actorId: ctx.user.id,
    action: "pedido_mensual.despachado_bodega",
    entity: "pedidos_mensuales",
    entityId: pedidoId,
    metadata: { postaId },
  });

  revalidatePath("/bodega");
  revalidatePath(`/postas/${postaId}/pedidos`);
  revalidatePath("/admin/pedidos");
  return { ok: true, success: "Pedido marcado como despachado." };
}

export async function despacharPedidoInsumosBodegaAction(
  _prev: BodegaPedidoActionState,
  formData: FormData
): Promise<BodegaPedidoActionState> {
  const ctx = await requirePerfilUsuario();
  if (!esBodegaFarmacia(ctx.profile)) {
    return { error: "Solo bodega farmacia puede despachar pedidos." };
  }

  const pedidoId = formData.get("pedido_id")?.toString().trim();
  if (!pedidoId) return { error: "Pedido no válido." };

  const supabase = await createServerSupabaseClient();
  const { data: row, error: selErr } = await supabase
    .from("pedidos_insumos")
    .select("id, posta_id, estado")
    .eq("id", pedidoId)
    .maybeSingle();

  if (selErr || !row || typeof row !== "object") {
    return { error: "No se encontró el pedido." };
  }

  const estado = (row as { estado: string }).estado;
  if (estado !== "APROBADO") {
    return { error: "Solo se pueden despachar pedidos en estado Aprobado." };
  }

  const postaId = (row as { posta_id: string }).posta_id;
  const now = new Date().toISOString();

  const { error: upErr } = await supabase
    .from("pedidos_insumos")
    .update({
      estado: "DESPACHADO",
      despachado_en: now,
      comentario_posta: null,
    })
    .eq("id", pedidoId)
    .eq("estado", "APROBADO");

  if (upErr) return { error: upErr.message };

  await registrarAuditLog(supabase, {
    actorId: ctx.user.id,
    action: "pedido_insumos.despachado_bodega",
    entity: "pedidos_insumos",
    entityId: pedidoId,
    metadata: { postaId },
  });

  revalidatePath("/bodega");
  revalidatePath(`/postas/${postaId}/insumos`);
  revalidatePath("/admin/pedidos-insumos");
  return { ok: true, success: "Pedido de insumos marcado como despachado." };
}
