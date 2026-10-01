"use strict";

/**
 * Test suite — Category Page Builder + API handler
 * Tests: 26 total
 * Covers: slug normalisation, label mapping, pagination, ItemList schema,
 *         BreadcrumbList schema, national routing (no Guarulhos hardcoded),
 *         API 200/400/404/405 responses, data provenance fields.
 */

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  buildCategoryPageData,
  buildItemListSchema,
  buildCategoryBreadcrumb,
  categoryLabel,
  slugify,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
} = require("../lib/category_page");

const guarulhos = {
  municipalityId: "3518800",
  stateId: "35",
  stateCode: "SP",
  stateSlug: "sp",
  municipalityName: "Guarulhos",
  municipalitySlug: "guarulhos",
};

/* stub company set shared across tests */
function makeCompanies(n, category = "alimentacao", ibge = "3518800") {
  return Array.from({ length: n }, (_, i) => ({
    id: 1000 + i,
    name: `Empresa ${i + 1}`,
    slug: `empresa-${i + 1}`,
    category,
    ibge,
    source: "OpenStreetMap",
    source_license: "ODbL 1.0",
  }));
}

const SAMPLE_COMPANIES = [
  ...makeCompanies(5, "alimentacao"),
  ...makeCompanies(3, "beleza"),
  ...makeCompanies(2, "tecnologia"),
];

/* ── slugify ── */
test("slugify converte caracteres especiais e acentos", () => {
  assert.equal(slugify("Alimentação"), "alimentacao");
  assert.equal(slugify("Serviços Públicos"), "servicos-publicos");
  assert.equal(slugify("Beleza & Estética"), "beleza-estetica");
});

test("slugify retorna 'geral' para entrada vazia ou inválida", () => {
  assert.equal(slugify(""), "geral");
  assert.equal(slugify(null), "geral");
  assert.equal(slugify(undefined), "geral");
});

/* ── categoryLabel ── */
test("categoryLabel retorna rótulo em pt-BR para slugs conhecidos", () => {
  assert.equal(categoryLabel("alimentacao"), "Alimentação");
  assert.equal(categoryLabel("saude"), "Saúde");
  assert.equal(categoryLabel("servicos-publicos"), "Serviços Públicos");
});

test("categoryLabel capitaliza slugs desconhecidos como fallback", () => {
  const label = categoryLabel("novacategoria");
  assert.ok(label.length > 0);
  assert.match(label, /^[A-Z]/); // starts with uppercase
});

test("categoryLabel retorna 'Empresas' para entrada vazia", () => {
  assert.equal(categoryLabel(""), "Empresas");
  assert.equal(categoryLabel(null), "Empresas");
});

/* ── buildItemListSchema ── */
test("buildItemListSchema gera ItemList válido com URLs nacionais IBGE", () => {
  const companies = makeCompanies(3, "alimentacao");
  const schema = buildItemListSchema(companies, guarulhos, "alimentacao", "https://example.com");
  assert.equal(schema["@type"], "ItemList");
  assert.equal(schema.numberOfItems, 3);
  assert.equal(schema.itemListElement.length, 3);
  assert.ok(schema["@id"].includes("/sp/guarulhos/alimentacao"));
  assert.ok(schema.url.includes("/sp/guarulhos/alimentacao"));
});

test("buildItemListSchema gera URLs individuais com slug da empresa", () => {
  const companies = makeCompanies(2, "beleza");
  const schema = buildItemListSchema(companies, guarulhos, "beleza", "https://example.com");
  const firstUrl = schema.itemListElement[0].url;
  assert.ok(firstUrl.includes("/sp/guarulhos/beleza/empresa-1"));
});

test("buildItemListSchema inclui nome da cidade e UF no campo name", () => {
  const schema = buildItemListSchema(makeCompanies(1), guarulhos, "alimentacao", "https://x.com");
  assert.ok(schema.name.includes("Guarulhos"));
  assert.ok(schema.name.includes("SP"));
});

test("buildItemListSchema com lista vazia retorna numberOfItems 0", () => {
  const schema = buildItemListSchema([], guarulhos, "alimentacao", "https://example.com");
  assert.equal(schema.numberOfItems, 0);
  assert.equal(schema.itemListElement.length, 0);
});

/* ── buildCategoryBreadcrumb ── */
test("buildCategoryBreadcrumb produz 3 níveis: Início / Município / Categoria", () => {
  const bc = buildCategoryBreadcrumb(guarulhos, "alimentacao", "https://example.com");
  assert.equal(bc["@type"], "BreadcrumbList");
  assert.equal(bc.itemListElement.length, 3);
  assert.equal(bc.itemListElement[0].position, 1);
  assert.equal(bc.itemListElement[0].name, "Início");
  assert.ok(bc.itemListElement[1].name.includes("Guarulhos"));
  assert.equal(bc.itemListElement[2].position, 3);
});

test("buildCategoryBreadcrumb URLs seguem rota nacional IBGE", () => {
  const bc = buildCategoryBreadcrumb(guarulhos, "beleza", "https://example.com");
  assert.equal(bc.itemListElement[1].item, "https://example.com/sp/guarulhos");
  assert.equal(bc.itemListElement[2].item, "https://example.com/sp/guarulhos/beleza");
});

/* ── buildCategoryPageData ── */
test("buildCategoryPageData retorna estrutura completa para categoria válida", () => {
  const data = buildCategoryPageData({
    categorySlug: "alimentacao",
    localityRef: "3518800",
    allCompanies: SAMPLE_COMPANIES,
  });
  assert.equal(data.categorySlug, "alimentacao");
  assert.equal(data.locality.municipalityId, "3518800");
  assert.ok(Array.isArray(data.companies));
  assert.ok(Array.isArray(data.schemas));
  assert.equal(data.schemas.length, 2);
  assert.ok(data.canonicalUrl.includes("/sp/guarulhos/alimentacao"));
  assert.ok(data.route.startsWith("/sp/guarulhos/alimentacao"));
});

test("buildCategoryPageData filtra apenas empresas da categoria correta", () => {
  const data = buildCategoryPageData({
    categorySlug: "alimentacao",
    localityRef: "3518800",
    allCompanies: SAMPLE_COMPANIES,
  });
  assert.equal(data.pagination.totalCount, 5);
  data.companies.forEach((c) => assert.equal(c.category, "alimentacao"));
});

test("buildCategoryPageData paginação retorna página 1 com tamanho padrão", () => {
  // Create 25 companies to test pagination
  const many = makeCompanies(25, "alimentacao");
  const data = buildCategoryPageData({
    categorySlug: "alimentacao",
    localityRef: "3518800",
    allCompanies: many,
  });
  assert.equal(data.pagination.page, 1);
  assert.equal(data.pagination.totalCount, 25);
  assert.equal(data.pagination.totalPages, 2);
  assert.equal(data.companies.length, PAGE_SIZE_DEFAULT);
  assert.equal(data.pagination.hasNext, true);
  assert.equal(data.pagination.hasPrev, false);
});

test("buildCategoryPageData retorna página 2 corretamente", () => {
  const many = makeCompanies(25, "alimentacao");
  const data = buildCategoryPageData({
    categorySlug: "alimentacao",
    localityRef: "3518800",
    allCompanies: many,
    page: 2,
    pageSize: 20,
  });
  assert.equal(data.pagination.page, 2);
  assert.equal(data.companies.length, 5);
  assert.equal(data.pagination.hasPrev, true);
  assert.equal(data.pagination.hasNext, false);
});

test("buildCategoryPageData respeita PAGE_SIZE_MAX para evitar sobrecarga", () => {
  const many = makeCompanies(200, "alimentacao");
  const data = buildCategoryPageData({
    categorySlug: "alimentacao",
    localityRef: "3518800",
    allCompanies: many,
    pageSize: 9999,
  });
  assert.ok(data.companies.length <= PAGE_SIZE_MAX);
});

test("buildCategoryPageData inclui campos de proveniência de dados", () => {
  const data = buildCategoryPageData({
    categorySlug: "beleza",
    localityRef: "3518800",
    allCompanies: SAMPLE_COMPANIES,
  });
  assert.equal(data.source, "OpenStreetMap");
  assert.equal(data.sourceLicense, "ODbL 1.0");
  assert.ok(data.sourceAttribution.length > 0);
  assert.match(data.generatedAt, /^\d{4}-\d{2}-\d{2}$/);
});

test("buildCategoryPageData gera title e metaDescription com nome real da cidade", () => {
  const data = buildCategoryPageData({
    categorySlug: "tecnologia",
    localityRef: "3518800",
    allCompanies: SAMPLE_COMPANIES,
  });
  assert.ok(data.title.includes("Guarulhos"));
  assert.ok(data.metaDescription.includes("Guarulhos"));
});

test("buildCategoryPageData com objeto de localidade funciona sem ID string", () => {
  const data = buildCategoryPageData({
    categorySlug: "alimentacao",
    localityRef: guarulhos,
    allCompanies: SAMPLE_COMPANIES,
  });
  assert.equal(data.locality.municipalityId, "3518800");
  assert.equal(data.categorySlug, "alimentacao");
});

test("buildCategoryPageData rejeita localityRef inválido", () => {
  assert.throws(
    () =>
      buildCategoryPageData({
        categorySlug: "alimentacao",
        localityRef: null,
        allCompanies: SAMPLE_COMPANIES,
      }),
    TypeError
  );
});

test("buildCategoryPageData rejeita categorySlug vazio", () => {
  assert.throws(
    () =>
      buildCategoryPageData({
        categorySlug: "",
        localityRef: "3518800",
        allCompanies: SAMPLE_COMPANIES,
      }),
    Error
  );
});

test("buildCategoryPageData rejeita allCompanies não-array", () => {
  assert.throws(
    () =>
      buildCategoryPageData({
        categorySlug: "alimentacao",
        localityRef: "3518800",
        allCompanies: "not-an-array",
      }),
    TypeError
  );
});

/* ── API handler ── */
test("api/category handler GET retorna 200 com estrutura completa", async () => {
  const { buildCategoryPageData: real } = require("../lib/category_page");
  const handler = require("../api/category");

  const req = { method: "GET", query: { municipalityId: "3518800", categorySlug: "alimentacao" } };
  let statusCode = null;
  let responseBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { responseBody = body; return this; },
  };

  await handler(req, res);
  assert.equal(statusCode, 200);
  assert.ok(responseBody.categorySlug);
  assert.ok(Array.isArray(responseBody.schemas));
  assert.ok(responseBody.pagination);
});

test("api/category handler GET retorna 400 sem categorySlug", async () => {
  const handler = require("../api/category");
  const req = { method: "GET", query: { municipalityId: "3518800" } };
  let statusCode = null;
  const res = { status(c) { statusCode = c; return this; }, json() { return this; } };

  await handler(req, res);
  assert.equal(statusCode, 400);
});

test("api/category handler GET retorna 404 para localidade inexistente", async () => {
  const handler = require("../api/category");
  const req = { method: "GET", query: { municipalityId: "0000001", categorySlug: "alimentacao" } };
  let statusCode = null;
  const res = { status(c) { statusCode = c; return this; }, json() { return this; } };

  await handler(req, res);
  assert.equal(statusCode, 404);
});

test("api/category handler POST retorna 405 Method Not Allowed", async () => {
  const handler = require("../api/category");
  const req = { method: "POST", query: {} };
  let statusCode = null;
  const res = { status(c) { statusCode = c; return this; }, json() { return this; } };

  await handler(req, res);
  assert.equal(statusCode, 405);
});
