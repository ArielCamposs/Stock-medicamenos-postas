/** Unidades a pedir para alinear stock con el referencial (mismo criterio que la pantalla de pedidos). */
export function cantidadPedidoSegunStockReferencial(
  disponible: number,
  stockReferencial: number
): number {
  return Math.max(0, Math.trunc(stockReferencial) - Math.trunc(disponible));
}
