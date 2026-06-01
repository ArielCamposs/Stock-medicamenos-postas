"use server";

import { revalidatePath } from "next/cache";

import {
  esAdminGeneral,
  puedeGestionarPedidoMensualPosta,
  puedeRegistrarOperacionesPosta,
  puedeRegistrarStockYAvisPosta,
  puedeVerPosta,
  requirePerfilUsuario,
} from "@/lib/auth/session";
import { registrarAuditLog } from "@/lib/audit/stock-audit";
import { anioMesActual, mesAnterior, permiteCierreMensualCalendarioOperacion } from "@/lib/domain/fecha-mes";
import { obtenerFilasConciliacionCierre } from "@/lib/posta/cierre-conciliacion-filas";
import { mesEstaCerrado } from "@/lib/posta/cierre-mensual";
import {
  registrarConsumoDiario,
  revalidateRutasTrasConsumoDiario,
} from "@/lib/posta/registrar-consumo-diario";
import { validarIngresoMedicamentosNoMismoDia } from "@/lib/posta/reglas-repeticion-dia";
import {
  sincronizarStockMensualDesdeRegistro,
  sincronizarStockMensualLote,
  validarMesAbierto,
} from "@/lib/posta/sincronizar-stock-mensual-desde-registro";
import {
  cargarAgregadosIngresoConsumoPorMedicamentos,
  cierreFinDeMesAcumulado,
  ymKey,
} from "@/lib/posta/stock-cierre-mensual";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PostaActionState = {
  error?: string | null;
  ok?: boolean;
  success?: string | null;
};

async function assertEncargadoPosta(postaId: string) {
  const ctx = await requirePerfilUsuario();
  if (!puedeVerPosta(ctx.profile, postaId)) {
    return {
      ok: false as const,
      error: "No tienes permiso para esta posta.",
    };
  }
  if (!puedeRegistrarOperacionesPosta(ctx.profile, postaId)) {
    return {
      ok: false as const,
      error:
        "Solo el encargado de esta posta puede registrar o borrar descuentos diarios. La administración general no modifica el registro de consumo.",
    };
  }
  return { ok: true as const, userId: ctx.user.id };
}

async function assertStockYAvisPosta(postaId: string) {
  const ctx = await requirePerfilUsuario();
  if (!puedeVerPosta(ctx.profile, postaId)) {
    return {
      ok: false as const,
      error: "No tienes permiso para esta posta.",
    };
  }
  if (!puedeRegistrarStockYAvisPosta(ctx.profile, postaId)) {
    return {
      ok: false as const,
      error:
        "Solo el encargado de la posta o un usuario de administración general puede registrar ingresos o declaración AVIS.",
    };
  }
  return { ok: true as const, userId: ctx.user.id };
}

/** Un día y un medicamento: modal de descuento (con/sin AVIS). */
export async function registrarConsumoDiarioCeldaAction(
  postaId: string,
  _prev: PostaActionState,
  formData: FormData
): Promise<PostaActionState> {
  const gate = await assertEncargadoPosta(postaId);
  if (!gate.ok) {
    return { error: gate.error };
  }

  const fecha = formData.get("fecha")?.toString().trim() ?? "";
  const medicamentoId = formData.get("medicamento_id")?.toString().trim() ?? "";
  const conAvis = Number.parseInt(
    formData.get("cantidad_con_avis")?.toString() ?? "",
    10
  );
  const sinAvis = Number.parseInt(
    formData.get("cantidad_sin_avis")?.toString() ?? "",
    10
  );
  const observacion = parseTextoOpcional(formData.get("observacion"));
  const clientSyncId = formData.get("client_sync_id")?.toString().trim() || null;

  const supabase = await createServerSupabaseClient();
  const result = await registrarConsumoDiario(supabase, {
    postaId,
    medicamentoId,
    fecha,
    cantidadConAvis: conAvis,
    cantidadSinAvis: sinAvis,
    observacion,
    clientSyncId,
    userId: gate.userId,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateRutasTrasConsumoDiario(postaId);
  return {
    ok: true,
    success: "Descuento del día guardado.",
  };
}

/** Anula el registro de descuento de un día sin borrar la historia. */
export async function eliminarConsumoDiaAction(
  postaId: string,
  _prev: PostaActionState,
  formData: FormData
): Promise<PostaActionState> {
  const gate = await assertEncargadoPosta(postaId);
  if (!gate.ok) {
    return { error: gate.error };
  }

  const fecha = formData.get("fecha")?.toString().trim();
  const medicamentoId = formData.get("medicamento_id")?.toString().trim();
  const motivo = parseTextoOpcional(formData.get("motivo_anulacion"));

  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !medicamentoId) {
    return { error: "Fecha o medicamento no válidos." };
  }
  if (!motivo) {
    return { error: "Indica un motivo para anular el descuento." };
  }

  const supabase = await createServerSupabaseClient();
  const { anio, mes } = anioMesActual(new Date(fecha + "T12:00:00"));
  const abierto = await validarMesAbierto(supabase, postaId, anio, mes);
  if (!abierto.ok) {
    return { error: abierto.error };
  }

  const { data: row, error: selErr } = await supabase
    .from("movimientos_diarios_consumo")
    .select("id, cantidad_con_avis, cantidad_sin_avis, total_dia, observacion")
    .eq("posta_id", postaId)
    .eq("medicamento_id", medicamentoId)
    .eq("fecha", fecha)
    .eq("anulado", false)
    .maybeSingle();

  if (selErr) {
    return { error: selErr.message };
  }
  if (!row) {
    return { error: "No había un descuento activo para ese día y medicamento." };
  }

  const { error } = await supabase
    .from("movimientos_diarios_consumo")
    .update({
      anulado: true,
      anulado_por: gate.userId,
      anulado_en: new Date().toISOString(),
      motivo_anulacion: motivo,
    })
    .eq("posta_id", postaId)
    .eq("medicamento_id", medicamentoId)
    .eq("fecha", fecha)
    .eq("anulado", false)
    .select("id");

  if (error) {
    return { error: error.message };
  }

  const sync = await sincronizarStockMensualDesdeRegistro(
    supabase,
    postaId,
    medicamentoId,
    anio,
    mes
  );
  if (sync.error) {
    return { error: sync.error };
  }

  await registrarAuditLog(supabase, {
    actorId: gate.userId,
    action: "consumo_diario.anulado",
    entity: "movimientos_diarios_consumo",
    entityId: String((row as { id: string }).id),
    metadata: { postaId, medicamentoId, fecha, motivo, anterior: row },
  });

  revalidatePath(`/postas/${postaId}/descuento`);
  revalidatePath(`/postas/${postaId}/dashboard`);
  revalidatePath(`/postas/${postaId}/ingresos`);
  revalidatePath(`/postas/${postaId}/pedidos`);
  revalidatePath("/admin/medicamentos");
  revalidatePath("/admin");
  return { ok: true, success: "Descuento del día anulado." };
}

type IngresoUnitParams = {
  fecha: string;
  medicamentoId: string;
  cantidad: number;
  loteId: string;
  tipoOrigen?: string;
  referencia?: string | null;
  observacion?: string | null;
};

type SupabaseSrv = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function parseTextoOpcional(raw: FormDataEntryValue | null): string | null {
  const v = raw?.toString().trim() ?? "";
  return v.length > 0 ? v.slice(0, 500) : null;
}

/**
 * Cabecera de un ingreso (evento) con varias líneas de medicamentos.
 */
async function crearIngresoStockLote(
  supabase: SupabaseSrv,
  gate: { userId: string },
  postaId: string,
  p: {
    fecha: string;
    tipoOrigen: string;
    referencia: string | null;
    observacion: string | null;
  }
): Promise<{ ok: true; loteId: string } | { ok: false; error: string }> {
  const { anio, mes } = anioMesActual(new Date(p.fecha + "T12:00:00"));
  const abierto = await validarMesAbierto(supabase, postaId, anio, mes);
  if (!abierto.ok) {
    return { ok: false, error: abierto.error };
  }

  const { data: created, error } = await supabase
    .from("ingresos_stock_lotes")
    .insert({
      posta_id: postaId,
      fecha: p.fecha,
      tipo_origen: p.tipoOrigen,
      referencia: p.referencia,
      observacion: p.observacion,
      created_by: gate.userId,
    })
    .select("id")
    .single();

  if (error || !created || typeof created !== "object" || typeof (created as { id: unknown }).id !== "string") {
    return { ok: false, error: error?.message ?? "No se pudo crear el ingreso." };
  }

  return { ok: true, loteId: (created as { id: string }).id };
}

/**
 * Una línea de ingreso + fila de stock mensual alineada al registro.
 */
async function aplicarIngresoStockUnitario(
  supabase: SupabaseSrv,
  gate: { userId: string },
  postaId: string,
  p: IngresoUnitParams
): Promise<{ error?: string }> {
  const { anio, mes } = anioMesActual(new Date(p.fecha + "T12:00:00"));

  const tipoOrigen = p.tipoOrigen ?? "OTRO";
  const referencia = p.referencia ?? null;
  const observacion = p.observacion ?? null;
  const abierto = await validarMesAbierto(supabase, postaId, anio, mes);
  if (!abierto.ok) {
    return { error: abierto.error };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("ingresos_stock_mes")
    .insert({
    posta_id: postaId,
    medicamento_id: p.medicamentoId,
    lote_id: p.loteId,
    fecha: p.fecha,
    cantidad: p.cantidad,
    tipo_origen: tipoOrigen,
    referencia,
    observacion,
    created_by: gate.userId,
    })
    .select("id")
    .single();

  if (insErr) {
    return { error: insErr.message };
  }

  const sync = await sincronizarStockMensualDesdeRegistro(
    supabase,
    postaId,
    p.medicamentoId,
    anio,
    mes
  );
  if (sync.error) return sync;

  await registrarAuditLog(supabase, {
    actorId: gate.userId,
    action: "ingreso_stock.creado",
    entity: "ingresos_stock_mes",
    entityId:
      inserted && typeof inserted === "object" && "id" in inserted
        ? String((inserted as { id: string }).id)
        : null,
    metadata: {
      postaId,
      medicamentoId: p.medicamentoId,
      fecha: p.fecha,
      cantidad: p.cantidad,
      tipoOrigen,
      referencia,
      observacion,
    },
  });

  return {};
}

/** Los ingresos registrados son inmutables por política de inventario. */
const INGRESOS_INMUTABLES_MSG =
  "Los ingresos registrados no se pueden modificar ni anular. Contacta a administración si hubo un error.";

/** Corrige la cantidad de un ingreso ya registrado (deshabilitado: registros inmutables). */
export async function actualizarIngresoStockMesAction(
  _postaId: string,
  _prev: PostaActionState,
  _formData: FormData
): Promise<PostaActionState> {
  return { error: INGRESOS_INMUTABLES_MSG };
}

/** Anula un movimiento de ingreso (deshabilitado: registros inmutables). */
export async function eliminarIngresoStockMesAction(
  _postaId: string,
  _prev: PostaActionState,
  _formData: FormData
): Promise<PostaActionState> {
  return { error: INGRESOS_INMUTABLES_MSG };
}

/** Varias líneas de ingreso con la misma fecha (solo cantidades > 0). Origen fijo en base de datos. */
export async function registrarIngresosStockLoteAction(
  postaId: string,
  _prev: PostaActionState,
  formData: FormData
): Promise<PostaActionState> {
  const gate = await assertStockYAvisPosta(postaId);
  if (!gate.ok) {
    return { error: gate.error };
  }

  const fecha = formData.get("fecha")?.toString().trim();
  const mesMovimiento = formData.get("mes_movimiento")?.toString().trim() ?? "";
  const tipoOrigen = "OTRO";
  const referencia = null;
  const observacion = parseTextoOpcional(formData.get("observacion"));

  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { error: "La fecha no es válida." };
  }

  if (!mesMovimiento || !/^\d{4}-\d{2}$/.test(mesMovimiento)) {
    return { error: "El mes del movimiento no es válido." };
  }

  if (fecha.slice(0, 7) !== mesMovimiento) {
    return {
      error: "La fecha no coincide con el mes elegido. Recarga la página e intenta de nuevo.",
    };
  }

  const rawIds = formData.get("medicamento_ids_json")?.toString();
  let medicamentoIds: string[] = [];
  try {
    const parsed = rawIds ? JSON.parse(rawIds) : [];
    if (!Array.isArray(parsed)) throw new Error("not array");
    medicamentoIds = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return {
      error: "Datos del formulario inválidos. Recarga la página e intenta de nuevo.",
    };
  }

  const lineas: { medicamentoId: string; cantidad: number }[] = [];

  for (const medicamentoId of medicamentoIds) {
    const raw = formData.get(`cant_${medicamentoId}`)?.toString() ?? "";
    const t = raw.trim();
    if (t === "") continue;
    const cantidad = Number.parseInt(t, 10);
    if (Number.isNaN(cantidad) || cantidad <= 0) {
      return {
        error:
          "Todas las cantidades deben ser números enteros mayores que 0, o vacías para omitir el medicamento.",
      };
    }
    lineas.push({ medicamentoId, cantidad });
  }

  if (lineas.length === 0) {
    return {
      error: "Indica al menos una cantidad mayor que 0 en algún medicamento del listado.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { anio, mes } = anioMesActual(new Date(fecha + "T12:00:00"));

  // Validar mes abierto UNA SOLA VEZ (no por cada medicamento).
  const abierto = await validarMesAbierto(supabase, postaId, anio, mes);
  if (!abierto.ok) return { error: abierto.error };

  const mismoDia = await validarIngresoMedicamentosNoMismoDia(supabase, postaId, fecha);
  if (!mismoDia.ok) return { error: mismoDia.error };

  const lote = await crearIngresoStockLote(supabase, gate, postaId, {
    fecha,
    tipoOrigen,
    referencia,
    observacion,
  });
  if (!lote.ok) {
    return { error: lote.error };
  }

  // Insertar todas las líneas en un solo batch (un round-trip en lugar de N).
  const { error: insErr } = await supabase.from("ingresos_stock_mes").insert(
    lineas.map(({ medicamentoId, cantidad }) => ({
      posta_id: postaId,
      medicamento_id: medicamentoId,
      lote_id: lote.loteId,
      fecha,
      cantidad,
      tipo_origen: tipoOrigen,
      referencia,
      observacion,
      created_by: gate.userId,
    }))
  );
  if (insErr) return { error: insErr.message };

  // Sincronizar stock de todos los medicamentos en un solo lote (un round-trip en lugar de N).
  const sync = await sincronizarStockMensualLote(
    supabase,
    postaId,
    lineas.map((l) => l.medicamentoId),
    anio,
    mes
  );
  if (sync.error) return { error: sync.error };

  await registrarAuditLog(supabase, {
    actorId: gate.userId,
    action: "ingreso_stock.lote_creado",
    entity: "ingresos_stock_lotes",
    entityId: lote.loteId,
    metadata: {
      postaId,
      fecha,
      tipoOrigen,
      referencia,
      observacion,
      nLineas: lineas.length,
    },
  });

  revalidatePath(`/postas/${postaId}/ingresos`);
  revalidatePath(`/postas/${postaId}/dashboard`);
  revalidatePath(`/postas/${postaId}/descuento`);
  revalidatePath(`/postas/${postaId}/pedidos`);
  revalidatePath("/admin/medicamentos");
  return {
    ok: true,
    success:
      lineas.length === 1
        ? "Ingreso registrado con 1 medicamento."
        : `Ingreso registrado con ${lineas.length} medicamentos.`,
  };
}

export async function registrarIngresoStockAction(
  postaId: string,
  _prev: PostaActionState,
  formData: FormData
): Promise<PostaActionState> {
  const gate = await assertStockYAvisPosta(postaId);
  if (!gate.ok) {
    return { error: gate.error };
  }

  const fecha = formData.get("fecha")?.toString().trim();
  const medicamentoId = formData.get("medicamento_id")?.toString().trim();
  const cantidad = Number.parseInt(formData.get("cantidad")?.toString() ?? "", 10);
  const tipoOrigen = "OTRO";
  const referencia = null;
  const observacion = parseTextoOpcional(formData.get("observacion"));
  if (!fecha || !medicamentoId) {
    return { error: "Fecha y medicamento son obligatorios." };
  }

  if (Number.isNaN(cantidad) || cantidad <= 0) {
    return { error: "La cantidad debe ser un entero mayor que 0." };
  }

  const supabase = await createServerSupabaseClient();
  const lote = await crearIngresoStockLote(supabase, gate, postaId, {
    fecha,
    tipoOrigen,
    referencia,
    observacion,
  });
  if (!lote.ok) {
    return { error: lote.error };
  }

  const err = await aplicarIngresoStockUnitario(supabase, gate, postaId, {
    fecha,
    medicamentoId,
    cantidad,
    loteId: lote.loteId,
    tipoOrigen,
    referencia,
    observacion,
  });
  if (err.error) {
    return { error: err.error };
  }

  revalidatePath(`/postas/${postaId}/ingresos`);
  revalidatePath(`/postas/${postaId}/dashboard`);
  revalidatePath(`/postas/${postaId}/descuento`);
  revalidatePath(`/postas/${postaId}/pedidos`);
  revalidatePath("/admin/medicamentos");
  return { ok: true, success: "Ingreso registrado." };
}

/**
 * Declaración manual del stock en AVIS por mes (no se deriva de descuentos ni ingresos).
 * Una fila por medicamento activo del catálogo.
 */
export async function guardarDeclaracionStockAvisMensualAction(
  postaId: string,
  _prev: PostaActionState,
  formData: FormData
): Promise<PostaActionState> {
  const gate = await assertStockYAvisPosta(postaId);
  if (!gate.ok) {
    return { error: gate.error };
  }

  const ym = formData.get("ym")?.toString().trim() ?? "";
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    return { error: "El mes indicado no es válido." };
  }
  const [anioRaw, mesRaw] = ym.split("-").map(Number);
  if (
    Number.isNaN(anioRaw) ||
    Number.isNaN(mesRaw) ||
    anioRaw < 2020 ||
    anioRaw > 2100 ||
    mesRaw < 1 ||
    mesRaw > 12
  ) {
    return { error: "El mes indicado no es válido." };
  }

  const rawIds = formData.get("medicamento_ids_json")?.toString();
  let medicamentoIds: string[] = [];
  try {
    const parsed = rawIds ? JSON.parse(rawIds) : [];
    if (!Array.isArray(parsed)) throw new Error("not array");
    medicamentoIds = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return {
      error: "Datos del formulario inválidos. Recarga la página e intenta de nuevo.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const abierto = await validarMesAbierto(supabase, postaId, anioRaw, mesRaw);
  if (!abierto.ok) {
    return { error: abierto.error };
  }

  const { data: activos, error: actErr } = await supabase
    .from("medicamentos")
    .select("id")
    .eq("activo", true);

  if (actErr) {
    return { error: actErr.message };
  }

  const esperados = new Set(
    (activos ?? [])
      .map((r) => (r as { id?: string }).id)
      .filter((id): id is string => typeof id === "string")
  );

  const recibidos = new Set(medicamentoIds);
  if (recibidos.size !== medicamentoIds.length) {
    return { error: "Lista de medicamentos duplicada. Recarga la página." };
  }
  if (recibidos.size !== esperados.size) {
    return {
      error:
        "El listado no coincide con el catálogo actual. Recarga la página e intenta de nuevo.",
    };
  }
  for (const id of medicamentoIds) {
    if (!esperados.has(id)) {
      return {
        error:
          "Hay medicamentos que ya no están activos. Recarga la página e intenta de nuevo.",
      };
    }
  }

  const { data: prevAvisRows } = await supabase
    .from("stock_avis_mensual")
    .select("medicamento_id, stock_avis_cantidad")
    .eq("posta_id", postaId)
    .eq("anio", anioRaw)
    .eq("mes", mesRaw);

  const rows: {
    posta_id: string;
    medicamento_id: string;
    anio: number;
    mes: number;
    stock_avis_cantidad: number;
  }[] = [];

  for (const medicamentoId of medicamentoIds) {
    const raw = formData.get(`avis_${medicamentoId}`)?.toString() ?? "";
    const t = raw.trim();
    const n =
      t === "" ? 0 : Number.parseInt(t.replace(/\s+/g, ""), 10);
    if (Number.isNaN(n) || n < 0) {
      return {
        error:
          "Todas las cantidades deben ser números enteros mayores o iguales a 0.",
      };
    }
    rows.push({
      posta_id: postaId,
      medicamento_id: medicamentoId,
      anio: anioRaw,
      mes: mesRaw,
      stock_avis_cantidad: n,
    });
  }

  const { error } = await supabase.from("stock_avis_mensual").upsert(rows, {
    onConflict: "posta_id,medicamento_id,anio,mes",
  });

  if (error) {
    return { error: error.message };
  }

  const prevMap = new Map<string, number>();
  if (Array.isArray(prevAvisRows)) {
    for (const row of prevAvisRows) {
      const r = row as Record<string, unknown>;
      if (typeof r.medicamento_id === "string") {
        const n = Number(r.stock_avis_cantidad);
        prevMap.set(r.medicamento_id, Number.isFinite(n) ? Math.trunc(n) : 0);
      }
    }
  }

  const cambios = rows
    .filter((r) => (prevMap.get(r.medicamento_id) ?? 0) !== r.stock_avis_cantidad)
    .map((r) => ({
      medicamentoId: r.medicamento_id,
      anterior: prevMap.get(r.medicamento_id) ?? 0,
      nuevo: r.stock_avis_cantidad,
    }));

  await registrarAuditLog(supabase, {
    actorId: gate.userId,
    action: "stock_avis.guardar_declaracion",
    entity: "stock_avis_mensual",
    metadata: { postaId, anio: anioRaw, mes: mesRaw, cambios },
  });

  revalidatePath(`/postas/${postaId}/avis`);
  revalidatePath(`/postas/${postaId}/dashboard`);
  revalidatePath(`/postas/${postaId}/descuento`);
  revalidatePath(`/postas/${postaId}/pedidos`);
  return { ok: true, success: "Declaración de stock AVIS guardada." };
}

export async function cerrarMesPostaAction(
  postaId: string,
  _prev: PostaActionState,
  formData: FormData
): Promise<PostaActionState> {
  const ctx = await requirePerfilUsuario();
  if (!puedeVerPosta(ctx.profile, postaId)) {
    return { error: "No tienes permiso para esta posta." };
  }
  if (!puedeGestionarPedidoMensualPosta(ctx.profile, postaId)) {
    return { error: "Solo el encargado responsable puede cerrar el mes de la posta." };
  }

  const anio = Number(formData.get("anio"));
  const mes = Number(formData.get("mes"));
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
    return { error: "Mes no válido." };
  }

  const supabase = await createServerSupabaseClient();
  if (await mesEstaCerrado(supabase, postaId, anio, mes)) {
    return { error: "Este mes ya está cerrado." };
  }

  if (!permiteCierreMensualCalendarioOperacion(anio, mes)) {
    return {
      error:
        "Solo se puede cerrar el mes el último día hábil.",
    };
  }

  let filas;
  let resumenTotales;
  try {
    const resultado = await obtenerFilasConciliacionCierre(supabase, postaId, anio, mes);
    filas = resultado.filas;
    resumenTotales = resultado.resumen;
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No se pudo calcular el cierre del mes.",
    };
  }

  const resumen = {
    totalMedicamentos: resumenTotales.totalMedicamentos,
    totalDisponible: resumenTotales.disponible,
    totalAvis: resumenTotales.avis,
    diferenciasAvis: resumenTotales.diferencias,
    bajoCritico: resumenTotales.bajoCritico,
    detalle: filas,
  };

  const { data: cierre, error } = await supabase
    .from("cierres_mensuales_posta")
    .insert({
      posta_id: postaId,
      anio,
      mes,
      cerrado_por: ctx.user.id,
      resumen,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  await registrarAuditLog(supabase, {
    actorId: ctx.user.id,
    action: "cierre_mensual.cerrado",
    entity: "cierres_mensuales_posta",
    entityId:
      cierre && typeof cierre === "object" && "id" in cierre
        ? String((cierre as { id: string }).id)
        : null,
    metadata: { postaId, anio, mes, resumen },
  });

  revalidatePath(`/postas/${postaId}/cierre`);
  revalidatePath(`/postas/${postaId}/descuento`);
  revalidatePath(`/postas/${postaId}/ingresos`);
  revalidatePath(`/postas/${postaId}/avis`);
  revalidatePath(`/postas/${postaId}/pedidos`);
  return { ok: true, success: "Mes cerrado. Los movimientos quedan bloqueados." };
}

export async function reabrirCierreMensualPostaAction(
  postaId: string,
  _prev: PostaActionState,
  formData: FormData
): Promise<PostaActionState> {
  const ctx = await requirePerfilUsuario();
  if (!esAdminGeneral(ctx.profile)) {
    return { error: "Solo administración general puede reabrir un mes cerrado." };
  }

  const cierreId = formData.get("cierre_id")?.toString().trim();
  const motivo = parseTextoOpcional(formData.get("motivo_reapertura"));
  if (!cierreId || !motivo) {
    return { error: "Indica el cierre y el motivo de reapertura." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: row, error: selErr } = await supabase
    .from("cierres_mensuales_posta")
    .select("id, posta_id, anio, mes, reabierto_en")
    .eq("id", cierreId)
    .eq("posta_id", postaId)
    .maybeSingle();

  if (selErr || !row || typeof row !== "object") {
    return { error: "No se encontró el cierre mensual." };
  }
  if ((row as { reabierto_en?: string | null }).reabierto_en) {
    return { error: "Este cierre ya fue reabierto." };
  }

  const { error } = await supabase
    .from("cierres_mensuales_posta")
    .update({
      reabierto_por: ctx.user.id,
      reabierto_en: new Date().toISOString(),
      motivo_reapertura: motivo,
    })
    .eq("id", cierreId);

  if (error) {
    return { error: error.message };
  }

  await registrarAuditLog(supabase, {
    actorId: ctx.user.id,
    action: "cierre_mensual.reabierto",
    entity: "cierres_mensuales_posta",
    entityId: cierreId,
    metadata: { postaId, motivo, cierre: row },
  });

  revalidatePath(`/postas/${postaId}/cierre`);
  revalidatePath(`/postas/${postaId}/descuento`);
  revalidatePath(`/postas/${postaId}/ingresos`);
  revalidatePath(`/postas/${postaId}/avis`);
  revalidatePath(`/postas/${postaId}/pedidos`);
  return { ok: true, success: "Mes reabierto para correcciones." };
}
