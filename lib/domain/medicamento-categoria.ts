/**
 * Valores del enum `public.medicamento_categoria` (orden de listados y tablas).
 */
export const MEDICAMENTO_CATEGORIAS = [
  "COMPRIMIDOS",
  "INYECTABLES",
  "FRASCOS_POMADAS_SUPOSITORIOS",
  "PROGRAMA_MUJER",
  "CONTRA_RECETA",
  "OTROS",
] as const;

export type MedicamentoCategoria = (typeof MEDICAMENTO_CATEGORIAS)[number];

export const etiquetaMedicamentoCategoria: Record<MedicamentoCategoria, string> = {
  COMPRIMIDOS: "Comprimidos",
  INYECTABLES: "Inyectables",
  FRASCOS_POMADAS_SUPOSITORIOS: "Frascos, pomadas y supositorios",
  PROGRAMA_MUJER: "Programa mujer",
  CONTRA_RECETA: "Medicamentos con entrega contra receta",
  OTROS: "Otros",
};

export function esMedicamentoCategoria(v: string): v is MedicamentoCategoria {
  return (MEDICAMENTO_CATEGORIAS as readonly string[]).includes(v);
}

/** Lectura API / formulario: valores desconocidos caen en OTROS. */
export function normalizarMedicamentoCategoria(
  raw: string | null | undefined
): MedicamentoCategoria {
  const s = raw?.toString().trim() ?? "";
  if (esMedicamentoCategoria(s)) return s;
  return "OTROS";
}

export function indiceOrdenCategoria(c: MedicamentoCategoria): number {
  const i = MEDICAMENTO_CATEGORIAS.indexOf(c);
  return i >= 0 ? i : MEDICAMENTO_CATEGORIAS.length;
}

export function compararMedicamentoPorCategoriaNombre(
  categoriaA: MedicamentoCategoria,
  nombreA: string,
  categoriaB: MedicamentoCategoria,
  nombreB: string
): number {
  const d = indiceOrdenCategoria(categoriaA) - indiceOrdenCategoria(categoriaB);
  if (d !== 0) return d;
  return nombreA.localeCompare(nombreB, "es", { sensitivity: "base" });
}
