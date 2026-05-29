import { redirect } from "next/navigation";

import { PedidosInsumosAdminPanel, type PedidoInsumosAdminRow } from "@/components/admin/pedidos-insumos-admin-panel";
import { PostaPageHeader } from "@/components/posta/posta-page-header";
import { requirePerfilUsuario, tieneAccesoGlobalAdmin, esAdminGeneral } from "@/lib/auth/session";
import { etiquetaInstanteChile24h } from "@/lib/domain/fecha-mes";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EstadoPedido =
  | "BORRADOR"
  | "ENVIADO"
  | "APROBADO"
  | "OBSERVADO"
  | "RECHAZADO"
  | "DESPACHADO"
  | "RECIBIDO";

const ESTADOS_VALIDOS: EstadoPedido[] = [
  "BORRADOR",
  "ENVIADO",
  "APROBADO",
  "OBSERVADO",
  "RECHAZADO",
  "DESPACHADO",
  "RECIBIDO",
];

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export default async function AdminPedidosInsumosPage() {
  const { profile } = await requirePerfilUsuario();

  if (!tieneAccesoGlobalAdmin(profile)) {
    redirect("/");
  }

  const puedeGestionar = esAdminGeneral(profile);
  const supabase = await createServerSupabaseClient();

  const { data: pedidosRaw, error } = await supabase
    .from("pedidos_insumos")
    .select(
      `id, posta_id, estado, enviado_en, created_at, comentario_admin,
      postas ( nombre, codigo )`
    )
    .neq("estado", "BORRADOR")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="space-y-4">
        <PostaPageHeader title="Pedidos de insumos" />
        <p className="text-sm text-destructive">Error al cargar pedidos: {error.message}</p>
      </div>
    );
  }

  const pedidoIds = (pedidosRaw ?? [])
    .map((r) => (r as Record<string, unknown>).id as string)
    .filter(Boolean);

  const detalleMap = new Map<string, { insumoNombre: string; cantidad_pedido: number }[]>();

  if (pedidoIds.length > 0) {
    const { data: detalleRaw } = await supabase
      .from("detalle_pedido_insumos")
      .select("pedido_id, cantidad_pedido, insumos ( nombre )")
      .in("pedido_id", pedidoIds)
      .gt("cantidad_pedido", 0);

    if (detalleRaw && Array.isArray(detalleRaw)) {
      for (const row of detalleRaw) {
        const r = row as Record<string, unknown>;
        const pid = typeof r.pedido_id === "string" ? r.pedido_id : null;
        const insumoObj = r.insumos as Record<string, unknown> | null;
        const insumoNombre =
          insumoObj && typeof insumoObj.nombre === "string" ? insumoObj.nombre : "Insumo";
        if (!pid) continue;
        const prev = detalleMap.get(pid) ?? [];
        prev.push({ insumoNombre, cantidad_pedido: toInt(r.cantidad_pedido) });
        detalleMap.set(pid, prev);
      }
    }
  }

  const pedidos: PedidoInsumosAdminRow[] = [];
  if (pedidosRaw && Array.isArray(pedidosRaw)) {
    for (const row of pedidosRaw) {
      const r = row as Record<string, unknown>;
      if (typeof r.id !== "string") continue;

      const estadoRaw = typeof r.estado === "string" ? r.estado : null;
      const estado: EstadoPedido | null =
        estadoRaw && ESTADOS_VALIDOS.includes(estadoRaw as EstadoPedido)
          ? (estadoRaw as EstadoPedido)
          : null;
      if (!estado) continue;

      const postaObj = r.postas as Record<string, unknown> | null;
      const postaNombre =
        postaObj && typeof postaObj.nombre === "string" ? postaObj.nombre : "Posta";
      const postaCodigo =
        postaObj && typeof postaObj.codigo === "string" ? postaObj.codigo : null;

      const enviadoEn =
        typeof r.enviado_en === "string" ? etiquetaInstanteChile24h(r.enviado_en) : null;
      const creadoEn =
        typeof r.created_at === "string" ? etiquetaInstanteChile24h(r.created_at) : null;

      const detalle = detalleMap.get(r.id) ?? [];

      pedidos.push({
        id: r.id,
        posta_id: typeof r.posta_id === "string" ? r.posta_id : "",
        postaNombre,
        postaCodigo,
        estado,
        enviadoEtiqueta: enviadoEn,
        creadoEtiqueta: creadoEn,
        comentarioAdmin: typeof r.comentario_admin === "string" ? r.comentario_admin : null,
        detalle,
      });
    }
  }

  return (
    <div className="space-y-6">
      <PostaPageHeader
        title="Pedidos de insumos"
        description="Revisa y gestiona los pedidos de insumos enviados por las postas."
      />
      <PedidosInsumosAdminPanel pedidos={pedidos} puedeGestionar={puedeGestionar} />
    </div>
  );
}
