import { BodegaHistorialDespachos } from "@/components/bodega/bodega-historial-despachos";
import { BodegaPedidosPanel } from "@/components/bodega/bodega-pedidos-panel";
import { RscAutoRefresh } from "@/components/shared/rsc-auto-refresh";
import { cargarVistaBodega } from "@/lib/bodega/vista-despachos";
import { esBodegaFarmacia, requirePerfilUsuario } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BodegaPage() {
  const { profile } = await requirePerfilUsuario();
  if (!esBodegaFarmacia(profile)) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const { pendientes, historial, postas, errorHistorial } = await cargarVistaBodega(supabase);

  return (
    <div className="space-y-8">
      <RscAutoRefresh />
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Despacho a postas
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Hola{profile.nombre ? `, ${profile.nombre}` : ""}. Prepara los pedidos aprobados y
          consulta el historial de todo lo despachado.
        </p>
      </div>

      {errorHistorial ? (
        <p className="text-sm text-destructive" role="alert">
          No se pudo cargar el historial: {errorHistorial}
        </p>
      ) : null}

      <BodegaPedidosPanel pendientes={pendientes} />
      <BodegaHistorialDespachos filas={historial} postas={postas} />
    </div>
  );
}
