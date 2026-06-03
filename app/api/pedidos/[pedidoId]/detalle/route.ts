import { NextResponse } from "next/server";

import {
  esBodegaFarmacia,
  requirePerfilUsuario,
  tieneAccesoGlobalAdmin,
} from "@/lib/auth/session";
import { cargarDetallePedidoMensual } from "@/lib/posta/pedido-mensual-detalle";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ pedidoId: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const { pedidoId } = await ctx.params;

  let profile;
  try {
    const session = await requirePerfilUsuario();
    profile = session.profile;
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!tieneAccesoGlobalAdmin(profile) && !esBodegaFarmacia(profile)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  const result = await cargarDetallePedidoMensual(supabase, pedidoId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
