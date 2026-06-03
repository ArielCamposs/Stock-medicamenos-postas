import assert from "node:assert/strict";
import test from "node:test";

import {
  addDiasCalendarioISO,
  fechaEnRangoCalendario,
  fechaPerteneceMesCalendario,
  normalizarFechaCalendarioISO,
} from "./fecha-mes";

test("normaliza fecha con hora para comparar rangos", () => {
  assert.equal(normalizarFechaCalendarioISO("2026-06-02T00:00:00.000Z"), "2026-06-02");
  assert.equal(
    fechaEnRangoCalendario("2026-06-02T00:00:00.000Z", "2026-06-01", "2026-06-02"),
    true
  );
  assert.equal(fechaPerteneceMesCalendario("2026-06-02T12:00:00", "2026-06"), true);
});

test("addDiasCalendarioISO respeta calendario", () => {
  assert.equal(addDiasCalendarioISO("2026-06-02", -7), "2026-05-26");
});
