import Link from "next/link";

import { AdminPedidosHistorialInteractivo } from "@/components/admin/admin-pedidos-historial-interactivo";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { esAdminGeneral, requirePerfilUsuario } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Estados en los que el pedido suele seguir en la bandeja de trabajo hasta marcarlo listo. */
const ESTADOS_PENDIENTES_BANDEJA = [
  "ENVIADO",
  "OBSERVADO",
  "APROBADO",
  "DESPACHADO",
] as const;

const SET_ESTADOS_PENDIENTES_BANDEJA = new Set<string>(ESTADOS_PENDIENTES_BANDEJA);

const ESTADOS_TODOS = [
  "ENVIADO",
  "OBSERVADO",
  "APROBADO",
  "DESPACHADO",
  "RECIBIDO",
  "RECHAZADO",
] as const;

function tituloMes(anio: number, mes: number) {
  return new Date(anio, mes - 1, 1).toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
}

function filasParaTablaInteractiva(
  lista: {
    id: string;
    postaId: string;
    anio: number;
    mes: number;
    estado: string;
    enviadoEn: string | null;
    postaNombre: string;
    postaCodigo: string | null;
    bandejaListo: boolean;
  }[]
) {
  return lista.map((r) => ({
    id: r.id,
    postaId: r.postaId,
    anio: r.anio,
    mes: r.mes,
    mesTitulo: tituloMes(r.anio, r.mes),
    estado: r.estado,
    enviadoEtiqueta:
      r.enviadoEn !== null && typeof r.enviadoEn === "string"
        ? new Date(r.enviadoEn).toLocaleString("es-CL", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "—",
    postaNombre: r.postaNombre,
    postaCodigo: r.postaCodigo,
    bandejaListo: r.bandejaListo,
    pendienteBandeja: SET_ESTADOS_PENDIENTES_BANDEJA.has(r.estado) && !r.bandejaListo,
    puedePdf: true,
  }));
}

export default async function AdminPedidosPage() {
  const { profile } = await requirePerfilUsuario();
  const puedeGestionarBandeja = esAdminGeneral(profile);
  const supabase = await createServerSupabaseClient();

  const { data: rows, error } = await supabase
    .from("pedidos_mensuales")
    .select(
      "id, anio, mes, estado, enviado_en, fecha_creacion, posta_id, admin_bandeja_listo_en"
    )
    .in("estado", [...ESTADOS_TODOS])
    .order("fecha_creacion", { ascending: false });

  const idsPosta = new Set<string>();
  if (rows && Array.isArray(rows)) {
    for (const r of rows) {
      const row = r as Record<string, unknown>;
      if (typeof row.posta_id === "string") idsPosta.add(row.posta_id);
    }
  }

  const postaPorId = new Map<string, { nombre: string; codigo: string | null }>();
  if (idsPosta.size > 0) {
    const { data: postasData } = await supabase
      .from("postas")
      .select("id, nombre, codigo")
      .in("id", [...idsPosta]);
    if (postasData && Array.isArray(postasData)) {
      for (const p of postasData) {
        const x = p as Record<string, unknown>;
        if (typeof x.id !== "string") continue;
        const nombreRaw = typeof x.nombre === "string" ? x.nombre.trim() : "";
        const codigo =
          x.codigo === null || typeof x.codigo === "string" ? (x.codigo as string | null) : null;
        postaPorId.set(x.id, {
          nombre: nombreRaw || `Posta (${x.id.slice(0, 8)}…)`,
          codigo,
        });
      }
    }
  }

  const lista =
    rows?.map((r) => {
      const row = r as Record<string, unknown>;
      const postaId = String(row.posta_id);
      const meta = postaPorId.get(postaId);
      const rawListo = row.admin_bandeja_listo_en;
      const bandejaListo =
        typeof rawListo === "string" && rawListo.length > 0;
      const fechaCreacion =
        row.fecha_creacion === null || typeof row.fecha_creacion === "string"
          ? (row.fecha_creacion as string | null)
          : null;
      return {
        id: String(row.id),
        postaId,
        anio: Number(row.anio),
        mes: Number(row.mes),
        estado: String(row.estado),
        enviadoEn:
          row.enviado_en === null || typeof row.enviado_en === "string"
            ? (row.enviado_en as string | null)
            : null,
        postaNombre: meta?.nombre ?? `Posta (${postaId.slice(0, 8)}…)`,
        postaCodigo: meta?.codigo ?? null,
        bandejaListo,
        fechaCreacion,
      };
    }) ?? [];

  function prioridadBandeja(estado: string, listo: boolean): number {
    if (SET_ESTADOS_PENDIENTES_BANDEJA.has(estado) && !listo) return 0;
    return 1;
  }

  lista.sort((a, b) => {
    const pa = prioridadBandeja(a.estado, a.bandejaListo);
    const pb = prioridadBandeja(b.estado, b.bandejaListo);
    if (pa !== pb) return pa - pb;
    const ta = a.fechaCreacion ? Date.parse(a.fechaCreacion) : 0;
    const tb = b.fechaCreacion ? Date.parse(b.fechaCreacion) : 0;
    return tb - ta;
  });

  const nPendientesBandeja = lista.filter(
    (r) => SET_ESTADOS_PENDIENTES_BANDEJA.has(r.estado) && !r.bandejaListo
  ).length;
  const nMarcadosListo = lista.filter((r) => r.bandejaListo).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Pedidos mensuales</h1>
        {lista.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">
            Marcados como listo: <span className="font-medium text-foreground">{nMarcadosListo}</span>
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : null}

      <Card>
        <CardHeader className="border-b bg-muted/40">
          <CardTitle className="text-lg">Historial de pedidos</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pedidos registrados.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                Clic en la fila del pedido: se abre el detalle y podés exportar esa fila a Excel. Los botones de la
                derecha no disparan el modal.
              </p>
              <AdminPedidosHistorialInteractivo
                filas={filasParaTablaInteractiva(lista)}
                puedeGestionarBandeja={puedeGestionarBandeja}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Link href="/admin" className={cn(buttonVariants({ variant: "ghost" }), "inline-flex w-fit")}>
        Volver al panel
      </Link>
    </div>
  );
}
