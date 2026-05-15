"use server";

import { revalidatePath } from "next/cache";

import {
  esAdminGeneral,
  puedeGestionarPedidoMensualPosta,
  puedeVerPosta,
  requirePerfilUsuario,
} from "@/lib/auth/session";
import { registrarAuditLog } from "@/lib/audit/stock-audit";
import { cantidadPedidoSegunStockReferencial } from "@/lib/domain/pedido-mensual";
import { snapshotLedgerMesPosta, type MedLedgerMin } from "@/lib/posta/snapshot-ledger-mes-posta";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PedidoMensualActionState = {
  error?: string | null;
  ok?: boolean;
  success?: string | null;
};

type SupabaseSrv = Awaited<ReturnType<typeof createServerSupabaseClient>>;

async function assertEncargadoPosta(postaId: string) {
  const ctx = await requirePerfilUsuario();
  if (!puedeVerPosta(ctx.profile, postaId)) {
    return { ok: false as const, error: "No tienes permiso para esta posta." };
  }
  if (!puedeGestionarPedidoMensualPosta(ctx.profile, postaId)) {
    return {
      ok: false as const,
      error: "Solo el encargado de la posta puede gestionar el pedido mensual.",
    };
  }
  return { ok: true as const, userId: ctx.user.id };
}

async function cargarMedicamentosActivosLedger(supabase: SupabaseSrv): Promise<MedLedgerMin[]> {
  const { data, error } = await supabase
    .from("medicamentos")
    .select("id, stock_recomendado_default, stock_critico_default")
    .eq("activo", true);
  if (error || !data) return [];
  const out: MedLedgerMin[] = [];
  for (const row of data) {
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string") continue;
    const rec = Number(r.stock_recomendado_default);
    const crit = Number(r.stock_critico_default);
    out.push({
      id: r.id,
      stock_recomendado_default: Number.isFinite(rec) ? Math.max(0, Math.trunc(rec)) : 0,
      stock_critico_default: Number.isFinite(crit) ? Math.max(0, Math.trunc(crit)) : 0,
    });
  }
  return out;
}

function parseCantidadesForm(
  formData: FormData,
  medicamentoIds: string[]
): { ok: true; cantidades: Map<string, number> } | { ok: false; error: string } {
  const cantidades = new Map<string, number>();
  for (const id of medicamentoIds) {
    const raw = formData.get(`final_${id}`)?.toString() ?? "";
    const t = raw.trim();
    if (t === "") {
      return { ok: false, error: "Todas las cantidades de pedido deben tener un numero." };
    }
    const n = Number.parseInt(t, 10);
    if (Number.isNaN(n) || n < 0) {
      return { ok: false, error: "Las cantidades deben ser enteros mayores o iguales a 0." };
    }
    cantidades.set(id, n);
  }
  return { ok: true, cantidades };
}

async function obtenerOCrearPedidoBorrador(
  supabase: SupabaseSrv,
  postaId: string,
  anio: number,
  mes: number,
  userId: string
): Promise<{ ok: true; pedidoId: string } | { ok: false; error: string }> {
  const { data: row } = await supabase
    .from("pedidos_mensuales")
    .select("id, estado")
    .eq("posta_id", postaId)
    .eq("anio", anio)
    .eq("mes", mes)
    .maybeSingle();

  if (row && typeof row === "object" && "id" in row && typeof (row as { id: unknown }).id === "string") {
    const estado = (row as { estado?: string }).estado;
    if (estado !== "BORRADOR" && estado !== "OBSERVADO") {
      return {
        ok: false,
        error: "Este pedido ya no está en borrador y no se puede editar desde esta pantalla.",
      };
    }
    return { ok: true, pedidoId: (row as { id: string }).id };
  }

  const { data: created, error } = await supabase
    .from("pedidos_mensuales")
    .insert({
      posta_id: postaId,
      anio,
      mes,
      estado: "BORRADOR",
      creado_por_usuario_id: userId,
    })
    .select("id")
    .single();

  if (
    error ||
    !created ||
    typeof created !== "object" ||
    typeof (created as { id: unknown }).id !== "string"
  ) {
    return { ok: false, error: error?.message ?? "No se pudo crear el pedido." };
  }
  return { ok: true, pedidoId: (created as { id: string }).id };
}

async function upsertDetalleDesdeFormulario(
  supabase: SupabaseSrv,
  postaId: string,
  anio: number,
  mes: number,
  userId: string,
  formData: FormData
): Promise<{ ok: true; pedidoId: string } | { ok: false; error: string }> {
  const rawIds = formData.get("medicamento_ids_json")?.toString();
  let medicamentoIds: string[] = [];
  try {
    const parsed = rawIds ? JSON.parse(rawIds) : [];
    if (!Array.isArray(parsed)) throw new Error("not array");
    medicamentoIds = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return { ok: false, error: "Datos del formulario inválidos. Recarga la página." };
  }

  const parsedQty = parseCantidadesForm(formData, medicamentoIds);
  if (!parsedQty.ok) return { ok: false, error: parsedQty.error };

  const meds = await cargarMedicamentosActivosLedger(supabase);
  const medSet = new Set(meds.map((m) => m.id));
  for (const id of medicamentoIds) {
    if (!medSet.has(id)) {
      return { ok: false, error: "El catálogo cambió. Recarga la página." };
    }
  }

  const snap = await snapshotLedgerMesPosta(supabase, postaId, anio, mes, meds);

  const ped = await obtenerOCrearPedidoBorrador(supabase, postaId, anio, mes, userId);
  if (!ped.ok) return ped;

  const detalleRows = medicamentoIds.map((mid) => {
    const s = snap.get(mid);
    const disp = s?.disponible ?? 0;
    const ref = s?.stock_recomendado ?? 0;
    const sug = cantidadPedidoSegunStockReferencial(disp, ref);
    const fin = parsedQty.cantidades.get(mid) ?? 0;
    return {
      pedido_id: ped.pedidoId,
      medicamento_id: mid,
      cantidad_sugerida: sug,
      cantidad_final: fin,
    };
  });

  const { error: upErr } = await supabase.from("detalle_pedido_mensual").upsert(detalleRows, {
    onConflict: "pedido_id,medicamento_id",
  });
  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  return { ok: true, pedidoId: ped.pedidoId };
}

/** `_intent`: `guardar` | `enviar` */
export async function pedidoMensualSubmitAction(
  postaId: string,
  prev: PedidoMensualActionState,
  formData: FormData
): Promise<PedidoMensualActionState> {
  const gate = await assertEncargadoPosta(postaId);
  if (!gate.ok) return { error: gate.error };

  const intent = formData.get("_intent")?.toString() ?? "guardar";
  const anio = Number(formData.get("anio"));
  const mes = Number(formData.get("mes"));
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
    return { error: "Mes no válido." };
  }

  const supabase = await createServerSupabaseClient();
  const up = await upsertDetalleDesdeFormulario(supabase, postaId, anio, mes, gate.userId, formData);
  if (!up.ok) return { error: up.error };

  if (intent === "guardar") {
    await supabase
      .from("pedidos_mensuales")
      .update({ estado: "BORRADOR" })
      .eq("id", up.pedidoId)
      .eq("estado", "OBSERVADO");
    await registrarAuditLog(supabase, {
      actorId: gate.userId,
      action: "pedido_mensual.guardar_borrador",
      entity: "pedidos_mensuales",
      entityId: up.pedidoId,
      metadata: { postaId, anio, mes },
    });
    revalidatePath(`/postas/${postaId}/pedidos`);
    revalidatePath("/admin/pedidos");
    return { ok: true, success: "Borrador guardado." };
  }

  if (intent !== "enviar") {
    return { error: "Accion no reconocida." };
  }

  const { data: updRows, error: stErr } = await supabase
    .from("pedidos_mensuales")
    .update({
      estado: "ENVIADO",
      enviado_en: new Date().toISOString(),
    })
    .eq("id", up.pedidoId)
    .in("estado", ["BORRADOR", "OBSERVADO"])
    .select("id");

  if (stErr) {
    return { error: stErr.message };
  }
  if (!updRows?.length) {
    return {
      error:
        "No se pudo enviar: el pedido no estaba en borrador ni observado, o ya fue enviado.",
    };
  }

  await registrarAuditLog(supabase, {
    actorId: gate.userId,
    action: "pedido_mensual.enviado",
    entity: "pedidos_mensuales",
    entityId: up.pedidoId,
    metadata: { postaId, anio, mes },
  });

  revalidatePath(`/postas/${postaId}/pedidos`);
  revalidatePath("/admin/pedidos");
  return { ok: true, success: "Pedido enviado a administración. Puedes descargar el PDF." };
}

export async function aprobarPedidoMensualAdminAction(
  pedidoId: string,
  _prev: PedidoMensualActionState,
  formData: FormData
): Promise<PedidoMensualActionState> {
  const fd = new FormData();
  fd.set("pedido_id", pedidoId);
  fd.set("estado", "APROBADO");
  const comentario = formData.get("comentario_admin")?.toString();
  if (comentario) fd.set("comentario_admin", comentario);
  return cambiarEstadoPedidoMensualAdminAction(_prev, fd);
}

export async function cambiarEstadoPedidoMensualAdminAction(
  _prev: PedidoMensualActionState,
  formData: FormData
): Promise<PedidoMensualActionState> {
  const ctx = await requirePerfilUsuario();
  if (!esAdminGeneral(ctx.profile)) {
    return { error: "Solo administración general puede cambiar estados de pedidos." };
  }

  const pedidoId = formData.get("pedido_id")?.toString().trim();
  const estadoNuevo = formData.get("estado")?.toString().trim();
  const comentario = formData.get("comentario_admin")?.toString().trim() ?? "";
  const estadosPermitidos = new Set([
    "OBSERVADO",
    "RECHAZADO",
    "APROBADO",
    "DESPACHADO",
    "RECIBIDO",
  ]);

  if (!pedidoId || !estadoNuevo || !estadosPermitidos.has(estadoNuevo)) {
    return { error: "Estado de pedido no válido." };
  }

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
  const transiciones: Record<string, string[]> = {
    ENVIADO: ["OBSERVADO", "RECHAZADO", "APROBADO"],
    APROBADO: ["DESPACHADO"],
    DESPACHADO: ["RECIBIDO"],
  };
  if (!(transiciones[estado] ?? []).includes(estadoNuevo)) {
    return { error: `No se puede pasar un pedido desde ${estado} a ${estadoNuevo}.` };
  }

  const postaId = (row as { posta_id: string }).posta_id;
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    estado: estadoNuevo,
    comentario_admin: comentario || null,
  };
  if (estadoNuevo === "OBSERVADO") update.observado_en = now;
  if (estadoNuevo === "RECHAZADO") update.rechazado_en = now;
  if (estadoNuevo === "APROBADO") {
    update.fecha_aprobacion = now;
    update.aprobado_por_usuario_id = ctx.user.id;
  }
  if (estadoNuevo === "DESPACHADO") update.despachado_en = now;
  if (estadoNuevo === "RECIBIDO") update.recibido_en = now;

  const { error: upErr } = await supabase
    .from("pedidos_mensuales")
    .update(update)
    .eq("id", pedidoId)
    .eq("estado", estado);

  if (upErr) {
    return { error: upErr.message };
  }

  await registrarAuditLog(supabase, {
    actorId: ctx.user.id,
    action: "pedido_mensual.cambio_estado_admin",
    entity: "pedidos_mensuales",
    entityId: pedidoId,
    metadata: { estadoAnterior: estado, estadoNuevo, comentario },
  });

  revalidatePath(`/postas/${postaId}/pedidos`);
  revalidatePath("/admin/pedidos");
  return { ok: true, success: `Pedido actualizado a ${estadoNuevo}.` };
}

export async function togglePedidoBandejaListoAdminAction(
  _prev: PedidoMensualActionState,
  formData: FormData
): Promise<PedidoMensualActionState> {
  const ctx = await requirePerfilUsuario();
  if (!esAdminGeneral(ctx.profile)) {
    return { error: "Solo administración general puede marcar la bandeja." };
  }

  const pedidoId = formData.get("pedido_id")?.toString().trim();
  if (!pedidoId) {
    return { error: "Pedido no válido." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: row, error: selErr } = await supabase
    .from("pedidos_mensuales")
    .select("id, admin_bandeja_listo_en")
    .eq("id", pedidoId)
    .maybeSingle();

  if (selErr || !row || typeof row !== "object") {
    return { error: "No se encontró el pedido." };
  }

  const listoEn = (row as { admin_bandeja_listo_en?: string | null }).admin_bandeja_listo_en;
  const marcar = listoEn == null || listoEn === "";
  const payload = marcar
    ? {
        admin_bandeja_listo_en: new Date().toISOString(),
        admin_bandeja_listo_por: ctx.user.id,
      }
    : { admin_bandeja_listo_en: null, admin_bandeja_listo_por: null };

  const { error: upErr } = await supabase.from("pedidos_mensuales").update(payload).eq("id", pedidoId);

  if (upErr) {
    return { error: upErr.message };
  }

  await registrarAuditLog(supabase, {
    actorId: ctx.user.id,
    action: marcar ? "pedido_mensual.bandeja_listo" : "pedido_mensual.bandeja_listo_quitar",
    entity: "pedidos_mensuales",
    entityId: pedidoId,
    metadata: { marcar },
  });

  revalidatePath("/admin/pedidos");
  return {
    ok: true,
    success: marcar ? "Marcado como listo en la bandeja." : "Listo quitado; el pedido sigue en el historial.",
  };
}
