"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileDown, Package, Pill } from "lucide-react";

import { DespacharPedidoButton } from "@/components/bodega/despachar-pedido-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BodegaPedidoPendienteFila } from "@/lib/bodega/vista-despachos";
import { cn } from "@/lib/utils";

type Props = {
  pendientes: BodegaPedidoPendienteFila[];
};

function normaliza(s: string) {
  return s.trim().toLowerCase();
}

function filaCoincide(f: BodegaPedidoPendienteFila, q: string) {
  if (!q) return true;
  const blob = normaliza(
    `${f.postaNombre} ${f.postaCodigo ?? ""} ${f.mesTitulo} ${f.tipo}`
  );
  return blob.includes(q);
}

function PedidoCard({ fila }: { fila: BodegaPedidoPendienteFila }) {
  return (
    <li className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {fila.tipo === "medicamentos" ? (
              <Pill className="size-4 text-primary" aria-hidden />
            ) : (
              <Package className="size-4 text-primary" aria-hidden />
            )}
            <span className="font-semibold text-foreground">{fila.postaNombre}</span>
            {fila.postaCodigo ? (
              <Badge variant="outline" className="font-mono text-[10px]">
                {fila.postaCodigo}
              </Badge>
            ) : null}
            {fila.tipo === "medicamentos" && fila.pedidoTipo === "CONTRA_RECETA" ? (
              <Badge variant="secondary" className="text-[10px]">
                Contra receta
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {fila.tipo === "medicamentos" ? "Medicamentos" : "Insumos"} · {fila.mesTitulo}
          </p>
          <p className="text-xs text-muted-foreground">
            Enviado: {fila.enviadoEtiqueta} · {fila.nLineas}{" "}
            {fila.nLineas === 1 ? "línea" : "líneas"} ·{" "}
            <span className="tabular-nums font-medium text-foreground">
              {fila.totalUnidades}
            </span>{" "}
            unidades
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {fila.tipo === "medicamentos" ? (
            <Link
              href={`/api/pedidos/${fila.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
            >
              <FileDown className="size-3.5" aria-hidden />
              PDF
            </Link>
          ) : null}
          <DespacharPedidoButton
            pedidoId={fila.id}
            tipo={fila.tipo}
            postaNombre={fila.postaNombre}
          />
        </div>
      </div>
    </li>
  );
}

export function BodegaPedidosPanel({ pendientes }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const q = useMemo(() => normaliza(busqueda), [busqueda]);

  const pendientesFiltrados = useMemo(
    () => pendientes.filter((f) => filaCoincide(f, q)),
    [pendientes, q]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/60 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
        Los pedidos aparecen aquí cuando administración los marca como{" "}
        <strong className="text-foreground">Aprobado</strong>. Tu tarea es prepararlos y pulsar{" "}
        <strong className="text-foreground">Despachar</strong> para que cada posta pueda confirmar
        la recepción.
      </div>

      <div className="max-w-md">
        <Input
          type="search"
          placeholder="Buscar pendientes por posta, código o mes…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          autoComplete="off"
        />
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Pendientes de despacho
          <span className="ml-2 text-base font-normal tabular-nums text-muted-foreground">
            ({pendientesFiltrados.length})
          </span>
        </h2>
        {pendientes.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            No hay pedidos aprobados esperando despacho.
          </p>
        ) : pendientesFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin coincidencias en pendientes.</p>
        ) : (
          <ul className="space-y-3">
            {pendientesFiltrados.map((f) => (
              <PedidoCard key={`${f.tipo}-${f.id}`} fila={f} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
