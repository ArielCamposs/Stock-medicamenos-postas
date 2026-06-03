/** Año y mes local del navegador/servidor para agrupar stock y descuentos. */
export function anioMesActual(desde: Date = new Date()) {
  return {
    anio: desde.getFullYear(),
    mes: desde.getMonth() + 1,
  };
}

/** Mes calendario anterior (para saldo de cierre del mes previo). */
export function mesAnterior(anio: number, mes: number) {
  if (mes <= 1) {
    return { anio: anio - 1, mes: 12 };
  }
  return { anio, mes: mes - 1 };
}

/** Mes calendario siguiente. */
export function mesSiguiente(anio: number, mes: number) {
  if (mes >= 12) {
    return { anio: anio + 1, mes: 1 };
  }
  return { anio, mes: mes + 1 };
}

/** Cantidad de días del mes (`mes` 1–12). */
export function diasEnMes(anio: number, mes: number) {
  return new Date(anio, mes, 0).getDate();
}

/** Fecha ISO local `YYYY-MM-DD` para un día del mes. */
export function fechaISOEnMes(anio: number, mes: number, dia: number) {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Normaliza `YYYY-MM-DD` o ISO con hora (`2026-06-02T00:00:00Z`) a calendario `YYYY-MM-DD`. */
export function normalizarFechaCalendarioISO(raw: unknown): string {
  if (raw == null) return "";
  const t = String(raw).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t);
  return m ? m[1] : t;
}

/** Suma días sobre calendario ISO (sin depender de la zona del navegador). */
export function addDiasCalendarioISO(iso: string, dias: number): string {
  const norm = normalizarFechaCalendarioISO(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(norm)) return norm;
  const [y, m, d] = norm.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return fechaISOEnMes(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function fechaEnRangoCalendario(fecha: string, desde: string, hasta: string): boolean {
  const f = normalizarFechaCalendarioISO(fecha);
  const a = normalizarFechaCalendarioISO(desde);
  const b = normalizarFechaCalendarioISO(hasta);
  if (!f || !a || !b) return false;
  return f >= a && f <= b;
}

export function fechaPerteneceMesCalendario(fecha: string, mesYYYYMM: string): boolean {
  const f = normalizarFechaCalendarioISO(fecha);
  const mes = mesYYYYMM.trim();
  return mes.length === 7 && f.startsWith(mes);
}

/** Primer y último día del mes en ISO. */
export function rangoFechasMesISO(anio: number, mes: number) {
  const last = diasEnMes(anio, mes);
  return {
    desde: fechaISOEnMes(anio, mes, 1),
    hasta: fechaISOEnMes(anio, mes, last),
    diasEnMes: last,
  };
}

export function etiquetaMes(anio: number, mes: number) {
  return `${String(mes).padStart(2, "0")}/${anio}`;
}

/** Fecha calendario `YYYY-MM-DD` → `DD/MM/YYYY` para pantallas. */
export function etiquetaFechaCalendarioDDMMYYYY(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function fechaInputHoy() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Zona para alinear «hoy» del servidor con el calendario de operación (postas en Chile). */
export const ZONA_CALENDARIO_OPERACION = "America/Santiago";

/**
 * Fecha calendario `YYYY-MM-DD` en una zona IANA (evita usar solo UTC del host,
 * que desalinea descuentos/ingresos guardados con día local del encargado).
 */
export function fechaCalendarioEnZonaIANA(
  timeZone: string,
  ref: Date = new Date()
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ref);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) {
    return fechaInputHoy();
  }
  return `${y}-${m}-${d}`;
}

/** Año y mes calendario actual según {@link ZONA_CALENDARIO_OPERACION} (Chile). */
export function anioMesCalendarioOperacion(ref: Date = new Date()) {
  const hoy = fechaCalendarioEnZonaIANA(ZONA_CALENDARIO_OPERACION, ref);
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(hoy);
  if (!m) return anioMesActual(ref);
  return { anio: Number(m[1]), mes: Number(m[2]) };
}

const RE_MES_YYYY_MM = /^\d{4}-\d{2}$/;

/**
 * Fecha de un ingreso según el mes contable elegido (`YYYY-MM`) y el reloj local de referencia (`ahora`).
 * Si el mes coincide con el de `ahora`, usa el día de hoy; si no, el mismo número de día del mes elegido,
 * limitado al último día de ese mes (por ejemplo 31 → 28 en febrero).
 */
export function fechaIngresoParaMesMovimiento(
  mesYYYYMM: string,
  ahora: Date = new Date()
): string | null {
  const t = mesYYYYMM.trim();
  if (!RE_MES_YYYY_MM.test(t)) return null;
  const [ys, ms] = t.split("-");
  const anioSel = parseInt(ys, 10);
  const mesSel = parseInt(ms, 10);
  if (!Number.isFinite(anioSel) || !Number.isFinite(mesSel)) return null;
  if (mesSel < 1 || mesSel > 12) return null;

  const anioHoy = ahora.getFullYear();
  const mesHoy = ahora.getMonth() + 1;
  const diaHoy = ahora.getDate();

  if (anioSel === anioHoy && mesSel === mesHoy) {
    return fechaISOEnMes(anioHoy, mesHoy, diaHoy);
  }

  const maxD = diasEnMes(anioSel, mesSel);
  const dia = Math.min(diaHoy, maxD);
  return fechaISOEnMes(anioSel, mesSel, dia);
}

/**
 * Fecha y hora en Chile, 24 h, formato estable `YYYY-MM-DD HH:mm`.
 * Sirve para texto mostrado en Client Components: evita hydration mismatch entre Node y navegador
 * al no usar `toLocaleString("es-CL")` con estilo corto / AM-PM.
 */
export function etiquetaInstanteChile24h(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    return iso;
  }
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONA_CALENDARIO_OPERACION,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
  return s.replace("T", " ").replace(",", " ");
}

export { permiteCierreMensualCalendarioOperacion } from "@/lib/domain/dias-habiles-chile";
