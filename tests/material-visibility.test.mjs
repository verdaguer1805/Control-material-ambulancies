import assert from "node:assert/strict";
import test from "node:test";

import { MATERIALS, SUPERVISOR_ONLY_MATERIALS } from "../src/data.js";

const normalize = (value) => String(value).trim().toLocaleLowerCase("es");

test("las tres pilas estándar están disponibles para las unidades", () => {
  const allMaterials = new Set(MATERIALS.map(normalize));
  const supervisorOnly = new Set(SUPERVISOR_ONLY_MATERIALS.map(normalize));

  for (const material of ["Pilas AA", "Pilas AAA", "Pilas CR123"]) {
    assert(allMaterials.has(normalize(material)), `${material} debe existir en la lista general`);
    assert(!supervisorOnly.has(normalize(material)), `${material} no puede estar oculto para las unidades`);
  }
});
