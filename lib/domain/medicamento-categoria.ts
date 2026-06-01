/**
 * Valores del enum `public.medicamento_categoria` (orden de listados y tablas).
 * En Postgres puede existir el valor legado `FRASCOS_POMADAS_SUPOSITORIOS`; la app lo normaliza.
 */
export const MEDICAMENTO_CATEGORIAS = [
  "COMPRIMIDOS",
  "INYECTABLES",
  "FRASCOS",
  "POMADAS_SUPOSITORIOS",
  "PROGRAMA_MUJER",
  "CONTRA_RECETA",
  "OTROS",
] as const;

export type MedicamentoCategoria = (typeof MEDICAMENTO_CATEGORIAS)[number];

/** Valor antiguo del enum en base de datos (categoría unificada). */
export const CATEGORIA_MEDICAMENTO_LEGACY_FRASCOS_POMADAS = "FRASCOS_POMADAS_SUPOSITORIOS";

export const etiquetaMedicamentoCategoria: Record<MedicamentoCategoria, string> = {
  COMPRIMIDOS: "Comprimidos",
  INYECTABLES: "Inyectables",
  FRASCOS: "Frascos",
  POMADAS_SUPOSITORIOS: "Pomadas y supositorios",
  PROGRAMA_MUJER: "Programa mujer",
  CONTRA_RECETA: "Contra receta (sin presentación)",
  OTROS: "Otros",
};

/** Categorías al crear/editar ficha: la presentación no debe ser el enum CONTRA_RECETA (usar el checkbox). */
export const CATEGORIAS_CATALOGO_FORMULARIO = MEDICAMENTO_CATEGORIAS.filter(
  (c) => c !== "CONTRA_RECETA"
);

export function esMedicamentoCategoria(v: string): v is MedicamentoCategoria {
  return (MEDICAMENTO_CATEGORIAS as readonly string[]).includes(v);
}

/** Lectura API / formulario: valores desconocidos o legados se normalizan. */
export function normalizarMedicamentoCategoria(
  raw: string | null | undefined
): MedicamentoCategoria {
  const s = raw?.toString().trim() ?? "";
  if (s === CATEGORIA_MEDICAMENTO_LEGACY_FRASCOS_POMADAS) {
    return "FRASCOS";
  }
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

/** Orden de cabeceras de grupo en tablas y pedidos (incluye categoría legada CONTRA_RECETA). */
export const CATEGORIAS_AGRUPACION_UI = MEDICAMENTO_CATEGORIAS;

/** Categoría tal como está en catálogo, para agrupar filas (sin remapear a Otros). */
export function categoriaAgrupacionListado(
  categoria: MedicamentoCategoria | string | null | undefined
): MedicamentoCategoria {
  return normalizarMedicamentoCategoria(categoria);
}

export function compararMedicamentoPorCategoriaAgrupacionNombre(
  categoriaA: MedicamentoCategoria | string | null | undefined,
  nombreA: string,
  categoriaB: MedicamentoCategoria | string | null | undefined,
  nombreB: string
): number {
  return compararMedicamentoPorCategoriaNombre(
    categoriaAgrupacionListado(categoriaA),
    nombreA,
    categoriaAgrupacionListado(categoriaB),
    nombreB
  );
}

/** Unidad de medida por defecto al crear/editar según la categoría del catálogo. */
/** Contra receta por flag en catálogo o por categoría legada. */
export function esMedicamentoContraReceta(input: {
  es_contra_receta?: boolean;
  categoria?: MedicamentoCategoria | string | null;
}): boolean {
  if (input.es_contra_receta === true) return true;
  const cat = normalizarMedicamentoCategoria(
    typeof input.categoria === "string" ? input.categoria : undefined
  );
  return cat === "CONTRA_RECETA";
}

export function unidadMedidaDesdeCategoria(categoria: MedicamentoCategoria): string {
  switch (categoria) {
    case "COMPRIMIDOS":
      return "comprimidos";
    case "INYECTABLES":
      return "ampollas";
    case "FRASCOS":
      return "frascos";
    case "POMADAS_SUPOSITORIOS":
      return "unidades";
    case "PROGRAMA_MUJER":
      return "unidades";
    case "CONTRA_RECETA":
      return "unidades";
    default:
      return "unidades";
  }
}
