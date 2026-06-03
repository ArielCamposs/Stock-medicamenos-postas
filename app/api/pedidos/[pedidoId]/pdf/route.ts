import { NextResponse } from "next/server";

import { buildPedidoMensualPdfBytes } from "@/lib/pdf/pedido-mensual-pdf";
import { cargarDatosPdfPedidoMensual } from "@/lib/posta/pedido-mensual-pdf-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

  const datos = await cargarDatosPdfPedidoMensual(supabase, pedidoId);
  if (!datos.ok) {
    return new NextResponse(datos.error, { status: datos.status });
  }

  const bytes = await buildPedidoMensualPdfBytes({
    postaNombre: datos.postaNombre,
    postaCodigo: datos.postaCodigo,
    anio: datos.anio,
    mes: datos.mes,
    estado: datos.estado,
    tipo: datos.tipo,
    enviadoEnLabel: datos.enviadoEnLabel,
    lineas: datos.lineas,
  });

  const sufijoTipo = datos.tipo === "CONTRA_RECETA" ? "contra-receta" : "general";
  const safeName = `pedido-${sufijoTipo}-${datos.anio}-${String(datos.mes).padStart(2, "0")}-${datos.postaNombre.slice(0, 24).replace(/[^\w\-]+/g, "_")}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
