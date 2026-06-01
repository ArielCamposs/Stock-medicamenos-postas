"use server";

import { revalidatePath } from "next/cache";

import {
  esAdminGeneral,
  puedeGestionarPedidoMensualPosta,
  puedeVerPosta,
  requirePerfilUsuario,
} from "@/lib/auth/session";
import { registrarAuditLog } from "@/lib/audit/stock-audit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sincronizarStockInsumosDesdePedido } from "@/app/actions/stock-insumos";
import { validarPedidoInsumosNoMismoDia } from "@/lib/posta/reglas-repeticion-dia";

export type PedidoInsumosActionState = {
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
      error: "Solo el encargado de la posta puede gestionar pedidos de insumos.",
    };
  }
  return { ok: true as const, userId: ctx.user.id };
}

async function obtenerPedidoObservadoOCrearNuevo(
  supabase: SupabaseSrv,
  postaId: string,
  userId: string
): Promise<{ ok: true; pedidoId: string } | { ok: false; error: string }> {
  const { data: row } = await supabase
    .from("pedidos_insumos")
    .select("id, estado")
    .eq("posta_id", postaId)
    .eq("estado", "OBSERVADO")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (row && typeof row === "object" && "id" in row && typeof (row as { id: unknown }).id === "string") {
    return { ok: true, pedidoId: (row as { id: string }).id };
  }

  const { data: created, error } = await supabase
    .from("pedidos_insumos")
    .insert({
      posta_id: postaId,
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

type LineaInsumo = {
  insumoId: string;
  stockObjetivo: number;
  stockActual: number;
  cantidadPedido: number;
};

function parseLineasFormulario(
  formData: FormData,
  insumoIds: string[],
  stockObjetivoPorInsumo: Map<string, number>
): { ok: true; lineas: LineaInsumo[] } | { ok: false; error: string } {
  const lineas: LineaInsumo[] = [];
  for (const id of insumoIds) {
    const rawAct = formData.get(`actual_${id}`)?.toString() ?? "";
    const actual = Number.parseInt(rawAct.trim(), 10);
    const objetivo = stockObjetivoPorInsumo.get(id) ?? 0;
    if (Number.isNaN(actual) || actual < 0) {
      return { ok: false, error: "El stock actual debe ser un número mayor o igual a 0." };
    }
    const rawPedir = formData.get(`pedir_${id}`)?.toString() ?? "";
    const pedirParsed = rawPedir.trim() === "" ? null : Number.parseInt(rawPedir.trim(), 10);
    const cantidadCalculada = Math.max(0, objetivo - actual);
    if (pedirParsed !== null && (Number.isNaN(pedirParsed) || pedirParsed < 0)) {
      return { ok: false, error: "La cantidad a pedir debe ser un número mayor o igual a 0." };
    }
    const cantidad =
      pedirParsed !== null && !Number.isNaN(pedirParsed) && pedirParsed >= 0
        ? pedirParsed
        : cantidadCalculada;
    lineas.push({ insumoId: id, stockObjetivo: objetivo, stockActual: actual, cantidadPedido: cantidad });
  }
  return { ok: true, lineas };
}

async function upsertDetalleDesdeFormulario(
  supabase: SupabaseSrv,
  postaId: string,
  userId: string,
  formData: FormData
): Promise<{ ok: true; pedidoId: string } | { ok: false; error: string }> {
  const rawIds = formData.get("insumo_ids_json")?.toString();
  let insumoIds: string[] = [];
  try {
    const parsed = rawIds ? JSON.parse(rawIds) : [];
    if (!Array.isArray(parsed)) throw new Error("not array");
    insumoIds = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return { ok: false, error: "Datos del formulario inválidos. Recarga la página." };
  }

  if (insumoIds.length === 0) {
    return { ok: false, error: "No hay insumos en el catálogo activo." };
  }

  const { data: insumosActivos } = await supabase
    .from("insumos")
    .select("id, stock_objetivo")
    .eq("activo", true);

  const stockObjetivoPorInsumo = new Map<string, number>();
  for (const row of insumosActivos ?? []) {
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string") continue;
    const n = Number(r.stock_objetivo);
    stockObjetivoPorInsumo.set(r.id, Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0);
  }

  const insumosSet = new Set(stockObjetivoPorInsumo.keys());
  for (const id of insumoIds) {
    if (!insumosSet.has(id)) {
      return { ok: false, error: "El catálogo de insumos cambió. Recarga la página." };
    }
  }

  const parsedLineas = parseLineasFormulario(formData, insumoIds, stockObjetivoPorInsumo);
  if (!parsedLineas.ok) return { ok: false, error: parsedLineas.error };

  const ped = await obtenerPedidoObservadoOCrearNuevo(supabase, postaId, userId);
  if (!ped.ok) return ped;

  const detalleRows = parsedLineas.lineas.map((l) => ({
    pedido_id: ped.pedidoId,
    insumo_id: l.insumoId,
    stock_objetivo: l.stockObjetivo,
    stock_actual: l.stockActual,
    cantidad_pedido: l.cantidadPedido,
  }));

  const { error: upErr } = await supabase.from("detalle_pedido_insumos").upsert(detalleRows, {
    onConflict: "pedido_id,insumo_id",
  });
  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  await sincronizarStockInsumosDesdePedido(
    supabase,
    postaId,
    parsedLineas.lineas.map((l) => ({ insumoId: l.insumoId, stockActual: l.stockActual }))
  );

  return { ok: true, pedidoId: ped.pedidoId };
}

export async function enviarPedidoInsumosAction(
  postaId: string,
  prev: PedidoInsumosActionState,
  formData: FormData
): Promise<PedidoInsumosActionState> {
  const gate = await assertEncargadoPosta(postaId);
  if (!gate.ok) return { error: gate.error };

  const intent = formData.get("_intent")?.toString() ?? "";
  if (intent !== "enviar") {
    return { error: "Acción no reconocida." };
  }

  const supabase = await createServerSupabaseClient();
  const up = await upsertDetalleDesdeFormulario(supabase, postaId, gate.userId, formData);
  if (!up.ok) return { error: up.error };

  const mismoDia = await validarPedidoInsumosNoMismoDia(supabase, postaId, up.pedidoId);
  if (!mismoDia.ok) return { error: mismoDia.error };

  const { data: updRows, error: stErr } = await supabase
    .from("pedidos_insumos")
    .update({
      estado: "ENVIADO",
      enviado_en: new Date().toISOString(),
    })
    .eq("id", up.pedidoId)
    .in("estado", ["BORRADOR", "OBSERVADO"])
    .select("id");

  if (stErr) return { error: stErr.message };
  if (!updRows?.length) {
    return { error: "No se pudo enviar: el pedido ya fue enviado o no se puede modificar." };
  }

  await registrarAuditLog(supabase, {
    actorId: gate.userId,
    action: "pedido_insumos.enviado",
    entity: "pedidos_insumos",
    entityId: up.pedidoId,
    metadata: { postaId },
  });

  revalidatePath(`/postas/${postaId}/insumos`);
  revalidatePath(`/postas/${postaId}/dashboard`);
  revalidatePath("/admin/pedidos-insumos");
  return { ok: true, success: "Pedido de insumos enviado a administración." };
}

export async function cambiarEstadoPedidoInsumosAdminAction(
  _prev: PedidoInsumosActionState,
  formData: FormData
): Promise<PedidoInsumosActionState> {
  const ctx = await requirePerfilUsuario();
  if (!esAdminGeneral(ctx.profile)) {
    return { error: "Solo administración general puede cambiar estados de pedidos de insumos." };
  }

  const pedidoId = formData.get("pedido_id")?.toString().trim();
  const estadoNuevo = formData.get("estado")?.toString().trim();
  const comentario = formData.get("comentario_admin")?.toString().trim() ?? "";
  const estadosPermitidos = new Set(["OBSERVADO", "RECHAZADO", "APROBADO", "DESPACHADO", "RECIBIDO"]);

  if (!pedidoId || !estadoNuevo || !estadosPermitidos.has(estadoNuevo)) {
    return { error: "Estado de pedido no válido." };
  }

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
  const transiciones: Record<string, string[]> = {
    ENVIADO: ["OBSERVADO", "RECHAZADO", "APROBADO"],
    OBSERVADO: ["APROBADO", "RECHAZADO"],
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
  if (estadoNuevo === "RECIBIDO") update.recibido_en = now;

  const { error: upErr } = await supabase
    .from("pedidos_insumos")
    .update(update)
    .eq("id", pedidoId)
    .eq("estado", estado);

  if (upErr) return { error: upErr.message };

  await registrarAuditLog(supabase, {
    actorId: ctx.user.id,
    action: "pedido_insumos.cambio_estado_admin",
    entity: "pedidos_insumos",
    entityId: pedidoId,
    metadata: { estadoAnterior: estado, estadoNuevo, comentario },
  });

  revalidatePath(`/postas/${postaId}/insumos`);
  revalidatePath("/admin/pedidos-insumos");
  return { ok: true, success: `Pedido actualizado a ${estadoNuevo}.` };
}

export async function crearInsumoAdminAction(
  _prev: PedidoInsumosActionState,
  formData: FormData
): Promise<PedidoInsumosActionState> {
  const ctx = await requirePerfilUsuario();
  if (!esAdminGeneral(ctx.profile)) {
    return { error: "Solo administración general puede gestionar el catálogo de insumos." };
  }

  const nombre = formData.get("nombre")?.toString().trim() ?? "";
  const stockRaw = formData.get("stock_objetivo")?.toString().trim() ?? "0";
  const stockObjetivo = Number.parseInt(stockRaw, 10);

  if (!nombre) return { error: "El nombre del insumo es obligatorio." };
  if (Number.isNaN(stockObjetivo) || stockObjetivo < 0) {
    return { error: "El stock a manejar debe ser un número mayor o igual a 0." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("insumos").insert({
    nombre,
    stock_objetivo: stockObjetivo,
    activo: true,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/insumos");
  return { ok: true, success: `Insumo "${nombre}" creado.` };
}

export async function actualizarInsumoAdminAction(
  _prev: PedidoInsumosActionState,
  formData: FormData
): Promise<PedidoInsumosActionState> {
  const ctx = await requirePerfilUsuario();
  if (!esAdminGeneral(ctx.profile)) {
    return { error: "Solo administración general puede gestionar el catálogo de insumos." };
  }

  const insumoId = formData.get("insumo_id")?.toString().trim();
  const nombre = formData.get("nombre")?.toString().trim() ?? "";
  const stockRaw = formData.get("stock_objetivo")?.toString().trim() ?? "0";
  const stockObjetivo = Number.parseInt(stockRaw, 10);
  const activoRaw = formData.get("activo")?.toString();
  const activo = activoRaw === "true";

  if (!insumoId) return { error: "ID de insumo no válido." };
  if (!nombre) return { error: "El nombre del insumo es obligatorio." };
  if (Number.isNaN(stockObjetivo) || stockObjetivo < 0) {
    return { error: "El stock a manejar debe ser un número mayor o igual a 0." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("insumos")
    .update({
      nombre,
      stock_objetivo: stockObjetivo,
      activo,
    })
    .eq("id", insumoId);

  if (error) return { error: error.message };

  revalidatePath("/admin/insumos");
  return { ok: true, success: `Insumo actualizado.` };
}
