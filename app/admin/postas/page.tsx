import Link from "next/link";

import { PostaAdminResumenCard } from "@/components/admin/posta-admin-resumen-card";
import { PostaCreateForm } from "@/components/admin/posta-create-form";
import type { PostaRow } from "@/components/admin/posta-row-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { esAdminGeneral, requirePerfilUsuario } from "@/lib/auth/session";
import {
  etiquetaMes,
  fechaCalendarioEnZonaIANA,
  ZONA_CALENDARIO_OPERACION,
} from "@/lib/domain/fecha-mes";
import { postasConAlertaDeStock } from "@/lib/posta/admin-stock-alerta-postas";
import type { MedLedgerMin } from "@/lib/posta/snapshot-ledger-mes-posta";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PostaLista = PostaRow & { createdAtIso: string };

export default async function AdminPostasPage() {
  const { profile } = await requirePerfilUsuario();
  const puedeEditar = esAdminGeneral(profile);

  const supabase = await createServerSupabaseClient();
  const hoy = fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION);
  const [anioStr, mesStr] = hoy.split("-");
  const anio = Number(anioStr);
  const mes = Number(mesStr);
  const mesStockEtiqueta = etiquetaMes(anio, mes);
  const ymOperacion = `${anio}-${String(mes).padStart(2, "0")}`;

  const { data: postasData, error: postasError } = await supabase
    .from("postas")
    .select("id,nombre,codigo,activa,created_at")
    .order("nombre", { ascending: true });

  const postas: PostaLista[] = [];
  if (postasData && Array.isArray(postasData)) {
    for (const row of postasData) {
      const r = row as Record<string, unknown>;
      const createdRaw = r.created_at;
      const createdAtIso =
        typeof createdRaw === "string" ? createdRaw : new Date().toISOString();
      if (
        typeof r.id === "string" &&
        typeof r.nombre === "string" &&
        typeof r.activa === "boolean"
      ) {
        postas.push({
          id: r.id,
          nombre: r.nombre,
          codigo:
            r.codigo === null || typeof r.codigo === "string" ? r.codigo : null,
          activa: r.activa,
          createdAtIso,
        });
      }
    }
  }

  const postaIds = postas.map((p) => p.id);

  const [{ data: medsData }, { data: movsHoy }, { data: ingHoy }, { data: perfilesSede }] =
    await Promise.all([
      supabase
        .from("medicamentos")
        .select("id, stock_recomendado_default, stock_critico_default")
        .eq("activo", true),
      postaIds.length > 0
        ? supabase
            .from("movimientos_diarios_consumo")
            .select("posta_id")
            .eq("fecha", hoy)
            .eq("anulado", false)
            .in("posta_id", postaIds)
        : Promise.resolve({ data: [] as { posta_id: string }[] | null }),
      postaIds.length > 0
        ? supabase
            .from("ingresos_stock_mes")
            .select("posta_id")
            .eq("fecha", hoy)
            .eq("anulado", false)
            .in("posta_id", postaIds)
        : Promise.resolve({ data: [] as { posta_id: string }[] | null }),
      postaIds.length > 0
        ? supabase
            .from("perfiles_usuario")
            .select("posta_id")
            .in("posta_id", postaIds)
            .eq("activo", true)
        : Promise.resolve({ data: [] as { posta_id: string }[] | null }),
    ]);

  const medsLedger: MedLedgerMin[] = [];
  if (medsData && Array.isArray(medsData)) {
    for (const row of medsData) {
      const r = row as Record<string, unknown>;
      if (typeof r.id !== "string") continue;
      const rec = Number(r.stock_recomendado_default);
      const crit = Number(r.stock_critico_default);
      medsLedger.push({
        id: r.id,
        stock_recomendado_default: Number.isFinite(rec) ? Math.max(0, Math.trunc(rec)) : 0,
        stock_critico_default: Number.isFinite(crit) ? Math.max(0, Math.trunc(crit)) : 0,
      });
    }
  }

  const postasParaAlertas = postas.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    codigo: p.codigo,
  }));

  const alertasFilas =
    postasParaAlertas.length > 0 && medsLedger.length > 0 && Number.isFinite(anio) && Number.isFinite(mes)
      ? await postasConAlertaDeStock(supabase, postasParaAlertas, medsLedger, anio, mes)
      : [];

  const alertaPorPosta = new Map<string, { nCritico: number; nCerca: number }>();
  for (const a of alertasFilas) {
    alertaPorPosta.set(a.postaId, { nCritico: a.nCritico, nCerca: a.nCerca });
  }

  const descuentosPorPosta = new Map<string, number>();
  if (movsHoy && Array.isArray(movsHoy)) {
    for (const row of movsHoy) {
      const r = row as { posta_id?: unknown };
      if (typeof r.posta_id !== "string") continue;
      const k = r.posta_id;
      descuentosPorPosta.set(k, (descuentosPorPosta.get(k) ?? 0) + 1);
    }
  }

  const ingresosPorPosta = new Map<string, number>();
  if (ingHoy && Array.isArray(ingHoy)) {
    for (const row of ingHoy) {
      const r = row as { posta_id?: unknown };
      if (typeof r.posta_id !== "string") continue;
      const k = r.posta_id;
      ingresosPorPosta.set(k, (ingresosPorPosta.get(k) ?? 0) + 1);
    }
  }

  const usuariosPorPosta = new Map<string, number>();
  if (perfilesSede && Array.isArray(perfilesSede)) {
    for (const row of perfilesSede) {
      const r = row as { posta_id?: unknown };
      if (typeof r.posta_id !== "string") continue;
      const k = r.posta_id;
      usuariosPorPosta.set(k, (usuariosPorPosta.get(k) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Postas</h1>

        </div>
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Volver al panel
        </Link>
      </div>

      {!puedeEditar ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">Solo lectura</Badge>
          Puedes revisar datos y abrir cada sede; el alta y la edición de la ficha la hace
          administración general.
        </p>
      ) : null}

      {postasError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudieron cargar las postas: {postasError.message}
        </p>
      ) : null}

      {postas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay postas cargadas todavía.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {postas.map((p) => {
            const al = alertaPorPosta.get(p.id);
            return (
              <PostaAdminResumenCard
                key={p.id}
                posta={{
                  id: p.id,
                  nombre: p.nombre,
                  codigo: p.codigo,
                  activa: p.activa,
                }}
                creadaEnIso={p.createdAtIso}
                metricas={{
                  usuariosEnSede: usuariosPorPosta.get(p.id) ?? 0,
                  descuentosHoy: descuentosPorPosta.get(p.id) ?? 0,
                  ingresosHoy: ingresosPorPosta.get(p.id) ?? 0,
                  medicamentosEnCritico: al?.nCritico ?? 0,
                  medicamentosCercaCritico: al?.nCerca ?? 0,
                }}
                ymOperacion={ymOperacion}
                mesStockEtiqueta={mesStockEtiqueta}
                puedeEditar={puedeEditar}
              />
            );
          })}
        </div>
      )}

      {puedeEditar ? (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle>Nueva sede</CardTitle>
              <p className="text-sm text-muted-foreground">
                Crea una posta nueva cuando entre una sede al programa. Los datos de las existentes
                se editan desde cada ficha arriba («Editar nombre…»).
              </p>
            </CardHeader>
            <CardContent>
              <PostaCreateForm />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
