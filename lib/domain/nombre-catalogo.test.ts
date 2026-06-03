import assert from "node:assert/strict";
import test from "node:test";

import { nombresCatalogoEquivalentes, normalizarNombreCatalogo } from "./nombre-catalogo";

test("normaliza espacios y mayúsculas", () => {
  assert.equal(normalizarNombreCatalogo("  Guantes   de  látex "), "guantes de látex");
});

test("detecta nombres equivalentes", () => {
  assert.equal(nombresCatalogoEquivalentes("Paracetamol", "  paracetamol "), true);
  assert.equal(nombresCatalogoEquivalentes("A", "B"), false);
});
