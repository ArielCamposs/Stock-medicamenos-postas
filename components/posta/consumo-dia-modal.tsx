"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { eliminarConsumoDiaAction } from "@/app/actions/posta";
import { encolarAnulacionLocal } from "@/lib/offline/anular-local";
import { addLocalMovement } from "@/lib/offline/db";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { nivelAlertaStock } from "@/lib/posta/admin-stock-alerta-postas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function formatFechaCorta(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export type ConsumoDiaModalProps = {
  postaId: string;
  medicamentoId: string;
  puedeRegistrar: boolean;
  /** Cuando no se puede registrar: mensaje del modal (admin general vs otros perfiles). */
  soloLecturaDescuentoVariante?: "admin" | "resto";
  medNombre: string;
  medCodigo: string;
  unidad: string;
  fechaISO: string;
  dia: number;
  initialCon: number;
  initialSin: number;
  /** Observación ya guardada para este día y medicamento (si existe). */
  initialObservacion?: string | null;
  disponibleMes: number;
  stockCritico: number;
  /** Umbral de referencia del mes (misma lógica que el resto del sistema para «cerca»). */
  stockRecomendado?: number;
  onClose: () => void;
  /** Se llama tras guardar en IndexedDB (sync OK o pendiente). */
  onLocalSaved?: () => void;
};

export function ConsumoDiaModal({
  postaId,
  medicamentoId,
  puedeRegistrar,
  soloLecturaDescuentoVariante = "resto",
  medNombre,
  medCodigo,
  unidad,
  fechaISO,
  dia,
  initialCon,
  initialSin,
  initialObservacion = null,
  disponibleMes,
  stockCritico,
  stockRecomendado = 0,
  onClose,
  onLocalSaved,
}: ConsumoDiaModalProps) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [saveInfo, setSaveInfo] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [delErrorLocal, setDelErrorLocal] = useState<string | null>(null);
  const savingRef = useRef(false);

  const boundEliminar = eliminarConsumoDiaAction.bind(null, postaId);

  const [con, setCon] = useState(String(initialCon));
  const [sin, setSin] = useState(String(initialSin));

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    if (online) return;
    if (!savingRef.current) return;
    setSaving(false);
    setSaveInfo(
      "Sin conexión. El descuento quedó guardado en este dispositivo y se sincronizará cuando vuelva internet."
    );
  }, [online]);

  const conN = con.trim() === "" ? 0 : Number.parseInt(con, 10);
  const sinN = sin.trim() === "" ? 0 : Number.parseInt(sin, 10);
  const total =
    Number.isNaN(conN) || Number.isNaN(sinN) ? "—" : conN + sinN;
  const totalNum = typeof total === "number" ? total : 0;
  const proyectadoSaldoMes =
    typeof total === "number"
      ? disponibleMes + initialCon + initialSin - totalNum
      : null;
  const nivelProyectado =
    proyectadoSaldoMes !== null && Number.isFinite(proyectadoSaldoMes)
      ? nivelAlertaStock(proyectadoSaldoMes, stockCritico, stockRecomendado)
      : null;
  const saldoNegativo = proyectadoSaldoMes !== null && proyectadoSaldoMes < 0;
  const alertaSaldoProyectado:
    | "critico"
    | "cerca"
    | null =
    proyectadoSaldoMes === null || !Number.isFinite(proyectadoSaldoMes)
      ? null
      : saldoNegativo || nivelProyectado === "critico"
        ? "critico"
        : nivelProyectado === "cerca"
          ? "cerca"
          : null;

  const hayRegistro = initialCon > 0 || initialSin > 0;
  const teniaRegistroEnServidor = hayRegistro;

  // Colores del header del modal según el estado del descuento
  const headerBg =
    !puedeRegistrar
      ? "bg-muted/40"
      : alertaSaldoProyectado === "critico"
        ? "bg-destructive/10"
        : alertaSaldoProyectado === "cerca"
          ? "bg-amber-500/10"
          : hayRegistro
            ? "bg-emerald-500/10"
            : "bg-primary/10";

  const titleColorClass =
    !puedeRegistrar
      ? "text-foreground"
      : alertaSaldoProyectado === "critico"
        ? "text-destructive"
        : alertaSaldoProyectado === "cerca"
          ? "text-amber-700 dark:text-amber-400"
          : hayRegistro
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-primary";

  async function handleAnular(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDelErrorLocal(null);
    setSaveError(null);

    const motivo = new FormData(e.currentTarget).get("motivo_anulacion")?.toString().trim();
    if (!motivo) {
      setDelErrorLocal("Indica un motivo para anular el descuento.");
      return;
    }

    setAnulando(true);
    try {
      const sinRed = typeof navigator !== "undefined" && !navigator.onLine;

      if (sinRed) {
        await encolarAnulacionLocal({
          postaId,
          medicamentoId,
          fechaISO,
          motivo,
          teniaRegistroEnServidor,
        });
        onLocalSaved?.();
        onClose();
        return;
      }

      const fd = new FormData(e.currentTarget);
      fd.set("fecha", fechaISO);
      fd.set("medicamento_id", medicamentoId);
      const result = await boundEliminar({}, fd);
      if (result.error) {
        setDelErrorLocal(result.error);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setDelErrorLocal("No se pudo anular en este dispositivo.");
    } finally {
      setAnulando(false);
    }
  }

  async function handleGuardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveError(null);
    setSaveInfo(null);

    if (Number.isNaN(conN) || Number.isNaN(sinN) || conN < 0 || sinN < 0) {
      setSaveError("Las cantidades deben ser números enteros mayores o iguales a 0.");
      return;
    }

    const obsInput = new FormData(e.currentTarget).get("observacion");
    const observacion =
      typeof obsInput === "string" && obsInput.trim().length > 0
        ? obsInput.trim().slice(0, 500)
        : null;

    setSaving(true);
    try {
      await addLocalMovement({
        idLocal: crypto.randomUUID(),
        postaId,
        medicamentoId,
        fechaConsumo: fechaISO,
        cantidadConAvis: conN,
        cantidadSinAvis: sinN,
        observacion,
        estado: "pending",
      });

      onLocalSaved?.();
      onClose();
    } catch {
      setSaveError("No se pudo guardar en este dispositivo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="descuento-modal-title"
        className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header coloreado según estado */}
        <div className={cn("shrink-0 px-5 pt-5 pb-4 border-b border-border/60 transition-colors duration-200", headerBg)}>
          <h2
            id="descuento-modal-title"
            className={cn("text-base font-bold leading-tight transition-colors duration-200", titleColorClass)}
          >
            {puedeRegistrar ? "Descuento" : soloLecturaDescuentoVariante === "admin" ? "Consulta descuento" : "Descuento"}{" "}
            — día {dia}
          </h2>
          <p className="mt-1.5 text-sm font-semibold text-foreground truncate">
            {medNombre}{" "}
            <span className="font-mono text-xs font-normal text-muted-foreground">({medCodigo})</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatFechaCorta(fechaISO)} · {unidad}
          </p>
        </div>
        {/* Body scrollable */}
        <div className="overflow-y-auto flex-1 p-5">

        {saveError ? (
          <p
            className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            {saveError}
          </p>
        ) : null}
        {saveInfo ? (
          <p
            className="mt-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground"
            role="status"
          >
            {saveInfo}
          </p>
        ) : null}
        {delErrorLocal ? (
          <p
            className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            {delErrorLocal}
          </p>
        ) : null}

        {puedeRegistrar ? (
          <>
            <form onSubmit={(ev) => void handleGuardar(ev)} className="mt-4 grid gap-4">
              <input type="hidden" name="fecha" value={fechaISO} />
              <input type="hidden" name="medicamento_id" value={medicamentoId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="modal-con-avis">Con AVIS</Label>
                  <Input
                    id="modal-con-avis"
                    name="cantidad_con_avis"
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={con}
                    onChange={(e) => setCon(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modal-sin-avis">Sin AVIS</Label>
                  <Input
                    id="modal-sin-avis"
                    name="cantidad_sin_avis"
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={sin}
                    onChange={(e) => setSin(e.target.value)}
                  />
                </div>
              </div>
              <div
                aria-live="polite"
                className={
                  alertaSaldoProyectado === "critico"
                    ? "rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm"
                    : alertaSaldoProyectado === "cerca"
                      ? "rounded-lg border border-amber-500/45 bg-amber-500/10 px-3 py-2.5 text-sm dark:border-amber-500/35 dark:bg-amber-950/30"
                      : "rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm"
                }
              >
                <p className="text-muted-foreground">
                  <span>Total del día: </span>
                  <span className="font-semibold tabular-nums text-foreground">{total}</span>{" "}
                  <span className="text-xs">({unidad})</span>
                </p>
                {alertaSaldoProyectado !== null && proyectadoSaldoMes !== null ? (
                  <p
                    className={
                      alertaSaldoProyectado === "critico"
                        ? "mt-2 border-t border-destructive/25 pt-2 text-xs text-destructive"
                        : "mt-2 border-t border-amber-600/20 pt-2 text-xs text-amber-950 dark:border-amber-500/25 dark:text-amber-50"
                    }
                  >
                    <span className="font-medium">Saldo en el mes: </span>
                    <span className="tabular-nums font-semibold">{proyectadoSaldoMes}</span>{" "}
                    <span className="opacity-90">({unidad}). </span>
                    <span className="font-normal">
                      {saldoNegativo
                        ? "Quedaría negativo."
                        : alertaSaldoProyectado === "critico"
                          ? "Bajo el mínimo."
                          : "Cerca del mínimo."}
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-observacion">Observación</Label>
                <Textarea
                  id="modal-observacion"
                  name="observacion"
                  maxLength={500}
                  rows={3}
                  defaultValue={initialObservacion ?? ""}
                  placeholder="Opcional"
                  className="resize-y min-h-[4.5rem]"
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving || anulando}>
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </form>

            {hayRegistro ? (
              <form
                onSubmit={(ev) => void handleAnular(ev)}
                className="mt-4 border-t border-border pt-4"
              >
                <input type="hidden" name="fecha" value={fechaISO} />
                <input type="hidden" name="medicamento_id" value={medicamentoId} />
                <div className="mb-3 space-y-2">
                  <Label htmlFor="modal-motivo-anulacion">Motivo de anulación</Label>
                  <Input
                    id="modal-motivo-anulacion"
                    name="motivo_anulacion"
                    maxLength={500}
                    required
                    placeholder="Ej.: error al cargar"
                  />
                </div>
                <Button
                  type="submit"
                  variant="destructive"
                  className="w-full"
                  disabled={saving || anulando}
                >
                  {anulando ? "Anulando…" : "Anular día"}
                </Button>
              </form>
            ) : null}
          </>
        ) : (
          <div className="mt-4 space-y-4">
            <div
              className={
                soloLecturaDescuentoVariante === "admin"
                  ? "rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-2.5 text-xs text-sky-950 dark:border-sky-400/30 dark:bg-sky-950/40 dark:text-sky-50"
                  : "rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground"
              }
              role="note"
            >
              {soloLecturaDescuentoVariante === "admin" ? (
                <>
                  <strong className="font-medium text-foreground">Solo consulta.</strong> El
                  encargado edita este descuento.
                </>
              ) : (
                <>
                  <strong className="font-medium text-foreground">Solo lectura.</strong> Lo
                  edita el encargado de la posta.
                </>
              )}
            </div>

            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Cantidades registradas
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-muted/25 px-3 py-3">
                  <p className="text-xs text-muted-foreground">Con AVIS</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums leading-none">
                    {initialCon}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{unidad}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/25 px-3 py-3">
                  <p className="text-xs text-muted-foreground">Sin AVIS</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums leading-none">
                    {initialSin}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{unidad}</p>
                </div>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Total descuento del día:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {initialCon + initialSin}
              </span>{" "}
              <span className="text-xs">({unidad})</span>
            </p>

            {initialObservacion ? (
              <div className="rounded-lg border border-border bg-muted/25 px-3 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Observación
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {initialObservacion}
                </p>
              </div>
            ) : null}

            <Button type="button" variant="secondary" className="w-full" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
