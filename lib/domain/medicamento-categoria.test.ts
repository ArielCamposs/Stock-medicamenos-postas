import assert from "node:assert/strict";
import test from "node:test";

import {
  CATEGORIA_MEDICAMENTO_LEGACY_FRASCOS_POMADAS,
  normalizarMedicamentoCategoria,
  unidadMedidaDesdeCategoria,
} from "@/lib/domain/medicamento-categoria";

test("normaliza categoría legada unificada a Frascos", () => {
  assert.equal(
    normalizarMedicamentoCategoria(CATEGORIA_MEDICAMENTO_LEGACY_FRASCOS_POMADAS),
    "FRASCOS"
  );
});

test("unidad según categorías separadas", () => {
  assert.equal(unidadMedidaDesdeCategoria("FRASCOS"), "frascos");
  assert.equal(unidadMedidaDesdeCategoria("POMADAS_SUPOSITORIOS"), "unidades");
});
