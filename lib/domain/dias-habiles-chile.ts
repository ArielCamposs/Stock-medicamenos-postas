import Holidays from "date-holidays";

import {
  diasEnMes,
  fechaCalendarioEnZonaIANA,
  fechaISOEnMes,
  ZONA_CALENDARIO_OPERACION,
} from "@/lib/domain/fecha-mes";

let feriadosChile: Holidays | null = null;

function feriadosChileInstance(): Holidays {
  if (!feriadosChile) {
    feriadosChile = new Holidays("CL");
  }
  return feriadosChile;
}

/** Día de la semana en Chile: 0 = domingo … 6 = sábado. */
export function diaSemanaCalendarioChile(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return NaN;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ref = new Date(Date.UTC(y, mo - 1, d, 15, 0, 0));
  const nombre = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_CALENDARIO_OPERACION,
    weekday: "short",
  }).format(ref);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[nombre] ?? NaN;
}

export function esFinDeSemanaChile(iso: string): boolean {
  const d = diaSemanaCalendarioChile(iso);
  return d === 0 || d === 6;
}

function isoAFechaCalendario(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return new Date(NaN);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d, 12, 0, 0);
}

/** Feriado legal público en Chile (incluye irrenunciables y trasladados según calendario oficial). */
export function esFestivoChile(iso: string): boolean {
  const hit = feriadosChileInstance().isHoliday(isoAFechaCalendario(iso));
  if (!hit) return false;
  if (Array.isArray(hit)) {
    return hit.some((h) => h.type === "public");
  }
  return true;
}

/** Lunes a viernes y sin feriado en Chile. */
export function esDiaHabilChile(iso: string): boolean {
  if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(iso)) return false;
  if (esFinDeSemanaChile(iso)) return false;
  if (esFestivoChile(iso)) return false;
  return true;
}

/** Último día hábil del mes calendario (`mes` 1–12) en Chile. */
export function ultimoDiaHabilMes(anio: number, mes: number): string {
  const ultimo = diasEnMes(anio, mes);
  for (let dia = ultimo; dia >= 1; dia -= 1) {
    const iso = fechaISOEnMes(anio, mes, dia);
    if (esDiaHabilChile(iso)) return iso;
  }
  return fechaISOEnMes(anio, mes, 1);
}

/**
 * Permite cerrar el mes contable `(anio, mes)` solo el último día hábil de ese mes
 * (lunes a viernes, sin feriados en Chile) según «hoy» en {@link ZONA_CALENDARIO_OPERACION}.
 */
export function permiteCierreMensualCalendarioOperacion(
  anio: number,
  mes: number,
  ref: Date = new Date()
): boolean {
  const hoy = fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION, ref);
  return hoy === ultimoDiaHabilMes(anio, mes);
}
