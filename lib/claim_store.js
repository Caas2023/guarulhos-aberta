const CLAIM_KEY_PREFIX = "guarulhos-aberta:claim:";

function getKvConfig(env = process.env) {
  const url = env.KV_REST_API_URL;
  const token = env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function persistClaim(claim, env = process.env, fetchImpl = globalThis.fetch) {
  const config = getKvConfig(env);
  if (!config) {
    const error = new Error("Persistência não configurada: defina KV_REST_API_URL e KV_REST_API_TOKEN");
    error.code = "PERSISTENCE_NOT_CONFIGURED";
    throw error;
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("Runtime sem suporte a fetch para persistência KV");
  }

  const key = `${CLAIM_KEY_PREFIX}${claim.id}`;
  const response = await fetchImpl(`${config.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(claim)),
  });

  if (!response.ok) {
    const error = new Error(`Falha na persistência KV (HTTP ${response.status})`);
    error.code = "PERSISTENCE_WRITE_FAILED";
    throw error;
  }

  return { key, provider: "vercel-kv" };
}

module.exports = { getKvConfig, persistClaim };
