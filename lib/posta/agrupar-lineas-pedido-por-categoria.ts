import {
  CATEGORIAS_AGRUPACION_UI,
  categoriaAgrupacionListado,
  etiquetaMedicamentoCategoria,
  type MedicamentoCategoria,
} from "@/lib/domain/medicamento-categoria";

export type LineaPedidoConCategoria = {
  categoria: MedicamentoCategoria;
  nombre: string;
  cantidad_final: number;
};

export type GrupoLineasPedidoPorCategoria<T extends LineaPedidoConCategoria> = {
  categoria: MedicamentoCategoria;
  etiqueta: string;
  lineas: T[];
  subtotalUnidades: number;
};

/** Agrupa líneas de pedido en el orden de categorías de la UI (Comprimidos, Inyectables, …). */
export function agruparLineasPedidoPorCategoria<T extends LineaPedidoConCategoria>(
  lineas: T[]
): GrupoLineasPedidoPorCategoria<T>[] {
  const porCat = new Map<MedicamentoCategoria, T[]>();
  for (const l of lineas) {
    const cat = categoriaAgrupacionListado(l.categoria);
    const arr = porCat.get(cat) ?? [];
    arr.push(l);
    porCat.set(cat, arr);
  }

  const grupos: GrupoLineasPedidoPorCategoria<T>[] = [];
  for (const cat of CATEGORIAS_AGRUPACION_UI) {
    const items = porCat.get(cat);
    if (!items?.length) continue;
    items.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
    grupos.push({
      categoria: cat,
      etiqueta: etiquetaMedicamentoCategoria[cat],
      lineas: items,
      subtotalUnidades: items.reduce((acc, l) => acc + l.cantidad_final, 0),
    });
  }
  return grupos;
}
