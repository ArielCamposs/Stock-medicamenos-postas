import { NextResponse } from "next/server";

import { puedeVerPosta, requirePerfilUsuario } from "@/lib/auth/session";
import { obtenerFilasConciliacionCierre } from "@/lib/posta/cierre-conciliacion-filas";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ postaId: string }> }
) {
  const { postaId } = await context.params;
  const { profile } = await requirePerfilUsuario();

  if (!puedeVerPosta(profile, postaId)) {
    return NextResponse.json({ error: "No tienes permiso para esta posta." }, { status: 403 });
  }

  const url = new URL(request.url);
  const anio = Number(url.searchParams.get("anio"));
  const mes = Number(url.searchParams.get("mes"));

  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "Mes no válido." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  try {
    const { filas, resumen } = await obtenerFilasConciliacionCierre(
      supabase,
      postaId,
      anio,
      mes
    );
    return NextResponse.json({ filas, resumen });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al cargar el detalle.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
