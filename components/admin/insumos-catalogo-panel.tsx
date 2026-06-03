"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import {
  actualizarInsumoAdminAction,
  crearInsumoAdminAction,
  eliminarInsumoAdminAction,
  type PedidoInsumosActionState,
} from "@/app/actions/pedido-insumos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

export type InsumoRow = {
  id: string;
  nombre: string;
  stock_objetivo: number;
  activo: boolean;
  updated_at: string | null;
};

type DialogMode = "nuevo" | "editar";
type InsumoFormData = {
  id?: string;
  nombre: string;
  stock_objetivo: string;
  activo: boolean;
};

const INICIAL: PedidoInsumosActionState = {};
const FORM_VACIO: InsumoFormData = {
  nombre: "",
  stock_objetivo: "0",
  activo: true,
};

function normalizaBusqueda(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function insumoCoincideBusqueda(ins: InsumoRow, q: string) {
  if (!q) return true;
  return ins.nombre.toLowerCase().includes(q);
}

type Props = {
  insumos: InsumoRow[];
  puedeEditar: boolean;
};

export function InsumosCatalogoPanel({ insumos, puedeEditar }: Props) {
  const { toast } = useToast();

  const [stateCrear, dispatchCrear, pendingCrear] = useActionState(crearInsumoAdminAction, INICIAL);
  const [stateActualizar, dispatchActualizar, pendingActualizar] = useActionState(
    actualizarInsumoAdminAction,
    INICIAL
  );
  const [stateEliminar, eliminarFormAction, pendingEliminar] = useActionState(
    eliminarInsumoAdminAction,
    INICIAL
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [modo, setModo] = useState<DialogMode>("nuevo");
  const [form, setForm] = useState<InsumoFormData>(FORM_VACIO);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const queryBusqueda = useMemo(() => normalizaBusqueda(busqueda), [busqueda]);
  const insumosVisibles = useMemo(
    () => insumos.filter((ins) => insumoCoincideBusqueda(ins, queryBusqueda)),
    [insumos, queryBusqueda]
  );
  const sinResultadosBusqueda = queryBusqueda.length > 0 && insumosVisibles.length === 0;

  useEffect(() => {
    if (stateCrear.ok) {
      toast(stateCrear.success ?? "Insumo creado.", "success");
      setDialogOpen(false);
    } else if (stateCrear.error) {
      toast(stateCrear.error, "error");
    }
  }, [stateCrear, toast]);

  useEffect(() => {
    if (stateActualizar.ok) {
      toast(stateActualizar.success ?? "Insumo actualizado.", "success");
      setDialogOpen(false);
      setConfirmarEliminar(false);
    } else if (stateActualizar.error) {
      toast(stateActualizar.error, "error");
    }
  }, [stateActualizar, toast]);

  useEffect(() => {
    if (stateEliminar.ok) {
      toast(stateEliminar.success ?? "Insumo eliminado.", "success");
      setDialogOpen(false);
      setConfirmarEliminar(false);
    } else if (stateEliminar.error) {
      toast(stateEliminar.error, "error");
    }
  }, [stateEliminar, toast]);

  function abrirNuevo() {
    setModo("nuevo");
    setForm(FORM_VACIO);
    setConfirmarEliminar(false);
    setDialogOpen(true);
  }

  function abrirEditar(ins: InsumoRow) {
    setModo("editar");
    setForm({
      id: ins.id,
      nombre: ins.nombre,
      stock_objetivo: String(ins.stock_objetivo),
      activo: ins.activo,
    });
    setConfirmarEliminar(false);
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("activo", String(form.activo));
    if (modo === "editar" && form.id) {
      fd.set("insumo_id", form.id);
      dispatchActualizar(fd);
    } else {
      dispatchCrear(fd);
    }
  }

  const pending = pendingCrear || pendingActualizar || pendingEliminar;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Insumos registrados ({insumos.length})</CardTitle>
          {puedeEditar ? (
            <Button size="sm" onClick={abrirNuevo}>
              + Nuevo insumo
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {insumos.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No hay insumos registrados todavía.
            </p>
          ) : (
            <>
              <div className="border-b border-border/60 px-4 py-3 space-y-2">
                <div className="max-w-md space-y-1.5">
                  <Label htmlFor="admin-insumos-buscar" className="text-xs font-medium">
                    Buscar insumo
                  </Label>
                  <Input
                    id="admin-insumos-buscar"
                    type="search"
                    autoComplete="off"
                    placeholder="Nombre del insumo…"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
                {queryBusqueda && insumosVisibles.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground tabular-nums">
                      {insumosVisibles.length}
                    </span>{" "}
                    de {insumos.length} {insumos.length === 1 ? "insumo" : "insumos"}
                  </p>
                ) : null}
              </div>

              {sinResultadosBusqueda ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    No hay insumos con esta búsqueda
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    No encontramos coincidencias para «{busqueda.trim()}». Prueba con otro nombre.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setBusqueda("")}
                  >
                    Limpiar búsqueda
                  </Button>
                </div>
              ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nombre</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">
                      Stock a manejar
                    </th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Estado</th>
                    {puedeEditar ? (
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                        Acciones
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {insumosVisibles.map((ins, i) => (
                    <tr
                      key={ins.id}
                      className={cn(
                        "border-b border-border last:border-b-0",
                        !ins.activo ? "opacity-55" : "",
                        i % 2 === 0 ? "bg-background" : "bg-muted/20"
                      )}
                    >
                      <td className="px-4 py-2.5 font-medium">{ins.nombre}</td>
                      <td className="px-4 py-2.5 text-center font-semibold tabular-nums">
                        {ins.stock_objetivo}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge variant={ins.activo ? "default" : "secondary"}>
                          {ins.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      {puedeEditar ? (
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => abrirEditar(ins)}
                            className="text-xs h-7"
                          >
                            Editar
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setConfirmarEliminar(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modo === "nuevo" ? "Nuevo insumo" : "Editar insumo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  name="nombre"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Guantes de látex"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock_objetivo">Stock a manejar *</Label>
                <Input
                  id="stock_objetivo"
                  name="stock_objetivo"
                  type="number"
                  min={0}
                  step={1}
                  value={form.stock_objetivo}
                  onChange={(e) => setForm((f) => ({ ...f, stock_objetivo: e.target.value }))}
                  required
                />
              <p className="text-xs text-muted-foreground">
                Cantidad que cada posta debe mantener de este insumo. El nombre debe ser único en el
                catálogo (no se repiten aunque cambien mayúsculas o espacios).
              </p>
              </div>
              {modo === "editar" ? (
                <div className="flex items-center gap-3">
                  <Label htmlFor="activo-check">Activo</Label>
                  <button
                    id="activo-check"
                    type="button"
                    role="switch"
                    aria-checked={form.activo}
                    onClick={() => setForm((f) => ({ ...f, activo: !f.activo }))}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                      form.activo ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        form.activo ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                  <span className="text-sm text-muted-foreground">
                    {form.activo ? "Visible en pedidos" : "Oculto en pedidos"}
                  </span>
                </div>
              ) : null}
              <DialogFooter className="gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={pendingActualizar || pendingCrear}>
                  {pendingCrear || pendingActualizar
                    ? "Guardando…"
                    : modo === "nuevo"
                      ? "Crear insumo"
                      : "Guardar cambios"}
                </Button>
              </DialogFooter>
            </form>

            {modo === "editar" && form.id ? (
              <div className="border-t border-border/60 pt-3">
                {confirmarEliminar ? (
                  <form
                    action={eliminarFormAction}
                    className="space-y-2 rounded-md border border-destructive/35 bg-destructive/5 p-3"
                  >
                    <input type="hidden" name="insumo_id" value={form.id} />
                    <input type="hidden" name="confirmar" value="si" />
                    <p className="text-xs text-foreground leading-relaxed">
                      ¿Eliminar <strong>{form.nombre || "este insumo"}</strong> del catálogo? No debe
                      figurar en pedidos enviados. Si solo alguna posta guardó stock sin pedidos, se
                      quitará ese registro automáticamente. No se puede deshacer.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        disabled={pendingEliminar || pendingActualizar}
                      >
                        {pendingEliminar ? "Eliminando…" : "Sí, eliminar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pendingEliminar}
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
                    Eliminar insumo
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
