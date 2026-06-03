import { PackagePlus, History, Lock } from "lucide-react";
import { PostaMesToolbar, tituloMesChile } from "@/components/posta/posta-mes-toolbar";
import { PostaPageHeader } from "@/components/posta/posta-page-header";
import {
  IngresoStockLoteForm,
  type LedgerIngresoFila,
} from "@/components/posta/ingreso-stock-lote-form";
import {
  HistorialIngresosLotes,
  type IngresoLoteHistorial,
} from "@/components/posta/historial-ingresos-lotes";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  puedeGestionarPedidoMensualPosta,
  puedeRegistrarStockYAvisPosta,
  requirePerfilUsuario,
} from "@/lib/auth/session";
import { anioMesActual, fechaIngresoParaMesMovimiento } from "@/lib/domain/fecha-mes";
import { CierreMesVistaAviso } from "@/components/posta/cierre-mes-vista-aviso";
import {
  obtenerCierreMensualPosta,
  vistaCierreDesdeRegistro,
} from "@/lib/posta/cierre-mensual";
import {
  cargarCantidadesPedidoActivoParaIngreso,
  obtenerPedidoDespachadoActivoParaIngreso,
} from "@/lib/posta/pedido-despachado-ingreso";
import { fechasConIngresoLoteEnMes } from "@/lib/posta/reglas-repeticion-dia";
import { snapshotLedgerMesPosta } from "@/lib/posta/snapshot-ledger-mes-posta";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ postaId: string }>;
  searchParams: Promise<{ ym?: string }>;
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
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export default async function PostaIngresosPage({ params, searchParams }: PageProps) {
  const { postaId } = await params;
  const qs = await searchParams;
  const { anio, mes } = parseYm(qs?.ym);
  const mesContableYm = `${anio}-${String(mes).padStart(2, "0")}`;

  const { profile } = await requirePerfilUsuario();
  const puedeRegistrarPorRol = puedeRegistrarStockYAvisPosta(profile, postaId);
  const puedeIngresarPedidoDespachado = puedeGestionarPedidoMensualPosta(profile, postaId);
  const supabase = await createServerSupabaseClient();
  const cierre = await obtenerCierreMensualPosta(supabase, postaId, anio, mes);
  const vistaCierreMes = cierre ? vistaCierreDesdeRegistro(cierre) : null;
  const puedeRegistrar = puedeRegistrarPorRol && !cierre;

  const [
    { data: medicamentos },
    { data: lotesRows },
    { data: postaMeta },
    { data: ingresadoEstesMes },
  ] = await Promise.all([
    supabase
      .from("medicamentos")
      .select(
        "id, nombre, codigo_interno, codigo_avis, unidad_medida, stock_recomendado_default, stock_critico_default"
      )
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("ingresos_stock_lotes")
      .select(
        `
        id,
        fecha,
        observacion,
        created_at,
        ingresos_stock_mes (
          id,
          cantidad,
          anulado,
          observacion,
          medicamentos ( nombre, codigo_interno, unidad_medida )
        )
      `
      )
      .eq("posta_id", postaId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("postas").select("nombre, codigo").eq("id", postaId).maybeSingle(),
    supabase
      .from("ingresos_stock_mes")
      .select("medicamento_id, cantidad")
      .eq("posta_id", postaId)
      .gte("fecha", `${anio}-${String(mes).padStart(2, "0")}-01`)
      .lt(
        "fecha",
        mes === 12
          ? `${anio + 1}-01-01`
          : `${anio}-${String(mes + 1).padStart(2, "0")}-01`
      )
      .eq("anulado", false),
  ]);

  const postaNombre =
    postaMeta && typeof postaMeta === "object" && "nombre" in postaMeta
      ? String((postaMeta as { nombre: unknown }).nombre ?? "Posta")
      : "Posta";
  const postaCodigo =
    postaMeta &&
    typeof postaMeta === "object" &&
    "codigo" in postaMeta &&
    (postaMeta as { codigo: unknown }).codigo != null
      ? String((postaMeta as { codigo: unknown }).codigo)
      : null;

  // Sumar cantidades ya ingresadas por medicamento este mes.
  const ingresadoPorMed: Record<string, number> = {};
  if (ingresadoEstesMes && Array.isArray(ingresadoEstesMes)) {
    for (const row of ingresadoEstesMes) {
      const r = row as Record<string, unknown>;
      if (typeof r.medicamento_id === "string") {
        ingresadoPorMed[r.medicamento_id] =
          (ingresadoPorMed[r.medicamento_id] ?? 0) + toInt(r.cantidad);
      }
    }
  }
  const totalIngresadoMesTodos = Object.values(ingresadoPorMed).reduce((a, b) => a + b, 0);

  const pedidoDespachadoActivo = await obtenerPedidoDespachadoActivoParaIngreso(
    supabase,
    postaId,
    anio,
    mes
  );

  let cantidadPedidaPorMed: Record<string, number> = {};
  let cantidadIngresadaPedidoPorMed: Record<string, number> = {};
  if (pedidoDespachadoActivo) {
    const cant = await cargarCantidadesPedidoActivoParaIngreso(
      supabase,
      postaId,
      anio,
      mes,
      pedidoDespachadoActivo
    );
    cantidadPedidaPorMed = cant.cantidadPedidaPorMed;
    cantidadIngresadaPedidoPorMed = cant.cantidadIngresadaPedidoPorMed;
  }

  const hayPedidoMes =
    pedidoDespachadoActivo !== null && puedeIngresarPedidoDespachado;
  const pedidoDespachadoParaForm =
    pedidoDespachadoActivo && puedeIngresarPedidoDespachado
      ? pedidoDespachadoActivo
      : null;

  const totalIngresadoMes = pedidoDespachadoParaForm
    ? Object.values(cantidadIngresadaPedidoPorMed).reduce((a, b) => a + b, 0)
    : totalIngresadoMesTodos;

  const meds =
    medicamentos?.map((m) => {
      const id = m.id as string;
      const pedida = pedidoDespachadoParaForm ? (cantidadPedidaPorMed[id] ?? 0) : 0;
      const yaIngresadaPedido = cantidadIngresadaPedidoPorMed[id] ?? 0;
      const yaIngresadaMes = ingresadoPorMed[id] ?? 0;
      const cantidadYaIngresada = pedidoDespachadoParaForm
        ? yaIngresadaPedido
        : yaIngresadaMes;
      const cantidadSugerida = Math.max(0, pedida - cantidadYaIngresada);
      return {
        id,
        nombre: m.nombre as string,
        codigo_interno: m.codigo_interno as string,
        codigo_avis: (m.codigo_avis as string | null) ?? null,
        unidad_medida: String(m.unidad_medida ?? ""),
        cantidadPedida: pedida,
        cantidadYaIngresada,
        cantidadSugerida,
      };
    }) ?? [];

  let ledgerPorMedicamento: Record<string, LedgerIngresoFila> = {};
  if (puedeRegistrar && meds.length > 0) {
    const medRows = (medicamentos ?? []) as Record<string, unknown>[];
    const medMins = medRows
      .filter((r) => typeof r.id === "string")
      .map((r) => ({
        id: r.id as string,
        stock_recomendado_default: toInt(r.stock_recomendado_default),
        stock_critico_default: toInt(r.stock_critico_default),
      }));
    const snapshot = await snapshotLedgerMesPosta(
      supabase,
      postaId,
      anio,
      mes,
      medMins
    );
    ledgerPorMedicamento = {};
    for (const [id, s] of snapshot) {
      ledgerPorMedicamento[id] = {
        stock_recomendado: s.stock_recomendado,
        stock_critico: s.stock_critico,
        disponible: s.disponible,
      };
    }
  }

  type MedJoin = {
    nombre?: string;
    codigo_interno?: string;
    unidad_medida?: string;
  } | null;
  type LineaJoin = {
    id: string;
    cantidad: number;
    anulado: boolean;
    observacion: string | null;
    medicamentos: MedJoin;
  };

  const lotes: IngresoLoteHistorial[] =
    lotesRows?.map((lote) => {
      const lineasRaw = lote.ingresos_stock_mes;
      const lineasArr = Array.isArray(lineasRaw) ? lineasRaw : lineasRaw ? [lineasRaw] : [];
      const lineas = lineasArr
        .map((linea) => {
          const row = linea as LineaJoin;
          const med = row.medicamentos;
          return {
            id: String(row.id),
            cantidad: Number(row.cantidad),
            anulado: Boolean(row.anulado),
            observacion: row.observacion ? String(row.observacion) : null,
            medNombre: med && typeof med === "object" ? String(med.nombre ?? "—") : "—",
            medCodigo:
              med && typeof med === "object" ? String(med.codigo_interno ?? "") : "",
            unidadMedida:
              med && typeof med === "object" ? String(med.unidad_medida ?? "") : "",
          };
        })
        .sort((a, b) => a.medNombre.localeCompare(b.medNombre, "es"));

      return {
        id: String(lote.id),
        fecha: String(lote.fecha),
        registradoEn: String(lote.created_at),
        observacion: lote.observacion ? String(lote.observacion) : null,
        lineas,
      };
    }) ?? [];

  const basePath = `/postas/${postaId}/ingresos`;

  const fechasConLote =
    puedeRegistrar ? await fechasConIngresoLoteEnMes(supabase, postaId, anio, mes) : [];
  const fechaApunteIngreso =
    fechaIngresoParaMesMovimiento(mesContableYm, new Date()) ?? `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ingresoBloqueadoMismoDia = fechasConLote.includes(fechaApunteIngreso);

  return (
    <div className="space-y-6">
      <PostaPageHeader
        title="Entradas de stock"
        description={
          puedeRegistrar
            ? "Registra aquí los medicamentos que ingresaron a la posta este mes."
            : cierre
              ? "El mes está cerrado. Para registrar nuevos ingresos, solicita la reapertura del período."
              : "No tienes permiso para registrar ingresos en este período."
        }
      />

      <PostaMesToolbar
        basePath={basePath}
        anio={anio}
        mes={mes}
        mesCerrado={Boolean(cierre)}
      />

      {vistaCierreMes ? (
        <CierreMesVistaAviso
          postaId={postaId}
          anio={anio}
          mes={mes}
          vista={vistaCierreMes}
        />
      ) : null}

      {pedidoDespachadoActivo && !puedeIngresarPedidoDespachado ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-600/30 dark:bg-amber-950/25 dark:text-amber-100">
          Hay un pedido{" "}
          <strong>{pedidoDespachadoActivo.etiquetaTipo}</strong> despachado pendiente de ingreso.
          Solo el <strong>encargado de la posta</strong> puede registrarlo en esta pantalla.
        </div>
      ) : null}

      {puedeRegistrar ? (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-primary/5 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PackagePlus className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">Nuevo ingreso de stock</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {tituloMesChile(anio, mes)} · {meds.length} medicamentos disponibles
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <IngresoStockLoteForm
              postaId={postaId}
              medicamentos={meds}
              mesContableYm={mesContableYm}
              ledgerPorMedicamento={ledgerPorMedicamento}
              hayPedidoMes={hayPedidoMes}
              pedidoDespachadoActivo={pedidoDespachadoParaForm}
              totalIngresadoMes={totalIngresadoMes}
              fechaApunteIngreso={fechaApunteIngreso}
              ingresoBloqueadoMismoDia={ingresoBloqueadoMismoDia}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 dark:bg-amber-950/20 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 mt-0.5">
              <Lock className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                {cierre ? "Período cerrado" : "Sin permiso de carga"}
              </h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                {cierre
                  ? `El mes de ${tituloMesChile(anio, mes)} ya fue cerrado. Los movimientos de este período están bloqueados. Si necesitas registrar un ingreso, solicita la reapertura del período a administración.`
                  : "Tu perfil de usuario no tiene permiso para registrar entradas de stock. Contacta al administrador si crees que esto es un error."}
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-border/60 bg-muted/30 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <History className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">Historial de ingresos</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Cada registro agrupa los medicamentos ingresados en una misma carga · últimos 30
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <HistorialIngresosLotes
            postaNombre={postaNombre}
            postaCodigo={postaCodigo}
            lotes={lotes}
          />
        </CardContent>
      </Card>
    </div>
  );
}
