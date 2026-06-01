import { PostaPageHeader } from "@/components/posta/posta-page-header";
import {
  InsumosSeccionTabs,
  type InsumosTab,
} from "@/components/posta/insumos-seccion-tabs";
import { PedidoInsumosPanel, type PedidoInsumosLineaCliente } from "@/components/posta/pedido-insumos-panel";
import {
  StockInsumosDashboard,
  type FilaStockInsumoDashboard,
} from "@/components/posta/stock-insumos-dashboard";
import {
  puedeGestionarPedidoMensualPosta,
  puedeRegistrarStockYAvisPosta,
  requirePerfilUsuario,
  tieneAccesoGlobalAdmin,
} from "@/lib/auth/session";
import { etiquetaInstanteChile24h } from "@/lib/domain/fecha-mes";
import { postaEnvioPedidoInsumosHoy } from "@/lib/posta/reglas-repeticion-dia";
import { nivelAlertaStock, nivelStockListadoVisual } from "@/lib/posta/admin-stock-alerta-postas";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ postaId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function parseTab(raw: string | undefined): InsumosTab {
  return raw === "pedido" ? "pedido" : "stock";
}

export default async function PostaInsumosPage({ params, searchParams }: PageProps) {
  const { postaId } = await params;
  const { tab: tabRaw } = await searchParams;
  const tabActiva = parseTab(tabRaw);

  const { profile } = await requirePerfilUsuario();
  const puedeEditarPedido = puedeGestionarPedidoMensualPosta(profile, postaId);
  const puedeEditarStock = puedeRegistrarStockYAvisPosta(profile, postaId);

  const supabase = await createServerSupabaseClient();

  const [{ data: insumos }, { data: postaMeta }, { data: pedidoRow }, { data: stockInsumosRows }] =
    await Promise.all([
      supabase
        .from("insumos")
        .select("id, nombre, unidad_medida, stock_objetivo")
        .eq("activo", true)
        .order("nombre", { ascending: true }),
      supabase.from("postas").select("nombre, codigo").eq("id", postaId).maybeSingle(),
      supabase
        .from("pedidos_insumos")
        .select("id, estado, enviado_en, comentario_admin")
        .eq("posta_id", postaId)
        .in("estado", ["OBSERVADO", "ENVIADO", "APROBADO", "DESPACHADO", "RECIBIDO", "RECHAZADO"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("stock_insumos_posta")
        .select("insumo_id, cantidad")
        .eq("posta_id", postaId),
    ]);

  let postaNombre: string | null = null;
  let postaCodigo: string | null = null;
  if (postaMeta && typeof postaMeta === "object") {
    const pm = postaMeta as Record<string, unknown>;
    if (typeof pm.nombre === "string") postaNombre = pm.nombre.trim();
    if (pm.codigo === null || typeof pm.codigo === "string") postaCodigo = pm.codigo as string | null;
  }

  type InsumoRow = {
    id: string;
    nombre: string;
    unidad: string;
    stock_objetivo: number;
  };

  const insumosLista: InsumoRow[] = [];
  if (insumos && Array.isArray(insumos)) {
    for (const row of insumos) {
      const r = row as Record<string, unknown>;
      if (typeof r.id === "string" && typeof r.nombre === "string") {
        insumosLista.push({
          id: r.id,
          nombre: r.nombre,
          unidad: typeof r.unidad_medida === "string" ? r.unidad_medida : "unidad",
          stock_objetivo: toInt(r.stock_objetivo),
        });
      }
    }
  }

  const stockInsumosPorId = new Map<string, number>();
  if (stockInsumosRows && Array.isArray(stockInsumosRows)) {
    for (const row of stockInsumosRows) {
      const r = row as Record<string, unknown>;
      if (typeof r.insumo_id === "string") {
        stockInsumosPorId.set(r.insumo_id, toInt(r.cantidad));
      }
    }
  }

  const filasStockInsumos: FilaStockInsumoDashboard[] = insumosLista.map((ins) => {
    const registrado = stockInsumosPorId.has(ins.id);
    const cantidad = registrado ? (stockInsumosPorId.get(ins.id) ?? 0) : null;
    const disp = cantidad ?? 0;
    const stockObjetivo = ins.stock_objetivo;
    const nivel = cantidad === null ? null : nivelAlertaStock(disp, 0, stockObjetivo);
    const tono =
      cantidad === null
        ? ("regular" as const)
        : nivelStockListadoVisual(disp, 0, stockObjetivo);
    return {
      id: ins.id,
      nombre: ins.nombre,
      unidad: ins.unidad,
      stockObjetivo,
      cantidad,
      nivel,
      tono,
    };
  });

  const nStockCritico = filasStockInsumos.filter((f) => f.nivel === "critico").length;

  const pedidoId =
    pedidoRow && typeof pedidoRow === "object" && "id" in pedidoRow
      ? String((pedidoRow as { id: string }).id)
      : null;

  const estadoRaw =
    pedidoRow && typeof pedidoRow === "object" && "estado" in pedidoRow
      ? String((pedidoRow as { estado: string }).estado)
      : null;

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
  const estadoPedido: EstadoPedido | null =
    estadoRaw && ESTADOS_VALIDOS.includes(estadoRaw as EstadoPedido)
      ? (estadoRaw as EstadoPedido)
      : null;

  const pedidoPendienteAtencion =
    estadoPedido === "OBSERVADO" || estadoPedido === "RECHAZADO";

  const enviadoEnIso =
    pedidoRow &&
    typeof pedidoRow === "object" &&
    "enviado_en" in pedidoRow &&
    typeof (pedidoRow as { enviado_en: unknown }).enviado_en === "string"
      ? String((pedidoRow as { enviado_en: string }).enviado_en)
      : null;
  const enviadoEtiqueta = enviadoEnIso ? etiquetaInstanteChile24h(enviadoEnIso) : null;

  const comentarioAdmin =
    pedidoRow &&
    typeof pedidoRow === "object" &&
    "comentario_admin" in pedidoRow &&
    typeof (pedidoRow as { comentario_admin: unknown }).comentario_admin === "string"
      ? String((pedidoRow as { comentario_admin: string }).comentario_admin)
      : null;

  const { data: detalleRows } = pedidoId
    ? await supabase
        .from("detalle_pedido_insumos")
        .select("insumo_id, stock_objetivo, stock_actual, cantidad_pedido")
        .eq("pedido_id", pedidoId)
    : { data: null as null };

  const detallePorInsumo = new Map<
    string,
    { stock_objetivo: number; stock_actual: number; cantidad_pedido: number }
  >();
  if (detalleRows && Array.isArray(detalleRows)) {
    for (const row of detalleRows) {
      const r = row as Record<string, unknown>;
      if (typeof r.insumo_id === "string") {
        detallePorInsumo.set(r.insumo_id, {
          stock_objetivo: toInt(r.stock_objetivo),
          stock_actual: toInt(r.stock_actual),
          cantidad_pedido: toInt(r.cantidad_pedido),
        });
      }
    }
  }

  const pedidoEnProceso =
    estadoPedido === "ENVIADO" ||
    estadoPedido === "APROBADO" ||
    estadoPedido === "DESPACHADO";

  const puedeEnviarPedido =
    puedeEditarPedido &&
    !pedidoEnProceso &&
    (estadoPedido === null ||
      estadoPedido === "OBSERVADO" ||
      estadoPedido === "RECHAZADO" ||
      estadoPedido === "RECIBIDO");

  const lineasPedido: PedidoInsumosLineaCliente[] = insumosLista.map((ins) => {
    const det = detallePorInsumo.get(ins.id);
    const stockObjetivo = puedeEnviarPedido
      ? ins.stock_objetivo
      : (det?.stock_objetivo ?? ins.stock_objetivo);
    const stockConocido =
      estadoPedido === "OBSERVADO" || stockInsumosPorId.has(ins.id);
    let stockActual = 0;
    if (puedeEnviarPedido) {
      if (estadoPedido === "OBSERVADO") {
        stockActual = det?.stock_actual ?? 0;
      } else if (stockInsumosPorId.has(ins.id)) {
        stockActual = stockInsumosPorId.get(ins.id) ?? 0;
      }
    } else {
      stockActual = det?.stock_actual ?? stockInsumosPorId.get(ins.id) ?? 0;
    }
    const cantidadSugerida = stockConocido
      ? Math.max(0, stockObjetivo - stockActual)
      : 0;
    const cantidadPedido =
      puedeEnviarPedido && estadoPedido === "RECIBIDO"
        ? cantidadSugerida
        : det
          ? det.cantidad_pedido
          : cantidadSugerida;
    return {
      insumoId: ins.id,
      nombre: ins.nombre,
      stock_objetivo: stockObjetivo,
      stock_actual: stockActual,
      stock_conocido: stockConocido,
      cantidad_sugerida: cantidadSugerida,
      cantidad_pedido: cantidadPedido,
    };
  });

  const pedidoEnviadoHoy =
    puedeEnviarPedido && (await postaEnvioPedidoInsumosHoy(supabase, postaId, pedidoId));

  return (
    <div className="space-y-6">
      <PostaPageHeader
        title="Insumos"
        description={
          <>
            {postaNombre ? (
              <>
                <span className="font-medium text-foreground">{postaNombre}</span>
                {postaCodigo ? <span className="ml-1.5">· código {postaCodigo}</span> : null}
                <span className="mt-1 block">
                  Registra el stock de insumos y arma el pedido a administración desde un solo lugar.
                </span>
              </>
            ) : (
              "Registra stock y pide insumos a administración."
            )}
            {tieneAccesoGlobalAdmin(profile) ? (
              <span className="mt-2 block rounded-md border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-xs text-sky-950 dark:text-sky-50">
                Vista desde supervisión: este formulario corresponde a la posta indicada arriba.
              </span>
            ) : null}
          </>
        }
      />

      <InsumosSeccionTabs
        postaId={postaId}
        tabActiva={tabActiva}
        nStockCritico={nStockCritico}
        pedidoPendienteAtencion={pedidoPendienteAtencion}
        panelStock={
          <StockInsumosDashboard
            postaId={postaId}
            filas={filasStockInsumos}
            puedeEditar={puedeEditarStock}
            embebido
          />
        }
        panelPedido={
          <PedidoInsumosPanel
            postaId={postaId}
            pedidoId={pedidoId}
            estado={estadoPedido}
            enviadoEtiqueta={enviadoEtiqueta}
            comentarioAdmin={comentarioAdmin}
            puedeEditar={puedeEnviarPedido}
            pedidoEnviadoHoy={pedidoEnviadoHoy}
            lineas={lineasPedido}
          />
        }
      />
    </div>
  );
}
