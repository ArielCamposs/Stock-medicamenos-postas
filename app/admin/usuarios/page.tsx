import Link from "next/link";

import { UsuarioCreateForm } from "@/components/admin/usuario-create-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { etiquetaRolUsuario } from "@/lib/auth/etiqueta-rol";
import { esAdminGeneral, requirePerfilUsuario } from "@/lib/auth/session";
import type { RolUsuarioDb } from "@/lib/auth/types";
import { hasSupabaseServiceRoleKey } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type UsuarioLista = {
  id: string;
  email: string | null;
  nombre: string | null;
  rol: RolUsuarioDb;
  postaNombre: string | null;
  activo: boolean;
};

export default async function AdminUsuariosPage() {
  const { profile } = await requirePerfilUsuario();
  const puedeCrear = esAdminGeneral(profile);
  const supabase = await createServerSupabaseClient();

  const [{ data: perfiles }, { data: postas }] = await Promise.all([
    supabase
      .from("perfiles_usuario")
      .select("id, email, nombre, rol, activo, posta_id, postas ( nombre, codigo )")
      .in("rol", ["BODEGA_FARMACIA", "POSTA_MANAGER", "ADMIN_GENERAL"])
      .order("rol")
      .order("email"),
    supabase.from("postas").select("id, nombre, codigo").eq("activa", true).order("nombre"),
  ]);

  const lista: UsuarioLista[] = [];
  if (perfiles && Array.isArray(perfiles)) {
    for (const row of perfiles) {
      const r = row as Record<string, unknown>;
      const rol = r.rol;
      if (
        rol !== "BODEGA_FARMACIA" &&
        rol !== "POSTA_MANAGER" &&
        rol !== "ADMIN_GENERAL"
      ) {
        continue;
      }
      const posta = r.postas as Record<string, unknown> | null;
      lista.push({
        id: String(r.id),
        email: r.email === null || typeof r.email === "string" ? r.email : null,
        nombre: r.nombre === null || typeof r.nombre === "string" ? r.nombre : null,
        rol,
        postaNombre:
          posta && typeof posta.nombre === "string"
            ? posta.codigo
              ? `${posta.nombre} (${posta.codigo})`
              : posta.nombre
            : null,
        activo: r.activo !== false,
      });
    }
  }

  const postasOptions =
    postas?.map((p) => ({
      id: String((p as { id: unknown }).id),
      nombre: String((p as { nombre: unknown }).nombre ?? ""),
      codigo:
        (p as { codigo: unknown }).codigo === null ||
        typeof (p as { codigo: unknown }).codigo === "string"
          ? ((p as { codigo: string | null }).codigo ?? null)
          : null,
    })) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Crea cuentas para bodega farmacia (despacho central) o encargados de posta. Los
            usuarios de administración general se gestionan por SQL en Supabase.
          </p>
        </div>
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Volver al panel
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo usuario</CardTitle>
          <CardDescription>
            Bodega farmacia: recibe pedidos aprobados y los marca como despachados. Encargado de
            posta: opera descuentos y pedidos en su sede.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsuarioCreateForm
            postas={postasOptions}
            puedeCrear={puedeCrear}
            faltaServiceRole={!hasSupabaseServiceRoleKey()}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">Usuarios registrados</h2>
        {lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay perfiles para mostrar.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border/80">
            {lista.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{u.email ?? u.id}</p>
                  {u.nombre ? (
                    <p className="text-xs text-muted-foreground">{u.nombre}</p>
                  ) : null}
                  {u.postaNombre ? (
                    <p className="text-xs text-muted-foreground">Sede: {u.postaNombre}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Badge variant="secondary">{etiquetaRolUsuario(u.rol)}</Badge>
                  {!u.activo ? (
                    <Badge variant="destructive">Inactivo</Badge>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
