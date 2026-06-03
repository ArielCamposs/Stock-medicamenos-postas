"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  crearUsuarioPerfilAction,
  type AdminUsuarioActionState,
} from "@/app/actions/admin-usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ETIQUETA_ROL_USUARIO } from "@/lib/auth/etiqueta-rol";
import type { RolUsuarioDb } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const selectClassName = cn(
  "h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
);

type PostaOption = { id: string; nombre: string; codigo: string | null };

type Props = {
  postas: PostaOption[];
  puedeCrear: boolean;
  faltaServiceRole: boolean;
};

export function UsuarioCreateForm({ postas, puedeCrear, faltaServiceRole }: Props) {
  const router = useRouter();
  const [rol, setRol] = useState<RolUsuarioDb>("BODEGA_FARMACIA");
  const [state, formAction, pending] = useActionState(crearUsuarioPerfilAction, {});

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  if (!puedeCrear) {
    return (
      <p className="text-sm text-muted-foreground">
        Solo administración general puede crear usuarios.
      </p>
    );
  }

  if (faltaServiceRole) {
    return (
      <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-50">
        Para crear cuentas desde la app necesitas configurar{" "}
        <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> en el servidor (clave service_role
        en Supabase → Settings → API). Sin eso, crea el usuario en Auth y el perfil con el SQL de la
        documentación.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      <div className="space-y-1.5">
        <Label htmlFor="usuario-email">Correo</Label>
        <Input
          id="usuario-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="encargado@ejemplo.cl"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="usuario-nombre">Nombre (opcional)</Label>
        <Input id="usuario-nombre" name="nombre" type="text" maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="usuario-password">Contraseña inicial</Label>
        <Input
          id="usuario-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. Compártela de forma segura.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="usuario-rol">Rol</Label>
        <select
          id="usuario-rol"
          name="rol"
          required
          value={rol}
          onChange={(e) => setRol(e.target.value as RolUsuarioDb)}
          className={selectClassName}
        >
          <option value="BODEGA_FARMACIA">{ETIQUETA_ROL_USUARIO.BODEGA_FARMACIA}</option>
          <option value="POSTA_MANAGER">{ETIQUETA_ROL_USUARIO.POSTA_MANAGER}</option>
        </select>
      </div>
      {rol === "POSTA_MANAGER" ? (
        <div className="space-y-1.5">
          <Label htmlFor="usuario-posta">Posta</Label>
          <select id="usuario-posta" name="posta_id" required className={selectClassName}>
            <option value="">Selecciona una posta…</option>
            {postas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.codigo ? ` (${p.codigo})` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="posta_id" value="" />
      )}
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {state.success}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creando…" : "Crear usuario"}
      </Button>
    </form>
  );
}
