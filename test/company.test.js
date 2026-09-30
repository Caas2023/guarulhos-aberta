const test = require("node:test");
const assert = require("node:assert/strict");
const { buildCompanyPageData, slugify } = require("../lib/company");
const companyHandler = require("../api/company");

test("slugify converte nomes e categorias para slugs válidos de URL nacional", () => {
  assert.equal(slugify("Óticas & Serviços SP"), "oticas-servicos-sp");
  assert.equal(slugify("CaaS Express Motofrete"), "caas-express-motofrete");
  assert.equal(slugify(""), "geral");
  assert.equal(slugify(null), "geral");
});

test("buildCompanyPageData gera estrutura completa de página individual de empresa com rotas IBGE e Schema JSON-LD", () => {
  const rawCompany = {
    id: "osm-node-998877",
    name: "CaaS Express Logística",
    category: "Logística e Entregas",
    formattedAddress: "Av. Paulista, 100, Centro, Guarulhos, SP",
    phone: "11999990000",
    website: "https://caasexpress.com",
    lat: -23.4542,
    lon: -46.5312,
  };

  const result = buildCompanyPageData(rawCompany, "3518800");

  assert.equal(result.success, true);
  assert.equal(result.locality.municipalityId, "3518800");
  assert.equal(result.locality.municipalityName, "Guarulhos");
  assert.equal(result.locality.stateCode, "SP");
  assert.equal(result.route.stateSlug, "sp");
  assert.equal(result.route.municipalitySlug, "guarulhos");
  assert.equal(result.route.categorySlug, "logistica-e-entregas");
  assert.equal(result.canonicalPath, "/sp/guarulhos/logistica-e-entregas/caas-express-logistica-osm-node-998877");
  assert.equal(result.schema.localBusiness["@type"], "LocalBusiness");
  assert.equal(result.schema.localBusiness.name, "CaaS Express Logística");
  assert.equal(result.schema.breadcrumbs["@type"], "BreadcrumbList");
  assert.equal(result.schema.breadcrumbs.itemListElement.length, 4);
});

test("buildCompanyPageData rejeita empresa sem nome ou localidade inválida", () => {
  assert.throws(
    () => buildCompanyPageData({}, "3518800"),
    { name: "Error", message: "Nome da empresa é obrigatório" }
  );

  assert.throws(
    () => buildCompanyPageData({ name: "Empresa X" }, "9999999"),
    { name: "Error", message: "Localidade IBGE inválida ou não informada" }
  );
});

test("api/company handler método GET retorna 200 e dados estruturados da empresa", async () => {
  let statusCode = 0;
  let responseData = null;

  const req = {
    method: "GET",
    query: {
      municipalityId: "3518800",
      name: "Óticas Dyana",
      category: "Óticas",
    },
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  await companyHandler(req, res);

  assert.equal(statusCode, 200);
  assert.equal(responseData.success, true);
  assert.equal(responseData.company.name, "Óticas Dyana");
  assert.equal(responseData.locality.municipalityName, "Guarulhos");
  assert.equal(responseData.schema.localBusiness.name, "Óticas Dyana");
});

test("api/company handler método POST retorna 405 Method Not Allowed", async () => {
  let statusCode = 0;
  let responseData = null;

  const req = { method: "POST" };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  await companyHandler(req, res);

  assert.equal(statusCode, 405);
  assert.equal(responseData.error, "Method Not Allowed");
});
