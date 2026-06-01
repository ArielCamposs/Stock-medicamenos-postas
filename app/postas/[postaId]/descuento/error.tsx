"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function DescuentoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[descuento]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-destructive/30 bg-card p-6">
      <h1 className="font-heading text-xl font-semibold">No se pudo cargar Descuento diario</h1>
      <p className="text-sm text-muted-foreground">
        Ocurrió un error al preparar el calendario del mes. Probá recargar la página.
      </p>
      {error.message ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground font-mono break-words">
          {error.message}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Si instalaste la app o usaste modo offline, cerrá la pestaña, volvé a entrar con internet
        y recargá con <strong>Ctrl+F5</strong> para actualizar la copia en caché.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => reset()}>
          Reintentar
        </Button>
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          Recargar página
        </Button>
      </div>
    </div>
  );
}
