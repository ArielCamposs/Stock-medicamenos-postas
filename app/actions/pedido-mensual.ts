"use server";

import { revalidatePath } from "next/cache";

import {
  esAdminGeneral,
  puedeGestionarPedidoMensualPosta,
  puedeVerPosta,
  requirePerfilUsuario,
} from "@/lib/auth/session";
import { registrarAuditLog } from "@/lib/audit/stock-audit";
import { esMedicamentoContraReceta } from "@/lib/domain/medicamento-categoria";
import { cantidadPedidoSegunStockReferencial } from "@/lib/domain/pedido-mensual";
import { cargarPedidosMensualesMes } from "@/lib/posta/pedidos-mensuales-por-tipo";
import { validarPedidoMensualNoMismoDia } from "@/lib/posta/reglas-repeticion-dia";
import { snapshotLedgerMesPosta, type MedLedgerMin } from "@/lib/posta/snapshot-ledger-mes-posta";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PedidoMensualActionState = {
  error?: string | null;
  ok?: boolean;
  success?: string | null;
};

type SupabaseSrv = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function revalidateVistasPedidoMensual(postaId: string) {
  revalidatePath(`/postas/${postaId}/pedidos`);
  revalidatePath(`/postas/${postaId}/dashboard`);
  revalidatePath(`/postas/${postaId}/ingresos`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/bodega");
}

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

export type TipoPedido = "GENERAL" | "CONTRA_RECETA";

async function idsMedicamentosContraReceta(supabase: SupabaseSrv): Promise<Set<string>> {
  const { data } = await supabase
    .from("medicamentos")
    .select("id, es_contra_receta, categoria")
    .eq("activo", true);
  const set = new Set<string>();
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string") continue;
    if (
      esMedicamentoContraReceta({
        es_contra_receta: r.es_contra_receta === true,
        categoria:
          typeof r.categoria === "string" ? r.categoria : undefined,
      })
    ) {
      set.add(r.id);
    }
  }
  return set;
}

async function obtenerOCrearPedidoBorrador(
  supabase: SupabaseSrv,
  postaId: string,
  anio: number,
  mes: number,
  userId: string,
  tipo: TipoPedido
): Promise<{ ok: true; pedidoId: string } | { ok: false; error: string }> {
  const pedidosMes = await cargarPedidosMensualesMes(supabase, postaId, anio, mes);
  if (pedidosMes.error) {
    return { ok: false, error: pedidosMes.error };
  }

  const vista = tipo === "CONTRA_RECETA" ? pedidosMes.contraReceta : pedidosMes.general;
  const etiqueta = tipo === "CONTRA_RECETA" ? "contra receta" : "general";

  if (vista.pedidoEnProceso) {
    return {
      ok: false,
      error: `Hay un pedido ${etiqueta} en trámite. Espera a que administración lo resuelva antes de enviar otro.`,
    };
  }

  if (vista.pedido) {
    const estado = vista.pedido.estado;
    if (estado === "BORRADOR" || estado === "OBSERVADO") {
      return { ok: true, pedidoId: vista.pedido.id };
    }
    return {
      ok: false,
      error: `Este pedido ${etiqueta} no se puede modificar en su estado actual.`,
    };
  }

  if (vista.pedidoEnviadoHoy) {
    return {
      ok: false,
      error: `Ya enviaste el pedido ${etiqueta} hoy. Puedes enviar otro mañana si lo necesitas.`,
    };
  }

  const { data: created, error } = await supabase
    .from("pedidos_mensuales")
    .insert({
      posta_id: postaId,
      anio,
      mes,
      tipo,
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
    const msg = error?.message ?? "No se pudo crear el pedido.";
    if (error?.code === "23505") {
      return {
        ok: false,
        error:
          "No se pudo crear este pedido: el mes ya tiene un registro sin separar por tipo (general / contra receta). Confirma con administración que la migración correspondiente esté aplicada.",
      };
    }
    return { ok: false, error: msg };
  }
  return { ok: true, pedidoId: (created as { id: string }).id };
}

async function upsertDetalleDesdeFormulario(
  supabase: SupabaseSrv,
  postaId: string,
  anio: number,
  mes: number,
  userId: string,
  formData: FormData,
  tipo: TipoPedido
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

  const contraSet = await idsMedicamentosContraReceta(supabase);

  if (tipo === "CONTRA_RECETA") {
    medicamentoIds = medicamentoIds.filter((id) => contraSet.has(id));
    if (medicamentoIds.length === 0) {
      return {
        ok: false,
        error: "No hay medicamentos contra receta activos para este pedido.",
      };
    }
  } else {
    medicamentoIds = medicamentoIds.filter((id) => !contraSet.has(id));
    if (medicamentoIds.length === 0) {
      return {
        ok: false,
        error: "No hay medicamentos para el pedido general en el formulario.",
      };
    }
  }

  const parsedQty = parseCantidadesForm(formData, medicamentoIds);
  if (!parsedQty.ok) return { ok: false, error: parsedQty.error };

  const lineasConCantidad = medicamentoIds.filter(
    (id) => (parsedQty.cantidades.get(id) ?? 0) > 0
  ).length;
  if (lineasConCantidad === 0) {
    const etiqueta = tipo === "CONTRA_RECETA" ? "contra receta" : "general";
    return {
      ok: false,
      error: `El pedido ${etiqueta} debe incluir al menos un medicamento con cantidad mayor que 0.`,
    };
  }

  const meds = await cargarMedicamentosActivosLedger(supabase);
  const medSet = new Set(meds.map((m) => m.id));
  for (const id of medicamentoIds) {
    if (!medSet.has(id)) {
      return { ok: false, error: "El catálogo cambió. Recarga la página." };
    }
  }

  const snap = await snapshotLedgerMesPosta(supabase, postaId, anio, mes, meds);

  const ped = await obtenerOCrearPedidoBorrador(supabase, postaId, anio, mes, userId, tipo);
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

/** `_intent` debe ser `enviar`. */
export async function pedidoMensualSubmitAction(
  postaId: string,
  prev: PedidoMensualActionState,
  formData: FormData
): Promise<PedidoMensualActionState> {
  const gate = await assertEncargadoPosta(postaId);
  if (!gate.ok) return { error: gate.error };

  const intent = formData.get("_intent")?.toString() ?? "";
  if (intent !== "enviar") {
    return { error: "Acción no reconocida." };
  }

  const anio = Number(formData.get("anio"));
  const mes = Number(formData.get("mes"));
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
    return { error: "Mes no válido." };
  }

  const tipoRaw = formData.get("tipo_pedido")?.toString().trim();
  const tipo: TipoPedido =
    tipoRaw === "CONTRA_RECETA" ? "CONTRA_RECETA" : "GENERAL";

  const supabase = await createServerSupabaseClient();
  const up = await upsertDetalleDesdeFormulario(supabase, postaId, anio, mes, gate.userId, formData, tipo);
  if (!up.ok) return { error: up.error };

  const diaOk = await validarPedidoMensualNoMismoDia(supabase, postaId, tipo, up.pedidoId);
  if (!diaOk.ok) return { error: diaOk.error };

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
    metadata: { postaId, anio, mes, tipo },
  });

  revalidatePath(`/postas/${postaId}/pedidos`);
  revalidatePath("/admin/pedidos");
  const etiquetaOk = tipo === "CONTRA_RECETA" ? "Pedido contra receta" : "Pedido general";
  return {
    ok: true,
    success: `${etiquetaOk} enviado a administración. Puedes descargar el PDF.`,
  };
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
  const estadosPermitidos = new Set(["OBSERVADO", "RECHAZADO", "APROBADO"]);

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

/** La posta confirma recepción del pedido despachado; cantidades editables si llegó menos. */
export async function confirmarRecepcionPedidoMensualPostaAction(
  postaId: string,
  _prev: PedidoMensualActionState,
  formData: FormData
): Promise<PedidoMensualActionState> {
  const gate = await assertEncargadoPosta(postaId);
  if (!gate.ok) return { error: gate.error };

  const pedidoId = formData.get("pedido_id")?.toString().trim();
  const tipoRaw = formData.get("tipo_pedido")?.toString().trim();
  const tipo: TipoPedido = tipoRaw === "CONTRA_RECETA" ? "CONTRA_RECETA" : "GENERAL";

  if (!pedidoId) return { error: "Pedido no válido." };

  let medicamentoIds: string[] = [];
  try {
    const parsed = JSON.parse(formData.get("medicamento_ids_json")?.toString() ?? "[]");
    if (!Array.isArray(parsed)) throw new Error("not array");
    medicamentoIds = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return { error: "Datos del formulario inválidos. Recarga la página." };
  }

  const {
    parseLineasRecepcionDesdeFormulario,
    registrarRecepcionPedidoMensual,
  } = await import("@/lib/posta/registrar-recepcion-pedido-mensual");

  const parsedLineas = parseLineasRecepcionDesdeFormulario(formData, medicamentoIds);
  if (!parsedLineas.ok) return { error: parsedLineas.error };

  const supabase = await createServerSupabaseClient();
  const { data: row, error: selErr } = await supabase
    .from("pedidos_mensuales")
    .select("id, posta_id, anio, mes, estado, tipo")
    .eq("id", pedidoId)
    .eq("posta_id", postaId)
    .maybeSingle();

  if (selErr || !row || typeof row !== "object") {
    return { error: "No se encontró el pedido." };
  }

  const estado = String((row as { estado: string }).estado);
  if (estado !== "DESPACHADO") {
    return { error: "Este pedido no está pendiente de confirmación de recepción." };
  }

  const anio = Number((row as { anio: unknown }).anio);
  const mes = Number((row as { mes: unknown }).mes);

  const res = await registrarRecepcionPedidoMensual(supabase, {
    postaId,
    pedidoId,
    userId: gate.userId,
    anio,
    mes,
    tipoPedido: tipo,
    lineasRecibidas: parsedLineas.lineas,
  });

  if (!res.ok) return { error: res.error };

  await registrarAuditLog(supabase, {
    actorId: gate.userId,
    action: "pedido_mensual.recibido_posta",
    entity: "pedidos_mensuales",
    entityId: pedidoId,
    metadata: {
      postaId,
      tipo,
      nLineasStock: res.nLineasStock,
      totalUnidades: res.totalUnidades,
    },
  });

  revalidateVistasPedidoMensual(postaId);

  const msgStock =
    res.nLineasStock > 0
      ? ` Se sumaron ${res.totalUnidades} unidad${res.totalUnidades === 1 ? "" : "es"} a tu stock del mes.`
      : "";
  return {
    ok: true,
    success: `Recepción confirmada.${msgStock}`,
  };
}

export async function registrarPedidoMensualNoRecibidoPostaAction(
  postaId: string,
  _prev: PedidoMensualActionState,
  formData: FormData
): Promise<PedidoMensualActionState> {
  const gate = await assertEncargadoPosta(postaId);
  if (!gate.ok) return { error: gate.error };

  const pedidoId = formData.get("pedido_id")?.toString().trim();
  const comentario = formData.get("comentario_posta")?.toString().trim() ?? "";

  if (!pedidoId) return { error: "Pedido no válido." };
  if (comentario.length > 500) {
    return { error: "El comentario no puede superar 500 caracteres." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: row, error: selErr } = await supabase
    .from("pedidos_mensuales")
    .select("id, posta_id, estado")
    .eq("id", pedidoId)
    .eq("posta_id", postaId)
    .maybeSingle();

  if (selErr || !row || typeof row !== "object") {
    return { error: "No se encontró el pedido." };
  }

  if ((row as { estado: string }).estado !== "DESPACHADO") {
    return { error: "Este pedido no está pendiente de confirmación de recepción." };
  }

  const { error: upErr } = await supabase
    .from("pedidos_mensuales")
    .update({
      comentario_posta: comentario || "La posta indica que el pedido no llegó.",
    })
    .eq("id", pedidoId)
    .eq("posta_id", postaId)
    .eq("estado", "DESPACHADO");

  if (upErr) return { error: upErr.message };

  await registrarAuditLog(supabase, {
    actorId: gate.userId,
    action: "pedido_mensual.no_recibido_posta",
    entity: "pedidos_mensuales",
    entityId: pedidoId,
    metadata: { postaId, comentario: comentario || null },
  });

  revalidateVistasPedidoMensual(postaId);

  return {
    ok: true,
    success:
      "Registramos que no recibiste el pedido. Administración fue notificada; puedes volver a indicar cuando llegue.",
  };
}
