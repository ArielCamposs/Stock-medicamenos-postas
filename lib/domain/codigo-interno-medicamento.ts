/**
 * En producción ya hay 13 medicamentos con códigos 1–13; el siguiente es 14.
 * Si en la base hay códigos numéricos mayores, se respeta el máximo + 1.
 */
export const CODIGO_INTERNO_MEDICAMENTO_BASE_OCUPADOS = 13;

/** Mayor entero positivo encontrado en códigos solo numéricos, con piso en la base. */
export function maxCodigoInternoNumerico(codigosExistentes: readonly string[]): number {
  let max = CODIGO_INTERNO_MEDICAMENTO_BASE_OCUPADOS;
  for (const raw of codigosExistentes) {
    const t = raw.trim();
    if (!/^\d+$/.test(t)) continue;
    const n = Number.parseInt(t, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/** Siguiente código interno libre (solo dígitos, sin ceros a la izquierda). */
export function siguienteCodigoInternoMedicamento(
  codigosExistentes: readonly string[]
): string {
  return String(maxCodigoInternoNumerico(codigosExistentes) + 1);
}
