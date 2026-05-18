import { PostaMesToolbar, tituloMesChile } from "@/components/posta/posta-mes-toolbar";
import { PostaPageHeader } from "@/components/posta/posta-page-header";
import { PedidoVolverMenuButton } from "@/components/posta/pedido-volver-menu-button";
import {
  PedidoMensualPanel,
  type PedidoMensualLineaCliente,
} from "@/components/posta/pedido-mensual-panel";
import {
  puedeGestionarPedidoMensualPosta,
  requirePerfilUsuario,
  tieneAccesoGlobalAdmin,
} from "@/lib/auth/session";
import { cantidadPedidoSegunStockReferencial } from "@/lib/domain/pedido-mensual";
import {
  anioMesActual,
  etiquetaInstanteChile24h,
} from "@/lib/domain/fecha-mes";
import {
  compararMedicamentoPorCategoriaNombre,
  normalizarMedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import { snapshotLedgerMesPosta } from "@/lib/posta/snapshot-ledger-mes-posta";
import { obtenerCierreMensualPosta } from "@/lib/posta/cierre-mensual";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ postaId: string }>;
  searchParams: Promise<{ ym?: string; from?: string }>;
};

function parseYm(raw: string | undefined): { anio: number; mes: number } {
  if (raw && typeof raw === "string" && /^\d{4}-\d{2}$/.test(raw.trim())) {
    const [a, m] = raw.trim().split("-").map(Number);
    if (a >= 2020 && a <= 2100 && m >= 1 && m <= 12) {
      return { anio: a, mes: m };
    }
  }
  return anioMesActual();
}

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.trunc(v);
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function ymParam(anio: number, mes: number) {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

export default async function PostaPedidosPage({ params, searchParams }: PageProps) {
  const { postaId } = await params;
  const qs = await searchParams;
  const { anio, mes } = parseYm(qs?.ym);
  const ymQuery = ymParam(anio, mes);

  const ctx = await requirePerfilUsuario();
  const { profile } = ctx;
  const volverBandejaAdmin = qs?.from === "admin" && tieneAccesoGlobalAdmin(profile);
  const puedeGestionarPedido = puedeGestionarPedidoMensualPosta(profile, postaId);
  const supabase = await createServerSupabaseClient();
  const cierre = await obtenerCierreMensualPosta(supabase, postaId, anio, mes);
  const puedeRegistrar = puedeGestionarPedido && !cierre;

  const [{ data: medicamentos }, { data: pedidoRow, error: pedidoErr }, { data: postaMeta }] =
    await Promise.all([
      supabase
        .from("medicamentos")
        .select(
          "id, nombre, codigo_interno, unidad_medida, categoria, stock_recomendado_default, stock_critico_default"
        )
        .eq("activo", true)
        .order("categoria", { ascending: true })
        .order("nombre", { ascending: true }),
      supabase
        .from("pedidos_mensuales")
        .select("id, estado, anio, mes, enviado_en")
        .eq("posta_id", postaId)
        .eq("anio", anio)
        .eq("mes", mes)
        .maybeSingle(),
      supabase.from("postas").select("nombre, codigo").eq("id", postaId).maybeSingle(),
    ]);

  let postaNombreCabecera: string | null = null;
  let postaCodigoCabecera: string | null = null;
  if (postaMeta && typeof postaMeta === "object") {
    const pm = postaMeta as Record<string, unknown>;
    if (typeof pm.nombre === "string" && pm.nombre.trim()) {
      postaNombreCabecera = pm.nombre.trim();
    }
    if (pm.codigo === null || typeof pm.codigo === "string") {
      postaCodigoCabecera = pm.codigo as string | null;
    }
  }

  type MedRow = {
    id: string;
    nombre: string;
    codigo_interno: string;
    unidad_medida: string;
    categoria: ReturnType<typeof normalizarMedicamentoCategoria>;
    stock_recomendado_default: number;
    stock_critico_default: number;
  };

  const meds: MedRow[] = [];
  if (medicamentos && Array.isArray(medicamentos)) {
    for (const row of medicamentos) {
      const r = row as Record<string, unknown>;
      if (
        typeof r.id === "string" &&
        typeof r.nombre === "string" &&
        typeof r.codigo_interno === "string" &&
        typeof r.unidad_medida === "string"
      ) {
        meds.push({
          id: r.id,
          nombre: r.nombre,
          codigo_interno: r.codigo_interno,
          unidad_medida: r.unidad_medida,
          categoria: normalizarMedicamentoCategoria(
            typeof r.categoria === "string" ? r.categoria : undefined
          ),
          stock_recomendado_default: toInt(r.stock_recomendado_default),
          stock_critico_default: toInt(r.stock_critico_default),
        });
      }
    }
  }

  meds.sort((a, b) =>
    compararMedicamentoPorCategoriaNombre(
      a.categoria,
      a.nombre,
      b.categoria,
      b.nombre
    )
  );

  const pedidoId =
    pedidoRow && typeof pedidoRow === "object" && "id" in pedidoRow
      ? String((pedidoRow as { id: string }).id)
      : null;

  const estadoRaw =
    pedidoRow && typeof pedidoRow === "object" && "estado" in pedidoRow
      ? String((pedidoRow as { estado: string }).estado)
      : null;
  const estadoPedido =
    estadoRaw === "BORRADOR" ||
    estadoRaw === "ENVIADO" ||
    estadoRaw === "APROBADO" ||
    estadoRaw === "OBSERVADO" ||
    estadoRaw === "RECHAZADO" ||
    estadoRaw === "DESPACHADO" ||
    estadoRaw === "RECIBIDO"
      ? estadoRaw
      : null;

  const enviadoEnIso =
    pedidoRow &&
    typeof pedidoRow === "object" &&
    "enviado_en" in pedidoRow &&
    (pedidoRow as { enviado_en: unknown }).enviado_en !== null &&
    typeof (pedidoRow as { enviado_en: unknown }).enviado_en === "string"
      ? String((pedidoRow as { enviado_en: string }).enviado_en)
      : null;

  const enviadoEtiqueta = enviadoEnIso ? etiquetaInstanteChile24h(enviadoEnIso) : null;

  const { data: detalleRows } = pedidoId
    ? await supabase
        .from("detalle_pedido_mensual")
        .select("medicamento_id, cantidad_sugerida, cantidad_final")
        .eq("pedido_id", pedidoId)
    : { data: null as null };

  const detallePorMed = new Map<string, { sugerida: number; final: number }>();
  if (detalleRows && Array.isArray(detalleRows)) {
    for (const row of detalleRows) {
      const r = row as Record<string, unknown>;
      if (typeof r.medicamento_id === "string") {
        detallePorMed.set(r.medicamento_id, {
          sugerida: toInt(r.cantidad_sugerida),
          final: toInt(r.cantidad_final),
        });
      }
    }
  }

  const snapshot = await snapshotLedgerMesPosta(
    supabase,
    postaId,
    anio,
    mes,
    meds.map((m) => ({
      id: m.id,
      stock_recomendado_default: m.stock_recomendado_default,
      stock_critico_default: m.stock_critico_default,
    }))
  );

  const lineas: PedidoMensualLineaCliente[] = meds.map((m) => {
    const s = snapshot.get(m.id)!;
    const sug = cantidadPedidoSegunStockReferencial(s.disponible, s.stock_recomendado);
    const det = detallePorMed.get(m.id);
    const finalVal = det ? det.final : sug;
    return {
      medicamentoId: m.id,
      nombre: m.nombre,
      codigo_interno: m.codigo_interno,
      unidad_medida: m.unidad_medida,
      categoria: m.categoria,
      stock_recomendado: s.stock_recomendado,
      stock_critico: s.stock_critico,
      disponible: s.disponible,
      cantidad_sugerida: sug,
      cantidad_final: finalVal,
    };
  });

  const basePath = `/postas/${postaId}/pedidos`;
  const queryExtra = volverBandejaAdmin ? { from: "admin" } : undefined;

  return (
    <div className="space-y-6">
      {tieneAccesoGlobalAdmin(profile) ? (
        <div className="relative z-10 flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <PedidoVolverMenuButton>← Menú principal de pedidos</PedidoVolverMenuButton>
        </div>
      ) : null}

      <PostaPageHeader
        title={`Pedido · ${tituloMesChile(anio, mes)}`}
        description={
          <>
            {postaNombreCabecera ? (
              <>
                <span className="font-medium text-foreground">{postaNombreCabecera}</span>
                {postaCodigoCabecera ? (
                  <span className="ml-1.5">· código {postaCodigoCabecera}</span>
                ) : null}
                <span className="mt-1 block">
                  Un pedido por posta y por mes; lo que ves acá corresponde solo a esta posta.
                </span>
              </>
            ) : (
              "Un pedido por posta y por mes."
            )}
            {volverBandejaAdmin ? (
              <span className="mt-2 block rounded-md border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-xs text-sky-950 dark:text-sky-50">
                Vista desde supervisión: este formulario es el pedido mensual de la posta indicada arriba,
                no un pedido global.
              </span>
            ) : null}
            {pedidoErr ? (
              <span className="mt-2 block text-destructive" role="alert">
                No se pudo cargar el pedido: {pedidoErr.message}
              </span>
            ) : null}
          </>
        }
      />

      <PostaMesToolbar
        basePath={basePath}
        anio={anio}
        mes={mes}
        queryExtra={queryExtra}
      />

      <PedidoMensualPanel
        postaId={postaId}
        anio={anio}
        mes={mes}
        mesTitulo={tituloMesChile(anio, mes)}
        postaNombre={postaNombreCabecera}
        postaCodigo={postaCodigoCabecera}
        ymQuery={ymQuery}
        pedidoId={pedidoId}
        estado={estadoPedido}
        enviadoEtiqueta={enviadoEtiqueta}
        puedeEditar={puedeRegistrar}
        lineas={lineas}
      />
    </div>
  );
}
