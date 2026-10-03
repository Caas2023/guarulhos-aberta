"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const placesHandler = require("../api/places");
const { resetMemoryStore, saveCompany } = require("../lib/company_store");

test.beforeEach(() => {
  resetMemoryStore();
});

function createMockResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

test("api/places: consulta catálogo persistente da cidade-piloto por padrão", async () => {
  const req = { query: {} };
  const res = createMockResponse();

  await placesHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source.name, "OpenStreetMap");
  assert.equal(res.body.source.license, "ODbL 1.0");
  assert.equal(res.body.locality.municipalityId, "3518800");
  assert.equal(res.body.locality.municipalityName, "Guarulhos");
  assert.equal(res.body.locality.stateCode, "SP");
  assert.ok(Array.isArray(res.body.places));
  assert.ok(res.body.places.length > 0);
  assert.equal(res.body.provider, "persistent-store");
});

test("api/places: busca com filtro textual no catálogo", async () => {
  const req = {
    query: {
      query: "Habib's",
    },
  };
  const res = createMockResponse();

  await placesHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.places.length > 0);
  assert.ok(
    res.body.places.some((p) => p.name.toLowerCase().includes("habib"))
  );
});

test("api/places: retorna 404 para localidade IBGE inexistente", async () => {
  const req = {
    query: {
      municipalityId: "9999999",
    },
  };
  const res = createMockResponse();

  await placesHandler(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, "Not Found");
  assert.ok(/não encontrada/.test(res.body.message));
});

test("api/places: suporta resolução de localidade por stateSlug e municipalitySlug", async () => {
  const req = {
    query: {
      stateSlug: "sp",
      municipalitySlug: "guarulhos",
    },
  };
  const res = createMockResponse();

  await placesHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.locality.municipalityId, "3518800");
  assert.equal(res.body.locality.municipalityName, "Guarulhos");
});

test("api/places: isolamento nacional retorna empresas do município consultado", async () => {
  // Salva empresa teste na cidade-piloto
  await saveCompany(
    {
      id: "teste-gru-1",
      name: "Auto Peças Guarulhos",
      municipalityId: "3518800",
      category: "Automóveis",
      address: "Av. Tiradentes, 500",
    },
    {}
  );

  const req = {
    query: {
      municipalityId: "3518800",
      query: "Auto Peças Guarulhos",
    },
  };
  const res = createMockResponse();

  await placesHandler(req, res);

  assert.equal(res.statusCode, 200);
  const found = res.body.places.find((p) => p.name === "Auto Peças Guarulhos");
  assert.ok(found);
  assert.equal(found.formattedAddress, "Av. Tiradentes, 500");
});
