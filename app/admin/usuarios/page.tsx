import Link from "next/link";

import { UsuariosGestionPanel, type UsuarioListaRow } from "@/components/admin/usuarios-gestion-panel";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { esAdminGeneral, requirePerfilUsuario } from "@/lib/auth/session";
import type { RolUsuarioDb } from "@/lib/auth/types";
import { hasSupabaseServiceRoleKey } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function esRolLista(rol: unknown): rol is RolUsuarioDb {
  return (
    rol === "BODEGA_FARMACIA" ||
    rol === "POSTA_MANAGER" ||
    rol === "ADMIN_GENERAL" ||
    rol === "READ_ONLY"
  );
}

function esEditableDesdeApp(rol: RolUsuarioDb, userId: string, actorId: string): boolean {
  if (userId === actorId) return false;
  return rol === "BODEGA_FARMACIA" || rol === "POSTA_MANAGER";
}

export default async function AdminUsuariosPage() {
  const { profile, user } = await requirePerfilUsuario();
  const puedeGestionar = esAdminGeneral(profile);
  const supabase = await createServerSupabaseClient();

  const [{ data: perfiles }, { data: postas }] = await Promise.all([
    supabase
      .from("perfiles_usuario")
      .select("id, email, nombre, rol, activo, posta_id, postas ( nombre, codigo )")
      .in("rol", ["BODEGA_FARMACIA", "POSTA_MANAGER", "ADMIN_GENERAL", "READ_ONLY"])
      .order("rol")
      .order("email"),
    supabase.from("postas").select("id, nombre, codigo").eq("activa", true).order("nombre"),
  ]);

  const usuarios: UsuarioListaRow[] = [];
  if (perfiles && Array.isArray(perfiles)) {
    for (const row of perfiles) {
      const r = row as Record<string, unknown>;
      const rol = r.rol;
      if (!esRolLista(rol)) continue;

      const posta = r.postas as Record<string, unknown> | null;
      const id = String(r.id);
      usuarios.push({
        id,
        email: r.email === null || typeof r.email === "string" ? r.email : null,
        nombre: r.nombre === null || typeof r.nombre === "string" ? r.nombre : null,
        rol,
        postaId: typeof r.posta_id === "string" ? r.posta_id : null,
        postaNombre:
          posta && typeof posta.nombre === "string"
            ? posta.codigo
              ? `${posta.nombre} (${posta.codigo})`
              : posta.nombre
            : null,
        activo: r.activo !== false,
        editable: esEditableDesdeApp(rol, id, user.id),
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
            Crea y administra encargados de posta y usuarios de bodega farmacia. La administración
            general sigue gestionándose en Supabase.
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
          <CardTitle className="text-base">Gestión de cuentas</CardTitle>
          <CardDescription>
            Crear, editar sede/rol, activar o desactivar, cambiar contraseña y eliminar cuentas
            operativas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsuariosGestionPanel
            usuarios={usuarios}
            postas={postasOptions}
            actorUserId={user.id}
            puedeGestionar={puedeGestionar}
            faltaServiceRole={!hasSupabaseServiceRoleKey()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
