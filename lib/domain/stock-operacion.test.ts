import assert from "node:assert/strict";
import test from "node:test";

import { cantidadPedidoSegunStockReferencial } from "@/lib/domain/pedido-mensual";
import {
  cierreFinDeMesAcumulado,
  type AgregadosPorMedicamento,
} from "@/lib/posta/stock-cierre-mensual";

test("cantidadPedidoSegunStockReferencial pide solo lo faltante", () => {
  assert.equal(cantidadPedidoSegunStockReferencial(4, 10), 6);
  assert.equal(cantidadPedidoSegunStockReferencial(10, 10), 0);
  assert.equal(cantidadPedidoSegunStockReferencial(12, 10), 0);
});

test("cierreFinDeMesAcumulado encadena ingresos y descuentos sin bajar de cero", () => {
  const agg: AgregadosPorMedicamento = new Map([
    [
      "med-1",
      {
        ingPorMes: new Map([
          ["2020-01", 10],
          ["2020-02", 5],
        ]),
        consPorMes: new Map([
          ["2020-01", 3],
          ["2020-02", 20],
          ["2020-03", 2],
        ]),
      },
    ],
  ]);

  assert.equal(cierreFinDeMesAcumulado(agg, "med-1", 2020, 1), 7);
  assert.equal(cierreFinDeMesAcumulado(agg, "med-1", 2020, 2), 0);
  assert.equal(cierreFinDeMesAcumulado(agg, "med-1", 2020, 3), 0);
});
