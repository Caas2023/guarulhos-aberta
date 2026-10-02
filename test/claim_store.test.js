const test = require("node:test");
const assert = require("node:assert/strict");
const { persistClaim, getKvConfig } = require("../lib/claim_store");

test("claim_store - exige configuração KV antes de persistir", async () => {
  await assert.rejects(
    () => persistClaim({ id: "claim-test" }, {}, async () => {}),
    (error) => error.code === "PERSISTENCE_NOT_CONFIGURED",
  );
});

test("claim_store - grava JSON no endpoint REST KV sem expor token no payload", async () => {
  let request;
  const result = await persistClaim(
    { id: "claim-test", status: "pending_verification" },
    { KV_REST_API_URL: "https://kv.example.com/", KV_REST_API_TOKEN: "secret-token" },
    async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200 };
    },
  );

  assert.deepEqual(result, { key: "guarulhos-aberta:claim:claim-test", provider: "vercel-kv" });
  assert.equal(request.url, "https://kv.example.com/set/guarulhos-aberta%3Aclaim%3Aclaim-test");
  assert.equal(request.options.headers.Authorization, "Bearer secret-token");
  assert.equal(request.options.body, JSON.stringify(JSON.stringify({ id: "claim-test", status: "pending_verification" })));
  assert.equal(request.options.body.includes("secret-token"), false);
  assert.deepEqual(getKvConfig({}), null);
});

test("claim_store - transforma falha HTTP em erro classificado", async () => {
  await assert.rejects(
    () => persistClaim({ id: "claim-test" }, { KV_REST_API_URL: "https://kv.example.com", KV_REST_API_TOKEN: "token" }, async () => ({ ok: false, status: 503 })),
    (error) => error.code === "PERSISTENCE_WRITE_FAILED" && /503/.test(error.message),
  );
});
