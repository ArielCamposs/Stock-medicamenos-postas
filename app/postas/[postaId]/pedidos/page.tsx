import { PostaMesToolbar, tituloMesChile } from "@/components/posta/posta-mes-toolbar";
import { PostaPageHeader } from "@/components/posta/posta-page-header";
import { PedidoVolverMenuButton } from "@/components/posta/pedido-volver-menu-button";
import {
  PedidoMensualPanel,
  type PedidoMensualLineaCliente,
} from "@/components/posta/pedido-mensual-panel";
import { PedidosTipoTabs } from "@/components/posta/pedidos-tipo-tabs";
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
  esMedicamentoContraReceta,
  normalizarMedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";
import { cargarPedidosMensualesMes } from "@/lib/posta/pedidos-mensuales-por-tipo";
import { snapshotLedgerMesPosta } from "@/lib/posta/snapshot-ledger-mes-posta";
import { obtenerCierreMensualPosta } from "@/lib/posta/cierre-mensual";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TipoPedido } from "@/app/actions/pedido-mensual";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ postaId: string }>;
  searchParams: Promise<{ ym?: string; from?: string; tab?: string }>;
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

function parseTab(raw: string | undefined): TipoPedido {
  return raw === "contra-receta" ? "CONTRA_RECETA" : "GENERAL";
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

type PedidoRowData = {
  pedidoId: string | null;
  estadoPedido:
    | "BORRADOR"
    | "ENVIADO"
    | "APROBADO"
    | "OBSERVADO"
    | "RECHAZADO"
    | "DESPACHADO"
    | "RECIBIDO"
    | null;
  enviadoEtiqueta: string | null;
  detalleRows: { medicamento_id: string; cantidad_sugerida: number; cantidad_final: number }[];
};

export default async function PostaPedidosPage({ params, searchParams }: PageProps) {
  const { postaId } = await params;
  const qs = await searchParams;
  const { anio, mes } = parseYm(qs?.ym);
  const ymQuery = ymParam(anio, mes);
  const tabActiva = parseTab(qs?.tab);

  const ctx = await requirePerfilUsuario();
  const { profile } = ctx;
  const volverBandejaAdmin = qs?.from === "admin" && tieneAccesoGlobalAdmin(profile);
  const puedeGestionarPedido = puedeGestionarPedidoMensualPosta(profile, postaId);
  const supabase = await createServerSupabaseClient();
  const cierre = await obtenerCierreMensualPosta(supabase, postaId, anio, mes);
  const puedeRegistrar = puedeGestionarPedido && !cierre;

  const [{ data: medicamentos }, { data: postaMeta }] = await Promise.all([
    supabase
      .from("medicamentos")
      .select(
        "id, nombre, codigo_interno, unidad_medida, categoria, stock_recomendado_default, stock_critico_default, es_contra_receta"
      )
      .eq("activo", true)
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true }),
    supabase.from("postas").select("nombre, codigo").eq("id", postaId).maybeSingle(),
  ]);

  const pedidosMes = await cargarPedidosMensualesMes(supabase, postaId, anio, mes);

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
    es_contra_receta: boolean;
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
          es_contra_receta: r.es_contra_receta === true,
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

  // Listas separadas: general sin contra receta; contra receta solo esos medicamentos.
  const medsContraReceta = meds.filter((m) =>
    esMedicamentoContraReceta({ es_contra_receta: m.es_contra_receta, categoria: m.categoria })
  );
  const medsGeneral = meds.filter(
    (m) => !esMedicamentoContraReceta({ es_contra_receta: m.es_contra_receta, categoria: m.categoria })
  );
  const hayContraReceta = medsContraReceta.length > 0;

  const pedidoGeneralVista = pedidosMes.general;
  const pedidoContraRecetaVista = pedidosMes.contraReceta;

  const pedidoGeneral = {
    id: pedidoGeneralVista.pedido?.id ?? null,
    estado: pedidoGeneralVista.pedido?.estado ?? null,
    enviado_en: pedidoGeneralVista.pedido?.enviado_en ?? null,
  };
  const pedidoContraReceta = {
    id: pedidoContraRecetaVista.pedido?.id ?? null,
    estado: pedidoContraRecetaVista.pedido?.estado ?? null,
    enviado_en: pedidoContraRecetaVista.pedido?.enviado_en ?? null,
  };

  function buildPedidoRowData(
    pedidoData: { id: string | null; estado: string | null; enviado_en: string | null }
  ): Omit<PedidoRowData, "detalleRows"> {
    const estadoRaw = pedidoData.estado;
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
    const enviadoEtiqueta = pedidoData.enviado_en
      ? etiquetaInstanteChile24h(pedidoData.enviado_en)
      : null;
    return {
      pedidoId: pedidoData.id,
      estadoPedido,
      enviadoEtiqueta,
    };
  }

  const pedidoGeneralDatos = buildPedidoRowData(pedidoGeneral);
  const pedidoContraRecetaDatos = buildPedidoRowData(pedidoContraReceta);

  // Cargar detalle de ambos pedidos en paralelo.
  const [{ data: detalleGeneralRows }, { data: detalleContraRecetaRows }] = await Promise.all([
    pedidoGeneral.id
      ? supabase
          .from("detalle_pedido_mensual")
          .select("medicamento_id, cantidad_sugerida, cantidad_final")
          .eq("pedido_id", pedidoGeneral.id)
      : Promise.resolve({ data: null as null }),
    pedidoContraReceta.id
      ? supabase
          .from("detalle_pedido_mensual")
          .select("medicamento_id, cantidad_sugerida, cantidad_final")
          .eq("pedido_id", pedidoContraReceta.id)
      : Promise.resolve({ data: null as null }),
  ]);

  function buildDetallePorMed(rows: unknown): Map<string, { sugerida: number; final: number }> {
    const map = new Map<string, { sugerida: number; final: number }>();
    if (rows && Array.isArray(rows)) {
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        if (typeof r.medicamento_id === "string") {
          map.set(r.medicamento_id, {
            sugerida: toInt(r.cantidad_sugerida),
            final: toInt(r.cantidad_final),
          });
        }
      }
    }
    return map;
  }

  const detalleGeneralPorMed = buildDetallePorMed(detalleGeneralRows);
  const detalleContraRecetaPorMed = buildDetallePorMed(detalleContraRecetaRows);

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

  function buildLineas(
    medsSubset: MedRow[],
    detallePorMed: Map<string, { sugerida: number; final: number }>
  ): PedidoMensualLineaCliente[] {
    return medsSubset.map((m) => {
      const s = snapshot.get(m.id) ?? {
        disponible: 0,
        stock_recomendado: m.stock_recomendado_default,
        stock_critico: m.stock_critico_default,
      };
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
  }

  const lineasGeneral = buildLineas(medsGeneral, detalleGeneralPorMed);
  const lineasContraReceta = buildLineas(medsContraReceta, detalleContraRecetaPorMed);

  const basePath = `/postas/${postaId}/pedidos`;
  const queryExtra: Record<string, string> = {
    tab: tabActiva === "CONTRA_RECETA" ? "contra-receta" : "general",
    ...(volverBandejaAdmin ? { from: "admin" } : {}),
  };

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
                  Pedido general y pedido contra receta son independientes. Puedes enviar varios al mes, con
                  un envío por día calendario de cada tipo.
                </span>
              </>
            ) : (
              "Pedido general y contra receta por separado; varios envíos al mes, uno por día de cada tipo."
            )}
            {volverBandejaAdmin ? (
              <span className="mt-2 block rounded-md border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-xs text-sky-950 dark:text-sky-50">
                Vista desde supervisión: este formulario es el pedido mensual de la posta indicada arriba,
                no un pedido global.
              </span>
            ) : null}
            {pedidosMes.error ? (
              <span className="mt-2 block text-destructive" role="alert">
                No se pudieron cargar los pedidos del mes: {pedidosMes.error}
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

      <PedidosTipoTabs
        postaId={postaId}
        tabActiva={tabActiva}
        ymQuery={ymQuery}
        hayContraReceta={hayContraReceta}
        estadoGeneral={pedidoGeneralDatos.estadoPedido}
        estadoContraReceta={pedidoContraRecetaDatos.estadoPedido}
        queryExtra={queryExtra}
      >
        {tabActiva === "CONTRA_RECETA" ? (
          hayContraReceta ? (
            <PedidoMensualPanel
              key="pedido-contra-receta"
              postaId={postaId}
              anio={anio}
              mes={mes}
              mesTitulo={tituloMesChile(anio, mes)}
              postaNombre={postaNombreCabecera}
              postaCodigo={postaCodigoCabecera}
              ymQuery={ymQuery}
              tipoPedido="CONTRA_RECETA"
              pedidoId={pedidoContraRecetaDatos.pedidoId}
              estado={pedidoContraRecetaDatos.estadoPedido}
              enviadoEtiqueta={pedidoContraRecetaDatos.enviadoEtiqueta}
              pedidoEnviadoHoy={pedidoContraRecetaVista.pedidoEnviadoHoy}
              pedidoEnProceso={pedidoContraRecetaVista.pedidoEnProceso}
              puedeEditar={puedeRegistrar}
              lineas={lineasContraReceta}
            />
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
              No hay medicamentos contra receta configurados en el catálogo activo.
            </div>
          )
        ) : (
          <PedidoMensualPanel
            key="pedido-general"
            postaId={postaId}
            anio={anio}
            mes={mes}
            mesTitulo={tituloMesChile(anio, mes)}
            postaNombre={postaNombreCabecera}
            postaCodigo={postaCodigoCabecera}
            ymQuery={ymQuery}
            tipoPedido="GENERAL"
            pedidoId={pedidoGeneralDatos.pedidoId}
            estado={pedidoGeneralDatos.estadoPedido}
            enviadoEtiqueta={pedidoGeneralDatos.enviadoEtiqueta}
            pedidoEnviadoHoy={pedidoGeneralVista.pedidoEnviadoHoy}
            pedidoEnProceso={pedidoGeneralVista.pedidoEnProceso}
            puedeEditar={puedeRegistrar}
            lineas={lineasGeneral}
          />
        )}
      </PedidosTipoTabs>
    </div>
  );
}
