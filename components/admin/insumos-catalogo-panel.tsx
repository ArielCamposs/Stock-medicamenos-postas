"use client";

import { useActionState, useEffect, useState } from "react";

import {
  actualizarInsumoAdminAction,
  crearInsumoAdminAction,
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [modo, setModo] = useState<DialogMode>("nuevo");
  const [form, setForm] = useState<InsumoFormData>(FORM_VACIO);

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
    } else if (stateActualizar.error) {
      toast(stateActualizar.error, "error");
    }
  }, [stateActualizar, toast]);

  function abrirNuevo() {
    setModo("nuevo");
    setForm(FORM_VACIO);
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

  const pending = pendingCrear || pendingActualizar;

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
                  {insumos.map((ins, i) => (
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modo === "nuevo" ? "Nuevo insumo" : "Editar insumo"}</DialogTitle>
          </DialogHeader>
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
                Cantidad que cada posta debe mantener de este insumo.
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
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : modo === "nuevo" ? "Crear insumo" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
