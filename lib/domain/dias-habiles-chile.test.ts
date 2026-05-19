import assert from "node:assert/strict";
import test from "node:test";

import {
  esDiaHabilChile,
  esFestivoChile,
  esFinDeSemanaChile,
  permiteCierreMensualCalendarioOperacion,
  ultimoDiaHabilMes,
} from "@/lib/domain/dias-habiles-chile";

test("sábado y domingo no son hábiles", () => {
  assert.equal(esFinDeSemanaChile("2026-01-31"), true);
  assert.equal(esFinDeSemanaChile("2026-02-01"), true);
  assert.equal(esDiaHabilChile("2026-01-31"), false);
});

test("18 de septiembre es feriado en Chile", () => {
  assert.equal(esFestivoChile("2025-09-18"), true);
  assert.equal(esDiaHabilChile("2025-09-18"), false);
});

test("último día hábil de enero 2026 es viernes 30 (31 es sábado)", () => {
  assert.equal(ultimoDiaHabilMes(2026, 1), "2026-01-30");
});

test("cierre permitido solo el último día hábil del mes", () => {
  assert.equal(
    permiteCierreMensualCalendarioOperacion(2026, 1, new Date("2026-01-30T15:00:00Z")),
    true
  );
  assert.equal(
    permiteCierreMensualCalendarioOperacion(2026, 1, new Date("2026-01-31T15:00:00Z")),
    false
  );
  assert.equal(
    permiteCierreMensualCalendarioOperacion(2026, 1, new Date("2026-01-29T15:00:00Z")),
    false
  );
});
