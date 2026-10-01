const test = require("node:test");
const assert = require("node:assert/strict");
const { validateAndProcessClaim } = require("../lib/claim_submission");
const claimHandler = require("../api/claim");

test("validateAndProcessClaim - processa reivindicação válida com localidade nacional IBGE", () => {
  const payload = {
    municipalityId: "3518800", // Guarulhos IBGE 7 dígitos
    companyId: "osm-node-123456",
    companyName: "CaaS Express Motofrete",
    claimantName: "Carlos Andrade",
    claimantEmail: "caasandrade@gmail.com",
    claimantPhone: "11999998888",
    claimType: "claim",
    cnpj: "27.865.757/0001-02",
    details: "Solicitação de reivindicação oficial do perfil da empresa.",
  };

  const result = validateAndProcessClaim(payload);

  assert.ok(result.id.startsWith("claim-"));
  assert.equal(result.status, "pending_verification");
  assert.equal(result.locality.municipalityId, "3518800");
  assert.equal(result.locality.municipalityName, "Guarulhos");
  assert.equal(result.locality.stateCode, "SP");
  assert.equal(result.company.id, "osm-node-123456");
  assert.equal(result.company.cnpj, "27865757000102");
  assert.equal(result.claimant.email, "caasandrade@gmail.com");
  assert.equal(result.claimType, "claim");
});

test("validateAndProcessClaim - rejeita payload sem municipalityId IBGE válido", () => {
  const payload = {
    municipalityId: "9999999", // IBGE inexistente
    companyId: "osm-node-123456",
    companyName: "Empresa Teste",
    claimantName: "João Silva",
    claimantEmail: "joao@example.com",
    claimType: "correction",
    details: "Solicitação de correção de endereço e telefone.",
  };

  assert.throws(() => validateAndProcessClaim(payload), {
    name: "Error",
    message: /Município IBGE inválido ou não cadastrado/,
  });
});

test("validateAndProcessClaim - rejeita CNPJ com dígitos verificadores inválidos", () => {
  const payload = {
    municipalityId: "3518800",
    companyId: "osm-node-1",
    companyName: "Empresa Teste",
    claimantName: "Ana Silva",
    claimantEmail: "ana@example.com",
    claimType: "claim",
    cnpj: "27865757000103",
    details: "Solicitação de reivindicação com CNPJ inválido.",
  };

  assert.throws(() => validateAndProcessClaim(payload), {
    name: "Error",
    message: /CNPJ inválido/,
  });
});


test("validateAndProcessClaim - rejeita e-mail inválido ou detalhes curtos", () => {
  const payloadBadEmail = {
    municipalityId: "3518800",
    companyId: "osm-node-1",
    companyName: "Empresa Teste",
    claimantName: "Ana",
    claimantEmail: "email-invalido",
    claimType: "claim",
    details: "Descrições longas o suficiente aqui.",
  };

  assert.throws(() => validateAndProcessClaim(payloadBadEmail), {
    name: "Error",
    message: /claimantEmail deve ser um e-mail válido/,
  });

  const payloadShortDetails = {
    municipalityId: "3518800",
    companyId: "osm-node-1",
    companyName: "Empresa Teste",
    claimantName: "Ana Silva",
    claimantEmail: "ana@example.com",
    claimType: "claim",
    details: "curto",
  };

  assert.throws(() => validateAndProcessClaim(payloadShortDetails), {
    name: "Error",
    message: /details deve ter pelo menos 10 caracteres/,
  });
});

test("validateAndProcessClaim - rejeita campos longos e telefone com formato inválido", () => {
  const base = {
    municipalityId: "3518800",
    companyId: "osm-node-1",
    companyName: "Empresa Teste",
    claimantName: "Ana Silva",
    claimantEmail: "ana@example.com",
    claimType: "claim",
    details: "Descrição válida para a solicitação.",
  };

  assert.throws(() => validateAndProcessClaim({ ...base, details: "x".repeat(4001) }), /details excede o limite de 4000/);
  assert.throws(() => validateAndProcessClaim({ ...base, claimantPhone: "telefone inválido!" }), /claimantPhone deve conter/);
});
test("api/claim handler - método POST retorna 201 e JSON estruturado", async () => {
  const req = {
    method: "POST",
    body: {
      municipalityId: "3518800",
      companyId: "osm-node-999",
      companyName: "Padaria Modelo",
      claimantName: "Maria Oliveira",
      claimantEmail: "maria@padaria.com",
      claimType: "correction",
      details: "Atualização dos horários de atendimento da empresa.",
    },
  };

  let responseStatus = null;
  let responseData = null;

  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    setHeader() {},
  };

  await claimHandler(req, res);

  assert.equal(responseStatus, 201);
  assert.equal(responseData.success, true);
  assert.equal(responseData.claim.locality.municipalityName, "Guarulhos");
  assert.equal(responseData.claim.claimType, "correction");
});

test("api/claim handler - método GET retorna 405 Method Not Allowed", async () => {
  let allowHeader = null;
  let responseStatus = null;
  let responseData = null;

  const req = { method: "GET" };
  const res = {
    setHeader(key, value) {
      if (key === "Allow") allowHeader = value;
    },
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  await claimHandler(req, res);

  assert.equal(responseStatus, 405);
  assert.deepEqual(allowHeader, ["POST"]);
  assert.equal(responseData.error, "Method Not Allowed");
});
