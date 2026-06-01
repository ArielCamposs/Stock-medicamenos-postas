import assert from "node:assert/strict";
import test from "node:test";

import {
  maxCodigoInternoNumerico,
  siguienteCodigoInternoMedicamento,
} from "@/lib/domain/codigo-interno-medicamento";

test("parte en 14 si no hay códigos numéricos en catálogo", () => {
  assert.equal(siguienteCodigoInternoMedicamento([]), "14");
});

test("sigue la secuencia numérica existente", () => {
  assert.equal(siguienteCodigoInternoMedicamento(["1", "2", "13"]), "14");
  assert.equal(siguienteCodigoInternoMedicamento(["10", "25"]), "26");
});

test("ignora códigos no numéricos al calcular el máximo", () => {
  assert.equal(maxCodigoInternoNumerico(["ABC", "7", "M-12"]), 13);
  assert.equal(siguienteCodigoInternoMedicamento(["ABC", "7"]), "14");
});
