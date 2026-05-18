import { NextResponse } from "next/server";

import {
  puedeRegistrarOperacionesPosta,
  requirePerfilUsuario,
} from "@/lib/auth/session";
import {
  registrarConsumoDiario,
  revalidateRutasTrasConsumoDiario,
  validarCamposConsumoDiario,
} from "@/lib/posta/registrar-consumo-diario";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncMovementBody = {
  clientSyncId: string;
  medicamentoId: string;
  fecha: string;
  cantidadConAvis: number;
  cantidadSinAvis: number;
  observacion?: string | null;
};

type SyncRequestBody = {
  movements?: SyncMovementBody[];
};

export async function POST(
  request: Request,
  context: { params: Promise<{ postaId: string }> }
) {
  const { postaId } = await context.params;
  const { profile, user } = await requirePerfilUsuario();

  if (!puedeRegistrarOperacionesPosta(profile, postaId)) {
    return NextResponse.json(
      {
        error:
          "Solo el encargado de esta posta puede registrar descuentos diarios.",
      },
      { status: 403 }
    );
  }

  let body: SyncRequestBody;
  try {
    body = (await request.json()) as SyncRequestBody;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const movements = body.movements;
  if (!Array.isArray(movements) || movements.length === 0) {
    return NextResponse.json(
      { error: "Se requiere al menos un movimiento." },
      { status: 400 }
    );
  }

  if (movements.length > 100) {
    return NextResponse.json(
      { error: "Máximo 100 movimientos por solicitud de sincronización." },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const results: {
    clientSyncId: string;
    ok: boolean;
    error?: string;
    entityId?: string | null;
  }[] = [];

  for (const mov of movements) {
    const clientSyncId =
      typeof mov.clientSyncId === "string" ? mov.clientSyncId.trim() : "";
    const medicamentoId =
      typeof mov.medicamentoId === "string" ? mov.medicamentoId.trim() : "";
    const fecha = typeof mov.fecha === "string" ? mov.fecha.trim() : "";
    const cantidadConAvis = Number(mov.cantidadConAvis);
    const cantidadSinAvis = Number(mov.cantidadSinAvis);
    const observacionRaw = mov.observacion;
    const observacion =
      typeof observacionRaw === "string"
        ? observacionRaw.trim().slice(0, 500) || null
        : null;

    if (!clientSyncId) {
      results.push({
        clientSyncId: clientSyncId || "(vacío)",
        ok: false,
        error: "Falta clientSyncId.",
      });
      continue;
    }

    const campoErr = validarCamposConsumoDiario({
      fecha,
      medicamentoId,
      cantidadConAvis,
      cantidadSinAvis,
    });
    if (campoErr) {
      results.push({ clientSyncId, ok: false, error: campoErr });
      continue;
    }

    const result = await registrarConsumoDiario(supabase, {
      postaId,
      medicamentoId,
      fecha,
      cantidadConAvis,
      cantidadSinAvis,
      observacion,
      clientSyncId,
      userId: user.id,
    });

    if (result.ok) {
      results.push({
        clientSyncId,
        ok: true,
        entityId: result.entityId,
      });
    } else {
      results.push({ clientSyncId, ok: false, error: result.error });
    }
  }

  const synced = results.filter((r) => r.ok).length;
  if (synced > 0) {
    revalidateRutasTrasConsumoDiario(postaId);
  }

  return NextResponse.json({
    ok: results.every((r) => r.ok),
    synced,
    total: results.length,
    results,
  });
}
