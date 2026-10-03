"use strict";

/**
 * lib/company_store.js
 *
 * Camada de persistência nacional para catálogo de empresas.
 * Compatível com Vercel KV / Upstash Redis REST API.
 *
 * Características:
 * - Escala nacional: particionamento por código IBGE do município (7 dígitos).
 * - Chaves estruturadas sem codificar Guarulhos como constante global.
 * - Suporta operações individuais e em lote com pipeline REST.
 * - Modo híbrido: persistência em KV quando configurado, fallback para dados locais
 *   na cidade-piloto (Guarulhos/3518800) em desenvolvimento e testes locais.
 * - Proteção de memória e sanitização estrita para segurança de dados.
 */

const fs = require("fs");
const path = require("path");

const COMPANY_KEY_PREFIX = "guarulhos-aberta:company:";
const SLUG_KEY_PREFIX = "guarulhos-aberta:company_slug:";
const MUNI_SET_PREFIX = "guarulhos-aberta:companies:";
const CAT_SET_PREFIX = "guarulhos-aberta:companies_by_category:";

// Armazenamento em memória para testes e fallback local
const memoryCompanies = new Map();
const memorySlugs = new Map();
const memoryMuniSets = new Map();
const memoryCatSets = new Map();

let cachedSeedCompanies = null;

function sanitize(text) {
  if (typeof text !== "string") return "";
  return text.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim();
}

function slugify(text) {
  if (!text || typeof text !== "string") return "geral";
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "geral"
  );
}

function getKvConfig(env = process.env) {
  const url = env.KV_REST_API_URL;
  const token = env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

function normalizeCompany(raw) {
  if (!raw || typeof raw !== "object") {
    const err = new TypeError("Dados da empresa devem ser um objeto válido");
    err.code = "INVALID_COMPANY_DATA";
    throw err;
  }

  const name = sanitize(raw.name);
  if (!name) {
    const err = new Error("Nome da empresa é obrigatório");
    err.code = "INVALID_COMPANY_DATA";
    throw err;
  }

  const municipalityId = String(raw.ibge || raw.municipalityId || "").trim();
  if (!municipalityId || !/^\d{7}$/.test(municipalityId)) {
    const err = new Error("Código IBGE do município inválido (deve conter 7 dígitos)");
    err.code = "INVALID_COMPANY_DATA";
    throw err;
  }

  const rawId = raw.id !== undefined && raw.id !== null ? String(raw.id).trim() : slugify(name);
  if (!rawId) {
    const err = new Error("ID da empresa é obrigatório");
    err.code = "INVALID_COMPANY_DATA";
    throw err;
  }

  const id = isNaN(Number(rawId)) ? rawId : Number(rawId);
  const rawCat = raw.category_label || raw.category || "Empresa local";
  const category = sanitize(rawCat);
  const categorySlug = raw.categorySlug || slugify(raw.category || rawCat);
  const slug = raw.slug || slugify(name);

  return {
    id,
    name,
    slug,
    category,
    categorySlug,
    category_label: category,
    address: sanitize(raw.address || raw.formattedAddress || ""),
    formattedAddress: sanitize(raw.formattedAddress || raw.address || ""),
    neighbourhood: sanitize(raw.neighbourhood || ""),
    city: sanitize(raw.city || ""),
    state: sanitize(raw.state || ""),
    cep: sanitize(raw.cep || ""),
    phone: sanitize(raw.phone || ""),
    whatsapp: sanitize(raw.whatsapp || ""),
    website: sanitize(raw.website || ""),
    email: sanitize(raw.email || ""),
    ibge: municipalityId,
    municipalityId,
    lat:
      raw.lat !== undefined && raw.lat !== null && !isNaN(Number(raw.lat))
        ? Number(raw.lat)
        : null,
    lng:
      raw.lng !== undefined && raw.lng !== null && !isNaN(Number(raw.lng))
        ? Number(raw.lng)
        : raw.lon !== undefined && raw.lon !== null && !isNaN(Number(raw.lon))
        ? Number(raw.lon)
        : null,
    source: sanitize(raw.source || "Cadastro"),
    source_license: sanitize(raw.source_license || raw.sourceLicense || "ODbL 1.0"),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

function loadPilotSeed() {
  if (cachedSeedCompanies) return cachedSeedCompanies;
  try {
    const seedPath = path.resolve(__dirname, "..", "data", "companies.json");
    if (fs.existsSync(seedPath)) {
      const data = JSON.parse(fs.readFileSync(seedPath, "utf8"));
      cachedSeedCompanies = Array.isArray(data) ? data : [];
      return cachedSeedCompanies;
    }
  } catch {
    // fallback caso arquivo não esteja disponível
  }
  return [];
}

async function saveCompany(
  companyData,
  env = process.env,
  fetchImpl = globalThis.fetch,
  options = {}
) {
  const company = normalizeCompany(companyData);
  const config = getKvConfig(env);

  if (!config) {
    if (options.failClosed) {
      const error = new Error("Persistência KV não configurada");
      error.code = "PERSISTENCE_NOT_CONFIGURED";
      throw error;
    }

    // Grava na memória para fallback/testes
    const compKey = `${COMPANY_KEY_PREFIX}${company.municipalityId}:${company.id}`;
    const slugKey = `${SLUG_KEY_PREFIX}${company.municipalityId}:${company.categorySlug}:${company.slug}`;
    memoryCompanies.set(compKey, company);
    memorySlugs.set(slugKey, company.id);

    if (!memoryMuniSets.has(company.municipalityId)) {
      memoryMuniSets.set(company.municipalityId, new Set());
    }
    memoryMuniSets.get(company.municipalityId).add(company.id);

    const catKey = `${company.municipalityId}:${company.categorySlug}`;
    if (!memoryCatSets.has(catKey)) {
      memoryCatSets.set(catKey, new Set());
    }
    memoryCatSets.get(catKey).add(company.id);

    return {
      success: true,
      id: company.id,
      municipalityId: company.municipalityId,
      provider: "memory-fallback",
    };
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("Runtime sem suporte a fetch para persistência KV");
  }

  const compKey = `${COMPANY_KEY_PREFIX}${company.municipalityId}:${company.id}`;
  const slugKey = `${SLUG_KEY_PREFIX}${company.municipalityId}:${company.categorySlug}:${company.slug}`;
  const muniKey = `${MUNI_SET_PREFIX}${company.municipalityId}`;
  const catKey = `${CAT_SET_PREFIX}${company.municipalityId}:${company.categorySlug}`;

  const commands = [
    ["SET", compKey, JSON.stringify(company)],
    ["SET", slugKey, String(company.id)],
    ["SADD", muniKey, String(company.id)],
    ["SADD", catKey, String(company.id)],
  ];

  const response = await fetchImpl(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const error = new Error(`Falha na persistência KV (HTTP ${response.status})`);
    error.code = "PERSISTENCE_WRITE_FAILED";
    throw error;
  }

  return {
    success: true,
    id: company.id,
    municipalityId: company.municipalityId,
    provider: "vercel-kv",
  };
}

async function getCompany(lookup, env = process.env, fetchImpl = globalThis.fetch) {
  if (!lookup || typeof lookup !== "object") {
    throw new TypeError("Parâmetro de consulta deve ser um objeto");
  }

  const municipalityId = String(lookup.municipalityId || "").trim();
  if (!municipalityId || !/^\d{7}$/.test(municipalityId)) {
    throw new Error("Código IBGE do município inválido ou ausente");
  }

  const id = lookup.id !== undefined && lookup.id !== null ? String(lookup.id).trim() : null;
  const slug = lookup.slug || lookup.companySlug ? String(lookup.slug || lookup.companySlug).trim() : null;
  const categorySlug = lookup.categorySlug ? String(lookup.categorySlug).trim() : null;

  if (!id && !slug) {
    throw new Error("É necessário informar 'id' ou 'slug' para buscar a empresa");
  }

  const config = getKvConfig(env);

  // 1. Consulta via Vercel KV se configurado
  if (config && typeof fetchImpl === "function") {
    let targetId = id;

    // Se temos apenas slug, resolvemos ID via chave de índice
    if (!targetId && slug && categorySlug) {
      const slugKey = `${SLUG_KEY_PREFIX}${municipalityId}:${categorySlug}:${slug}`;
      const slugRes = await fetchImpl(`${config.url}/get/${encodeURIComponent(slugKey)}`, {
        headers: { Authorization: `Bearer ${config.token}` },
      });
      if (!slugRes.ok) {
        const error = new Error(`Falha na leitura KV (HTTP ${slugRes.status})`);
        error.code = "PERSISTENCE_READ_FAILED";
        throw error;
      }
      const slugData = await slugRes.json();
      if (slugData && slugData.result) {
        targetId = slugData.result;
      }
    }

    if (targetId) {
      const compKey = `${COMPANY_KEY_PREFIX}${municipalityId}:${targetId}`;
      const compRes = await fetchImpl(`${config.url}/get/${encodeURIComponent(compKey)}`, {
        headers: { Authorization: `Bearer ${config.token}` },
      });
      if (!compRes.ok) {
        const error = new Error(`Falha na leitura KV (HTTP ${compRes.status})`);
        error.code = "PERSISTENCE_READ_FAILED";
        throw error;
      }
      const compData = await compRes.json();
      if (compData && compData.result) {
        const parsed =
          typeof compData.result === "string" ? JSON.parse(compData.result) : compData.result;
        return normalizeCompany(parsed);
      }
    }
  }

  // 2. Consulta no fallback em memória
  if (id) {
    const compKey = `${COMPANY_KEY_PREFIX}${municipalityId}:${id}`;
    if (memoryCompanies.has(compKey)) {
      return memoryCompanies.get(compKey);
    }
  }

  if (slug && categorySlug) {
    const slugKey = `${SLUG_KEY_PREFIX}${municipalityId}:${categorySlug}:${slug}`;
    if (memorySlugs.has(slugKey)) {
      const resolvedId = memorySlugs.get(slugKey);
      const compKey = `${COMPANY_KEY_PREFIX}${municipalityId}:${resolvedId}`;
      if (memoryCompanies.has(compKey)) {
        return memoryCompanies.get(compKey);
      }
    }
  }

  // 3. Fallback para seed local da cidade piloto (Guarulhos 3518800)
  if (municipalityId === "3518800") {
    const seed = loadPilotSeed();
    const found = seed.find((c) => {
      if (id && (String(c.id) === id || c.slug === id)) return true;
      if (slug) {
        const matchSlug = c.slug === slug || slugify(c.name) === slug;
        if (matchSlug && categorySlug) {
          return c.category === categorySlug || slugify(c.category || "") === categorySlug;
        }
        return matchSlug;
      }
      return false;
    });

    if (found) {
      return normalizeCompany({ ...found, ibge: "3518800" });
    }
  }

  return null;
}

async function listCompanies(
  municipalityId,
  options = {},
  env = process.env,
  fetchImpl = globalThis.fetch
) {
  const muniId = String(municipalityId || "").trim();
  if (!muniId || !/^\d{7}$/.test(muniId)) {
    throw new Error("Código IBGE do município inválido (deve conter 7 dígitos)");
  }

  const categorySlug = options.categorySlug ? slugify(options.categorySlug) : null;
  const search = options.search ? sanitize(options.search).toLowerCase() : null;
  const config = getKvConfig(env);

  let results = [];

  // Se KV configurado, tenta buscar membros e pipeline de empresas
  if (config && typeof fetchImpl === "function") {
    try {
      const setKey = categorySlug
        ? `${CAT_SET_PREFIX}${muniId}:${categorySlug}`
        : `${MUNI_SET_PREFIX}${muniId}`;

      const setRes = await fetchImpl(`${config.url}/smembers/${encodeURIComponent(setKey)}`, {
        headers: { Authorization: `Bearer ${config.token}` },
      });

      if (setRes.ok) {
        const setData = await setRes.json();
        const ids = Array.isArray(setData.result) ? setData.result : [];

        if (ids.length > 0) {
          const pipelineCommands = ids.map((id) => [
            "GET",
            `${COMPANY_KEY_PREFIX}${muniId}:${id}`,
          ]);

          const pipeRes = await fetchImpl(`${config.url}/pipeline`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(pipelineCommands),
          });

          if (pipeRes.ok) {
            const pipeData = await pipeRes.json();
            results = pipeData
              .map((item) => {
                if (!item || !item.result) return null;
                const parsed =
                  typeof item.result === "string" ? JSON.parse(item.result) : item.result;
                return normalizeCompany(parsed);
              })
              .filter(Boolean);
          }
        }
      }
    } catch {
      // Falha na rede KV cai para fallback
    }
  }

  // Fallback se KV vazio ou não configurado
  if (results.length === 0) {
    // 1. Memória
    const inMem = [];
    for (const [key, comp] of memoryCompanies.entries()) {
      if (comp.municipalityId === muniId) {
        inMem.push(comp);
      }
    }
    results = inMem;

    // 2. Se for cidade-piloto e sem dados em memória, carrega seed
    if (results.length === 0 && muniId === "3518800") {
      const seed = loadPilotSeed();
      results = seed.map((c) => normalizeCompany({ ...c, ibge: "3518800" }));
    }
  }

  // Filtra por categoria
  if (categorySlug) {
    results = results.filter(
      (c) => c.categorySlug === categorySlug || slugify(c.category || "") === categorySlug
    );
  }

  // Filtra por busca textual se solicitada
  if (search) {
    results = results.filter((c) => {
      const text = `${c.name} ${c.category} ${c.address} ${c.neighbourhood}`.toLowerCase();
      return text.includes(search);
    });
  }

  // Paginação opcional
  if (options.page || options.pageSize) {
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(options.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;
    return results.slice(offset, offset + pageSize);
  }

  return results;
}

async function saveCompaniesBatch(
  municipalityId,
  companiesArray,
  env = process.env,
  fetchImpl = globalThis.fetch
) {
  const muniId = String(municipalityId || "").trim();
  if (!muniId || !/^\d{7}$/.test(muniId)) {
    throw new Error("Código IBGE do município inválido (deve conter 7 dígitos)");
  }

  if (!Array.isArray(companiesArray)) {
    throw new TypeError("companiesArray deve ser uma lista de empresas");
  }

  const normalizedList = companiesArray.map((c) =>
    normalizeCompany({ ...c, municipalityId: muniId, ibge: muniId })
  );

  const config = getKvConfig(env);

  if (!config) {
    for (const company of normalizedList) {
      await saveCompany(company, env, fetchImpl, { failClosed: false });
    }
    return {
      success: true,
      count: normalizedList.length,
      provider: "memory-fallback",
    };
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("Runtime sem suporte a fetch para persistência KV");
  }

  const commands = [];
  const muniKey = `${MUNI_SET_PREFIX}${muniId}`;

  for (const company of normalizedList) {
    const compKey = `${COMPANY_KEY_PREFIX}${muniId}:${company.id}`;
    const slugKey = `${SLUG_KEY_PREFIX}${muniId}:${company.categorySlug}:${company.slug}`;
    const catKey = `${CAT_SET_PREFIX}${muniId}:${company.categorySlug}`;

    commands.push(["SET", compKey, JSON.stringify(company)]);
    commands.push(["SET", slugKey, String(company.id)]);
    commands.push(["SADD", muniKey, String(company.id)]);
    commands.push(["SADD", catKey, String(company.id)]);
  }

  const response = await fetchImpl(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const error = new Error(`Falha no pipeline batch KV (HTTP ${response.status})`);
    error.code = "PERSISTENCE_WRITE_FAILED";
    throw error;
  }

  return {
    success: true,
    count: normalizedList.length,
    provider: "vercel-kv",
  };
}

function resetMemoryStore() {
  memoryCompanies.clear();
  memorySlugs.clear();
  memoryMuniSets.clear();
  memoryCatSets.clear();
  cachedSeedCompanies = null;
}

module.exports = {
  getKvConfig,
  normalizeCompany,
  saveCompany,
  getCompany,
  listCompanies,
  saveCompaniesBatch,
  resetMemoryStore,
  slugify,
  sanitize,
};
