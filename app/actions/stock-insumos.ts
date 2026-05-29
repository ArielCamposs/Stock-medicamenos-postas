"use server";

import { revalidatePath } from "next/cache";

import {
  puedeRegistrarStockYAvisPosta,
  requirePerfilUsuario,
} from "@/lib/auth/session";
import { registrarAuditLog } from "@/lib/audit/stock-audit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StockInsumosActionState = {
  error?: string | null;
  ok?: boolean;
  success?: string | null;
};

async function assertPuedeEditarStockInsumos(postaId: string) {
  const ctx = await requirePerfilUsuario();
  if (!puedeRegistrarStockYAvisPosta(ctx.profile, postaId)) {
    return {
      ok: false as const,
      error: "No tienes permiso para registrar stock de insumos en esta posta.",
    };
  }
  return { ok: true as const, userId: ctx.user.id };
}

export async function guardarStockInsumosPostaAction(
  postaId: string,
  _prev: StockInsumosActionState,
  formData: FormData
): Promise<StockInsumosActionState> {
  const gate = await assertPuedeEditarStockInsumos(postaId);
  if (!gate.ok) return { error: gate.error };

  const rawIds = formData.get("insumo_ids_json")?.toString();
  let insumoIds: string[] = [];
  try {
    const parsed = rawIds ? JSON.parse(rawIds) : [];
    if (!Array.isArray(parsed)) throw new Error("not array");
    insumoIds = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return { error: "Datos del formulario inválidos. Recarga la página." };
  }

  if (insumoIds.length === 0) {
    return { error: "No hay insumos en el catálogo activo." };
  }

  const supabase = await createServerSupabaseClient();

  const { data: insumosActivos } = await supabase
    .from("insumos")
    .select("id")
    .eq("activo", true);

  const activosSet = new Set<string>();
  for (const row of insumosActivos ?? []) {
    const r = row as Record<string, unknown>;
    if (typeof r.id === "string") activosSet.add(r.id);
  }

  for (const id of insumoIds) {
    if (!activosSet.has(id)) {
      return { error: "El catálogo de insumos cambió. Recarga la página." };
    }
  }

  const { data: prevRows } = await supabase
    .from("stock_insumos_posta")
    .select("insumo_id, cantidad")
    .eq("posta_id", postaId)
    .in("insumo_id", insumoIds);

  const prevMap = new Map<string, number>();
  if (Array.isArray(prevRows)) {
    for (const row of prevRows) {
      const r = row as Record<string, unknown>;
      if (typeof r.insumo_id === "string") {
        const n = Number(r.cantidad);
        prevMap.set(r.insumo_id, Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0);
      }
    }
  }

  const rows: { posta_id: string; insumo_id: string; cantidad: number }[] = [];
  for (const insumoId of insumoIds) {
    const raw = formData.get(`stock_${insumoId}`)?.toString() ?? "";
    const t = raw.trim();
    const n = t === "" ? 0 : Number.parseInt(t.replace(/\s+/g, ""), 10);
    if (Number.isNaN(n) || n < 0) {
      return { error: "Todas las cantidades deben ser números enteros mayores o iguales a 0." };
    }
    rows.push({ posta_id: postaId, insumo_id: insumoId, cantidad: n });
  }

  const { error } = await supabase.from("stock_insumos_posta").upsert(rows, {
    onConflict: "posta_id,insumo_id",
  });
  if (error) return { error: error.message };

  const cambios = rows
    .filter((r) => (prevMap.get(r.insumo_id) ?? null) !== r.cantidad)
    .map((r) => ({
      insumoId: r.insumo_id,
      anterior: prevMap.get(r.insumo_id) ?? null,
      nuevo: r.cantidad,
    }));

  if (cambios.length > 0) {
    await registrarAuditLog(supabase, {
      actorId: gate.userId,
      action: "stock_insumos.guardar",
      entity: "stock_insumos_posta",
      metadata: { postaId, cambios },
    });
  }

  revalidatePath(`/postas/${postaId}/dashboard`);
  revalidatePath(`/postas/${postaId}/insumos`);
  return { ok: true, success: "Stock de insumos guardado." };
}

/** Sincroniza stock actual al enviar o corregir un pedido de insumos. */
export async function sincronizarStockInsumosDesdePedido(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  postaId: string,
  lineas: { insumoId: string; stockActual: number }[]
): Promise<void> {
  if (lineas.length === 0) return;
  const rows = lineas.map((l) => ({
    posta_id: postaId,
    insumo_id: l.insumoId,
    cantidad: Math.max(0, Math.trunc(l.stockActual)),
  }));
  await supabase.from("stock_insumos_posta").upsert(rows, {
    onConflict: "posta_id,insumo_id",
  });
}
