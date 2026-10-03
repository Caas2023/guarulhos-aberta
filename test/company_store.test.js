"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getKvConfig,
  normalizeCompany,
  saveCompany,
  getCompany,
  listCompanies,
  saveCompaniesBatch,
  resetMemoryStore,
  slugify,
  sanitize,
} = require("../lib/company_store");

test.beforeEach(() => {
  resetMemoryStore();
});

test("company_store: normalizeCompany valida campos obrigatórios e sanitiza entradas", () => {
  const valid = {
    id: 12345,
    name: "Ótica <script>alert(1)</script> São Paulo",
    municipalityId: "3518800",
    category: "Óticas & Serviços",
    address: "Rua Dom Pedro, 100",
    phone: "(11) 99999-0000",
    lat: -23.46,
    lng: -46.52,
  };

  const normalized = normalizeCompany(valid);
  assert.equal(normalized.id, 12345);
  assert.equal(normalized.name, "Ótica alert(1) São Paulo");
  assert.equal(normalized.municipalityId, "3518800");
  assert.equal(normalized.ibge, "3518800");
  assert.equal(normalized.categorySlug, "oticas-servicos");
  assert.equal(normalized.slug, "otica-alert-1-sao-paulo");
  assert.equal(normalized.lat, -23.46);
  assert.equal(normalized.lng, -46.52);
  assert.equal(normalized.source, "Cadastro");
  assert.equal(normalized.source_license, "ODbL 1.0");
});

test("company_store: normalizeCompany rejeita ausência de nome", () => {
  assert.throws(
    () => normalizeCompany({ municipalityId: "3518800", id: 1 }),
    (err) => err.code === "INVALID_COMPANY_DATA" && /Nome/.test(err.message)
  );
});

test("company_store: normalizeCompany rejeita código IBGE inválido", () => {
  assert.throws(
    () => normalizeCompany({ name: "Empresa Teste", municipalityId: "123", id: 1 }),
    (err) => err.code === "INVALID_COMPANY_DATA" && /IBGE/.test(err.message)
  );
  assert.throws(
    () => normalizeCompany({ name: "Empresa Teste", municipalityId: "abcdefg", id: 1 }),
    (err) => err.code === "INVALID_COMPANY_DATA" && /IBGE/.test(err.message)
  );
});

test("company_store: getKvConfig lê variáveis de ambiente ou retorna null", () => {
  assert.equal(getKvConfig({}), null);
  assert.deepEqual(
    getKvConfig({ KV_REST_API_URL: "https://kv.example.com/", KV_REST_API_TOKEN: "tok_123" }),
    { url: "https://kv.example.com", token: "tok_123" }
  );
});

test("company_store: saveCompany grava em Vercel KV usando pipeline sem expor token", async () => {
  let capturedRequest = null;
  const mockFetch = async (url, options) => {
    capturedRequest = { url, options };
    return { ok: true, status: 200, json: async () => [{ result: "OK" }] };
  };

  const fakeEnv = {
    KV_REST_API_URL: "https://kv.test.internal",
    KV_REST_API_TOKEN: "secret-token-kv",
  };

  const company = {
    id: "emp-99",
    name: "Transportes Rapido",
    municipalityId: "3518800",
    category: "Logística",
  };

  const res = await saveCompany(company, fakeEnv, mockFetch);
  assert.equal(res.success, true);
  assert.equal(res.provider, "vercel-kv");
  assert.equal(capturedRequest.url, "https://kv.test.internal/pipeline");
  assert.equal(capturedRequest.options.headers.Authorization, "Bearer secret-token-kv");

  // Verifica que o token não foi inserido no corpo
  assert.equal(capturedRequest.options.body.includes("secret-token-kv"), false);

  // Verifica os comandos do pipeline
  const commands = JSON.parse(capturedRequest.options.body);
  assert.equal(commands.length, 4);
  assert.equal(commands[0][0], "SET");
  assert.equal(commands[0][1], "guarulhos-aberta:company:3518800:emp-99");
  assert.equal(commands[1][0], "SET");
  assert.equal(commands[1][1], "guarulhos-aberta:company_slug:3518800:logistica:transportes-rapido");
  assert.equal(commands[2][0], "SADD");
  assert.equal(commands[2][1], "guarulhos-aberta:companies:3518800");
  assert.equal(commands[3][0], "SADD");
  assert.equal(commands[3][1], "guarulhos-aberta:companies_by_category:3518800:logistica");
});

test("company_store: saveCompany com failClosed sem KV dispara erro classificado", async () => {
  await assert.rejects(
    () =>
      saveCompany(
        { id: 1, name: "Teste", municipalityId: "3518800" },
        {},
        async () => {},
        { failClosed: true }
      ),
    (err) => err.code === "PERSISTENCE_NOT_CONFIGURED"
  );
});

test("company_store: saveCompany trata falha HTTP no KV", async () => {
  const mockFetch = async () => ({ ok: false, status: 503 });
  const fakeEnv = { KV_REST_API_URL: "https://kv.test", KV_REST_API_TOKEN: "tok" };

  await assert.rejects(
    () =>
      saveCompany(
        { id: 1, name: "Teste", municipalityId: "3518800" },
        fakeEnv,
        mockFetch
      ),
    (err) => err.code === "PERSISTENCE_WRITE_FAILED" && /503/.test(err.message)
  );
});

test("company_store: getCompany consulta KV por slug via chave de índice e depois por ID", async () => {
  const calls = [];
  const mockFetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("company_slug")) {
      return { ok: true, status: 200, json: async () => ({ result: "emp-777" }) };
    }
    if (url.includes("emp-777")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: JSON.stringify({
            id: "emp-777",
            name: "Padaria Central",
            municipalityId: "3518800",
            category: "Alimentação",
            slug: "padaria-central",
          }),
        }),
      };
    }
    return { ok: false, status: 404 };
  };

  const fakeEnv = { KV_REST_API_URL: "https://kv.test", KV_REST_API_TOKEN: "tok" };
  const company = await getCompany(
    { municipalityId: "3518800", categorySlug: "alimentacao", slug: "padaria-central" },
    fakeEnv,
    mockFetch
  );

  assert.ok(company);
  assert.equal(company.id, "emp-777");
  assert.equal(company.name, "Padaria Central");
  assert.equal(calls.length, 2);
});

test("company_store: getCompany faz fallback para seed local da cidade piloto", async () => {
  // Consulta empresa real do seed de Guarulhos
  const company = await getCompany({ municipalityId: "3518800", slug: "maria-cereja" }, {});
  assert.ok(company);
  assert.equal(company.name, "Maria Cereja");
  assert.equal(company.municipalityId, "3518800");
  assert.equal(company.category, "Alimentação");
});

test("company_store: getCompany retorna null para empresa inexistente ou outro município", async () => {
  const notFoundGuarulhos = await getCompany(
    { municipalityId: "3518800", slug: "empresa-totalmente-inexistente-xyz" },
    {}
  );
  assert.equal(notFoundGuarulhos, null);

  const notFoundRio = await getCompany(
    { municipalityId: "3304557", slug: "maria-cereja" },
    {}
  );
  assert.equal(notFoundRio, null);
});

test("company_store: listCompanies isola dados por município e filtra por categoria", async () => {
  // Salva empresa em outro município (Rio de Janeiro / 3304557) em memória
  await saveCompany(
    {
      id: "rio-1",
      name: "Carioca Serviços",
      municipalityId: "3304557",
      category: "Serviços",
    },
    {}
  );

  // Lista Rio: deve retornar apenas a empresa do Rio, jamais Guarulhos
  const rioList = await listCompanies("3304557", {});
  assert.equal(rioList.length, 1);
  assert.equal(rioList[0].name, "Carioca Serviços");
  assert.equal(rioList[0].municipalityId, "3304557");

  // Lista município sem empresas (Campinas / 3509502): retorna vazio
  const campinasList = await listCompanies("3509502", {});
  assert.deepEqual(campinasList, []);

  // Lista Guarulhos com filtro de categoria
  const alimentacao = await listCompanies("3518800", { categorySlug: "alimentacao" });
  assert.ok(alimentacao.length > 0);
  assert.ok(alimentacao.every((c) => c.categorySlug === "alimentacao"));
});

test("company_store: listCompanies paginação funciona corretamente", async () => {
  const p1 = await listCompanies("3518800", { page: 1, pageSize: 5 });
  const p2 = await listCompanies("3518800", { page: 2, pageSize: 5 });

  assert.equal(p1.length, 5);
  assert.equal(p2.length, 5);
  assert.notEqual(p1[0].id, p2[0].id);
});

test("company_store: saveCompaniesBatch persiste lote com sucesso", async () => {
  let capturedRequest = null;
  const mockFetch = async (url, options) => {
    capturedRequest = { url, options };
    return { ok: true, status: 200, json: async () => [] };
  };

  const fakeEnv = { KV_REST_API_URL: "https://kv.batch", KV_REST_API_TOKEN: "batch-tok" };
  const batch = [
    { id: "b1", name: "Empresa Batch 1", category: "Comércio" },
    { id: "b2", name: "Empresa Batch 2", category: "Serviços" },
  ];

  const res = await saveCompaniesBatch("3518800", batch, fakeEnv, mockFetch);
  assert.equal(res.success, true);
  assert.equal(res.count, 2);
  assert.equal(res.provider, "vercel-kv");
  assert.equal(capturedRequest.url, "https://kv.batch/pipeline");
  const cmds = JSON.parse(capturedRequest.options.body);
  assert.equal(cmds.length, 8); // 4 comandos por empresa
});
