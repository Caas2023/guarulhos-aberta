const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getLocalityByMunicipalityId,
  getLocalityPath,
  localities,
  validateLocality,
} = require("../lib/localities");

test("catálogo piloto usa IDs IBGE e slugs separados", () => {
  const guarulhos = getLocalityByMunicipalityId("3518800");

  assert.deepEqual(guarulhos, {
    municipalityId: "3518800",
    stateId: "35",
    stateCode: "SP",
    stateSlug: "sp",
    municipalityName: "Guarulhos",
    municipalitySlug: "guarulhos",
  });
  assert.equal(localities.length, 1);
});

test("gera hierarquia nacional de rotas sem nome fixo da cidade", () => {
  const locality = getLocalityByMunicipalityId("3518800");

  assert.equal(getLocalityPath(locality), "/sp/guarulhos");
  assert.equal(getLocalityPath(locality, "oticas"), "/sp/guarulhos/oticas");
  assert.equal(
    getLocalityPath(locality, "oticas", "oticas-dyana"),
    "/sp/guarulhos/oticas/oticas-dyana",
  );
});

test("rejeita IDs IBGE e slugs inválidos", () => {
  assert.equal(getLocalityByMunicipalityId("guarulhos"), null);
  assert.throws(
    () => validateLocality({ ...localities[0], municipalityId: "123" }),
    /7 dígitos/,
  );
  assert.throws(
    () => getLocalityPath(localities[0], "Óticas"),
    /Segmento de rota inválido/,
  );
  assert.throws(
    () => getLocalityPath(localities[0], undefined, "oticas-dyana"),
    /businessSlug exige categorySlug/,
  );
});
