"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  actualizarUsuarioPerfilAction,
  crearUsuarioPerfilAction,
  eliminarUsuarioPerfilAction,
  type AdminUsuarioActionState,
} from "@/app/actions/admin-usuarios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import { ETIQUETA_ROL_USUARIO, etiquetaRolUsuario } from "@/lib/auth/etiqueta-rol";
import type { RolUsuarioDb } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const selectClassName = cn(
  "h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
);

export type UsuarioListaRow = {
  id: string;
  email: string | null;
  nombre: string | null;
  rol: RolUsuarioDb;
  postaId: string | null;
  postaNombre: string | null;
  activo: boolean;
  editable: boolean;
};

type PostaOption = { id: string; nombre: string; codigo: string | null };

type Props = {
  usuarios: UsuarioListaRow[];
  postas: PostaOption[];
  actorUserId: string;
  puedeGestionar: boolean;
  faltaServiceRole: boolean;
};

const INICIAL: AdminUsuarioActionState = {};

type DialogModo = "nuevo" | "editar";

type EditForm = {
  id: string;
  email: string;
  nombre: string;
  rol: RolUsuarioDb;
  postaId: string;
  activo: boolean;
  passwordNueva: string;
};

export function UsuariosGestionPanel({
  usuarios,
  postas,
  actorUserId,
  puedeGestionar,
  faltaServiceRole,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [stateCrear, crearAction, pendingCrear] = useActionState(crearUsuarioPerfilAction, INICIAL);
  const [stateEditar, editarAction, pendingEditar] = useActionState(
    actualizarUsuarioPerfilAction,
    INICIAL
  );
  const [stateEliminar, eliminarAction, pendingEliminar] = useActionState(
    eliminarUsuarioPerfilAction,
    INICIAL
  );

  const [rolCrear, setRolCrear] = useState<RolUsuarioDb>("POSTA_MANAGER");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modo, setModo] = useState<DialogModo>("nuevo");
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  useEffect(() => {
    if (stateCrear.ok) {
      toast(stateCrear.success ?? "Usuario creado.", "success");
      setDialogOpen(false);
      setRolCrear("POSTA_MANAGER");
      router.refresh();
    } else if (stateCrear.error) {
      toast(stateCrear.error, "error");
    }
  }, [stateCrear, toast, router]);

  useEffect(() => {
    if (stateEditar.ok) {
      toast(stateEditar.success ?? "Usuario actualizado.", "success");
      setDialogOpen(false);
      setConfirmarEliminar(false);
      router.refresh();
    } else if (stateEditar.error) {
      toast(stateEditar.error, "error");
    }
  }, [stateEditar, toast, router]);

  useEffect(() => {
    if (stateEliminar.ok) {
      toast(stateEliminar.success ?? "Usuario eliminado.", "success");
      setDialogOpen(false);
      setConfirmarEliminar(false);
      router.refresh();
    } else if (stateEliminar.error) {
      toast(stateEliminar.error, "error");
    }
  }, [stateEliminar, toast, router]);

  function abrirNuevo() {
    setModo("nuevo");
    setRolCrear("POSTA_MANAGER");
    setEditForm(null);
    setConfirmarEliminar(false);
    setDialogOpen(true);
  }

  function abrirEditar(u: UsuarioListaRow) {
    setModo("editar");
    setEditForm({
      id: u.id,
      email: u.email ?? "",
      nombre: u.nombre ?? "",
      rol: u.rol === "BODEGA_FARMACIA" ? "BODEGA_FARMACIA" : "POSTA_MANAGER",
      postaId: u.postaId ?? "",
      activo: u.activo,
      passwordNueva: "",
    });
    setConfirmarEliminar(false);
    setDialogOpen(true);
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editForm) return;
    const fd = new FormData(e.currentTarget);
    fd.set("activo", String(editForm.activo));
    fd.set("usuario_id", editForm.id);
    editarAction(fd);
  }

  const pending = pendingCrear || pendingEditar || pendingEliminar;
  const gestionables = usuarios.filter((u) => u.editable);

  if (!puedeGestionar) {
    return (
      <p className="text-sm text-muted-foreground">
        Solo administración general puede gestionar usuarios.
      </p>
    );
  }

  if (faltaServiceRole) {
    return (
      <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-50">
        Configura <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> en el servidor (Supabase →
        Settings → API → service_role) y reinicia la app para crear, editar contraseñas o eliminar
        cuentas.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-base font-medium">
          Usuarios registrados ({usuarios.length})
        </h2>
        <Button type="button" size="sm" onClick={abrirNuevo}>
          + Nuevo usuario
        </Button>
      </div>

      <section className="space-y-3">
        {usuarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay perfiles para mostrar.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/80">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                    Usuario
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Rol</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Sede</th>
                  <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">
                    Estado
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u, i) => (
                  <tr
                    key={u.id}
                    className={cn(
                      "border-b border-border last:border-b-0",
                      !u.activo && "opacity-60",
                      i % 2 === 0 ? "bg-background" : "bg-muted/15"
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium truncate max-w-[14rem] sm:max-w-none">
                        {u.email ?? u.id}
                      </p>
                      {u.nombre ? (
                        <p className="text-xs text-muted-foreground">{u.nombre}</p>
                      ) : null}
                      {u.id === actorUserId ? (
                        <p className="text-[11px] text-muted-foreground">(tu cuenta)</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary">{etiquetaRolUsuario(u.rol)}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {u.postaNombre ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={u.activo ? "default" : "destructive"}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {u.editable ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7"
                          onClick={() => abrirEditar(u)}
                        >
                          Editar
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Solo informática</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {gestionables.length === 0 && usuarios.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Los perfiles de administración general aparecen listados pero se editan por informática.
          </p>
        ) : null}
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setConfirmarEliminar(false);
            setEditForm(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{modo === "nuevo" ? "Nuevo usuario" : "Editar usuario"}</DialogTitle>
          </DialogHeader>

          {modo === "nuevo" ? (
            <form action={crearAction} className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Bodega farmacia despacha pedidos aprobados. Encargado de posta opera su sede.
              </p>
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
                <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="usuario-rol">Rol</Label>
                <select
                  id="usuario-rol"
                  name="rol"
                  required
                  value={rolCrear}
                  onChange={(e) => setRolCrear(e.target.value as RolUsuarioDb)}
                  className={selectClassName}
                >
                  <option value="POSTA_MANAGER">{ETIQUETA_ROL_USUARIO.POSTA_MANAGER}</option>
                  <option value="BODEGA_FARMACIA">{ETIQUETA_ROL_USUARIO.BODEGA_FARMACIA}</option>
                </select>
              </div>
              {rolCrear === "POSTA_MANAGER" ? (
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
              <DialogFooter className="gap-2 sm:justify-end px-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={pendingCrear}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={pendingCrear}>
                  {pendingCrear ? "Creando…" : "Crear usuario"}
                </Button>
              </DialogFooter>
            </form>
          ) : editForm ? (
            <div className="space-y-4">
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Correo</Label>
                  <Input value={editForm.email} readOnly className="bg-muted" />
                  <p className="text-[11px] text-muted-foreground">
                    El correo no se cambia desde aquí (cuenta Auth).
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-nombre">Nombre</Label>
                  <Input
                    id="edit-nombre"
                    name="nombre"
                    value={editForm.nombre}
                    onChange={(e) =>
                      setEditForm((f) => (f ? { ...f, nombre: e.target.value } : f))
                    }
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-rol">Rol</Label>
                  <select
                    id="edit-rol"
                    name="rol"
                    required
                    value={editForm.rol}
                    onChange={(e) =>
                      setEditForm((f) =>
                        f
                          ? {
                              ...f,
                              rol: e.target.value as RolUsuarioDb,
                              postaId:
                                e.target.value === "BODEGA_FARMACIA" ? "" : f.postaId,
                            }
                          : f
                      )
                    }
                    className={selectClassName}
                  >
                    <option value="POSTA_MANAGER">{ETIQUETA_ROL_USUARIO.POSTA_MANAGER}</option>
                    <option value="BODEGA_FARMACIA">{ETIQUETA_ROL_USUARIO.BODEGA_FARMACIA}</option>
                  </select>
                </div>
                {editForm.rol === "POSTA_MANAGER" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-posta">Posta</Label>
                    <select
                      id="edit-posta"
                      name="posta_id"
                      required
                      value={editForm.postaId}
                      onChange={(e) =>
                        setEditForm((f) => (f ? { ...f, postaId: e.target.value } : f))
                      }
                      className={selectClassName}
                    >
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
                <div className="space-y-1.5">
                  <Label htmlFor="edit-password">Nueva contraseña (opcional)</Label>
                  <Input
                    id="edit-password"
                    name="password_nueva"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={editForm.passwordNueva}
                    onChange={(e) =>
                      setEditForm((f) => (f ? { ...f, passwordNueva: e.target.value } : f))
                    }
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="edit-activo">Activo</Label>
                  <button
                    id="edit-activo"
                    type="button"
                    role="switch"
                    aria-checked={editForm.activo}
                    onClick={() =>
                      setEditForm((f) => (f ? { ...f, activo: !f.activo } : f))
                    }
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                      editForm.activo ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        editForm.activo ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                  <span className="text-sm text-muted-foreground">
                    {editForm.activo ? "Puede ingresar" : "Bloqueado"}
                  </span>
                </div>
                <DialogFooter className="gap-2 sm:justify-end px-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={pending}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={pendingEditar}>
                    {pendingEditar ? "Guardando…" : "Guardar cambios"}
                  </Button>
                </DialogFooter>
              </form>

              <div className="border-t border-border/60 pt-3">
                {confirmarEliminar ? (
                  <form action={eliminarAction} className="space-y-2 rounded-md border border-destructive/35 bg-destructive/5 p-3">
                    <input type="hidden" name="usuario_id" value={editForm.id} />
                    <input type="hidden" name="confirmar" value="si" />
                    <p className="text-xs leading-relaxed">
                      ¿Eliminar la cuenta <strong>{editForm.email}</strong>? Si tiene pedidos o
                      movimientos registrados, la eliminación fallará: usa <strong>Inactivo</strong>{" "}
                      en su lugar.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        disabled={pendingEliminar}
                      >
                        {pendingEliminar ? "Eliminando…" : "Sí, eliminar cuenta"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmarEliminar(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={pending}
                    onClick={() => setConfirmarEliminar(true)}
                  >
                    Eliminar cuenta
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
