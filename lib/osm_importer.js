"use strict";

/**
 * lib/osm_importer.js
 *
 * Importador, normalizador e sincronizador de dados do OpenStreetMap (Overpass API).
 * Segue estritamente a arquitetura nacional:
 * - Suporta qualquer um dos ~5.570 municípios brasileiros via ID IBGE de 7 dígitos.
 * - Mapeamento canônico de categorias em português (pt-BR).
 * - Deduplicação por ID OSM e proximidade/endereço.
 * - Sanitização rigorosa de strings (proteção contra XSS e injeção).
 * - Extração e normalização de contatos (telefone, WhatsApp wa.me, website, e-mail).
 * - Formatação de endereços e CEPs nacionais (XXXXX-XXX).
 * - Rastreamento de proveniência e conformidade com a licença ODbL 1.0.
 * - Carga paginada/em lotes (batches) compatível com Vercel KV REST / Upstash e fallback local.
 */

const {
  getLocalityByMunicipalityId,
  getLocalityBySlug,
  validateLocality,
} = require("./localities");
const { saveCompaniesBatch } = require("./company_store");

const OVERPASS_DEFAULT_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_USER_AGENT = "GuarulhosAberta/1.0 (diretorio local nacional; contato@caasexpress.com)";

// Limites geográficos do território brasileiro (aproximados)
const BRAZIL_GEO_BOUNDS = {
  minLat: -34.5,
  maxLat: 6.0,
  minLng: -74.5,
  maxLng: -34.0,
};

// ─── Helpers de sanitização e formatação ───────────────────────────────────────

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

function formatPhone(raw) {
  if (!raw || typeof raw !== "string") return "";
  let digits = raw.replace(/\D/g, "");
  // Remove DDI 55 do Brasil se presente e número tiver 12 ou 13 dígitos
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  // Formato nacional com DDD (11 dígitos para celular, 10 para fixo)
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length >= 8 && digits.length <= 15) {
    return digits;
  }
  return "";
}

function formatWhatsapp(raw, rawPhone) {
  let digits = "";
  if (typeof raw === "string" && raw.trim()) {
    digits = raw.replace(/\D/g, "");
  } else if (typeof rawPhone === "string" && rawPhone.trim()) {
    const cleaned = rawPhone.replace(/\D/g, "");
    // Se for celular brasileiro (11 dígitos, nono dígito 9)
    if (cleaned.length === 11 && cleaned[2] === "9") {
      digits = cleaned;
    } else if (cleaned.length === 13 && cleaned.startsWith("55") && cleaned[4] === "9") {
      digits = cleaned.slice(2);
    }
  }

  if (!digits) return "";
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }
  if (digits.length >= 12 && digits.length <= 14) {
    return `https://wa.me/${digits}`;
  }
  return "";
}

function formatUrl(raw) {
  if (!raw || typeof raw !== "string") return "";
  let candidate = raw.trim();
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.href;
  } catch {
    return "";
  }
}

function formatEmail(raw) {
  if (!raw || typeof raw !== "string") return "";
  const cleaned = raw.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned) ? cleaned : "";
}

function formatCep(raw) {
  if (!raw || typeof raw !== "string") return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return "";
}

// ─── Mapeamento Canônico de Categorias OSM -> PT-BR ──────────────────────────

const OSM_CATEGORY_MAP = {
  // Alimentação & Gastronomia
  "amenity:restaurant": { slug: "restaurantes", label: "Restaurantes" },
  "amenity:fast_food": { slug: "alimentacao", label: "Alimentação" },
  "amenity:cafe": { slug: "alimentacao", label: "Alimentação" },
  "amenity:bar": { slug: "bares", label: "Bares" },
  "amenity:pub": { slug: "bares", label: "Bares" },
  "amenity:ice_cream": { slug: "alimentacao", label: "Alimentação" },
  "amenity:food_court": { slug: "alimentacao", label: "Alimentação" },
  "amenity:bistro": { slug: "restaurantes", label: "Restaurantes" },
  "shop:bakery": { slug: "alimentacao", label: "Alimentação" },
  "shop:pastry": { slug: "alimentacao", label: "Alimentação" },
  "shop:confectionery": { slug: "alimentacao", label: "Alimentação" },
  "shop:deli": { slug: "alimentacao", label: "Alimentação" },
  "shop:butcher": { slug: "mercados", label: "Mercados" },
  "shop:greengrocer": { slug: "mercados", label: "Mercados" },
  "shop:supermarket": { slug: "supermercados", label: "Supermercados" },
  "shop:convenience": { slug: "mercados", label: "Mercados" },
  "shop:grocery": { slug: "mercados", label: "Mercados" },

  // Saúde & Farmácias
  "amenity:pharmacy": { slug: "saude", label: "Saúde" },
  "amenity:hospital": { slug: "saude", label: "Saúde" },
  "amenity:clinic": { slug: "saude", label: "Saúde" },
  "amenity:dentist": { slug: "saude", label: "Saúde" },
  "amenity:doctors": { slug: "saude", label: "Saúde" },
  "amenity:veterinary": { slug: "saude", label: "Saúde" },
  "shop:chemist": { slug: "saude", label: "Saúde" },
  "shop:optician": { slug: "saude", label: "Saúde" },
  "shop:medical_supply": { slug: "saude", label: "Saúde" },
  "healthcare:hospital": { slug: "saude", label: "Saúde" },
  "healthcare:clinic": { slug: "saude", label: "Saúde" },
  "healthcare:dentist": { slug: "saude", label: "Saúde" },
  "healthcare:pharmacy": { slug: "saude", label: "Saúde" },

  // Moda, Vestuário & Beleza
  "shop:clothes": { slug: "moda", label: "Moda" },
  "shop:shoes": { slug: "moda", label: "Moda" },
  "shop:fashion_accessories": { slug: "moda", label: "Moda" },
  "shop:jewelry": { slug: "moda", label: "Moda" },
  "shop:boutique": { slug: "moda", label: "Moda" },
  "shop:hairdresser": { slug: "beleza", label: "Beleza" },
  "shop:beauty": { slug: "beleza", label: "Beleza" },
  "shop:cosmetics": { slug: "beleza", label: "Beleza" },
  "shop:perfumery": { slug: "beleza", label: "Beleza" },

  // Tecnologia & Eletrônicos
  "shop:electronics": { slug: "tecnologia", label: "Tecnologia" },
  "shop:computer": { slug: "tecnologia", label: "Tecnologia" },
  "shop:mobile_phone": { slug: "tecnologia", label: "Tecnologia" },
  "shop:telecommunication": { slug: "tecnologia", label: "Tecnologia" },
  "office:it": { slug: "tecnologia", label: "Tecnologia" },
  "office:telecommunication": { slug: "tecnologia", label: "Tecnologia" },

  // Finanças & Bancos
  "amenity:bank": { slug: "financas", label: "Finanças" },
  "amenity:atm": { slug: "financas", label: "Finanças" },
  "amenity:bureau_de_change": { slug: "financas", label: "Finanças" },
  "amenity:money_transfer": { slug: "financas", label: "Finanças" },

  // Educação & Cursos
  "amenity:school": { slug: "educacao", label: "Educação" },
  "amenity:college": { slug: "educacao", label: "Educação" },
  "amenity:university": { slug: "educacao", label: "Educação" },
  "amenity:kindergarten": { slug: "educacao", label: "Educação" },
  "amenity:language_school": { slug: "educacao", label: "Educação" },
  "amenity:music_school": { slug: "educacao", label: "Educação" },
  "amenity:driving_school": { slug: "educacao", label: "Educação" },

  // Automóveis & Combustível
  "amenity:fuel": { slug: "postos", label: "Postos de Combustível" },
  "amenity:car_wash": { slug: "automoveis", label: "Automóveis" },
  "amenity:car_repair": { slug: "automoveis", label: "Automóveis" },
  "craft:car_repair": { slug: "automoveis", label: "Automóveis" },
  "shop:car": { slug: "automoveis", label: "Automóveis" },
  "shop:car_repair": { slug: "automoveis", label: "Automóveis" },
  "shop:car_parts": { slug: "automoveis", label: "Automóveis" },
  "shop:motorcycle": { slug: "automoveis", label: "Automóveis" },
  "shop:tyres": { slug: "automoveis", label: "Automóveis" },

  // Serviços & Escritórios
  "amenity:post_office": { slug: "servicos", label: "Serviços" },
  "amenity:laundry": { slug: "servicos", label: "Serviços" },
  "amenity:dry_cleaning": { slug: "servicos", label: "Serviços" },
  "office:lawyer": { slug: "servicos", label: "Serviços" },
  "office:accountant": { slug: "servicos", label: "Serviços" },
  "office:estate_agent": { slug: "servicos", label: "Serviços" },
  "office:company": { slug: "servicos", label: "Serviços" },
  "office:coworking": { slug: "servicos", label: "Serviços" },
  "office:advertising_agency": { slug: "servicos", label: "Serviços" },
  "office:insurance": { slug: "servicos", label: "Serviços" },
  "craft:electrician": { slug: "servicos", label: "Serviços" },
  "craft:plumber": { slug: "servicos", label: "Serviços" },
  "craft:carpenter": { slug: "servicos", label: "Serviços" },
  "craft:locksmith": { slug: "servicos", label: "Serviços" },
  "craft:photographer": { slug: "servicos", label: "Serviços" },

  // Serviços Públicos & Governo
  "amenity:townhall": { slug: "servicos-publicos", label: "Serviços Públicos" },
  "amenity:courthouse": { slug: "servicos-publicos", label: "Serviços Públicos" },
  "amenity:police": { slug: "servicos-publicos", label: "Serviços Públicos" },
  "amenity:fire_station": { slug: "servicos-publicos", label: "Serviços Públicos" },

  // Comércio em Geral & Shopping
  "shop:mall": { slug: "shopping", label: "Shopping" },
  "shop:department_store": { slug: "shopping", label: "Shopping" },
  "shop:furniture": { slug: "comercio", label: "Comércio" },
  "shop:hardware": { slug: "comercio", label: "Comércio" },
  "shop:doityourself": { slug: "comercio", label: "Comércio" },
  "shop:florist": { slug: "comercio", label: "Comércio" },
  "shop:books": { slug: "comercio", label: "Comércio" },
  "shop:stationery": { slug: "comercio", label: "Comércio" },
  "shop:pet": { slug: "comercio", label: "Comércio" },
  "shop:variety_store": { slug: "comercio", label: "Comércio" },

  // Religião
  "amenity:place_of_worship": { slug: "religiao", label: "Religião" },

  // Esportes & Lazer
  "leisure:fitness_centre": { slug: "esportes", label: "Esportes" },
  "leisure:sports_centre": { slug: "esportes", label: "Esportes" },
  "amenity:cinema": { slug: "esportes", label: "Esportes" },
  "amenity:theatre": { slug: "esportes", label: "Esportes" },

  // Hospedagem & Turismo
  "tourism:hotel": { slug: "servicos", label: "Serviços" },
  "tourism:motel": { slug: "servicos", label: "Serviços" },
  "tourism:guest_house": { slug: "servicos", label: "Serviços" },
  "tourism:hostel": { slug: "servicos", label: "Serviços" },
};

function mapOsmCategory(tags = {}) {
  if (!tags || typeof tags !== "object") {
    return {
      slug: "outros",
      label: "Outros",
      categorySlug: "outros",
      categoryLabel: "Outros",
    };
  }

  // Chaves de interesse em ordem de prioridade
  const checkKeys = ["shop", "amenity", "office", "healthcare", "craft", "tourism", "leisure"];

  for (const key of checkKeys) {
    const val = tags[key];
    if (val && typeof val === "string") {
      const compositeKey = `${key}:${val.toLowerCase()}`;
      if (OSM_CATEGORY_MAP[compositeKey]) {
        const item = OSM_CATEGORY_MAP[compositeKey];
        return {
          slug: item.slug,
          label: item.label,
          categorySlug: item.slug,
          categoryLabel: item.label,
        };
      }
    }
  }

  // Fallback baseado no valor da tag primária
  if (tags.shop) {
    const slug = slugify(tags.shop);
    const label = sanitize(tags.shop) || "Comércio";
    return { slug: slug || "comercio", label, categorySlug: slug || "comercio", categoryLabel: label };
  }
  if (tags.amenity) {
    const slug = slugify(tags.amenity);
    const label = sanitize(tags.amenity) || "Serviços";
    return { slug: slug || "servicos", label, categorySlug: slug || "servicos", categoryLabel: label };
  }
  if (tags.office) {
    return { slug: "servicos", label: "Serviços", categorySlug: "servicos", categoryLabel: "Serviços" };
  }
  if (tags.craft) {
    return { slug: "servicos", label: "Serviços", categorySlug: "servicos", categoryLabel: "Serviços" };
  }

  return {
    slug: "outros",
    label: "Outros",
    categorySlug: "outros",
    categoryLabel: "Outros",
  };
}

// ─── Extração de Contatos e Endereço ──────────────────────────────────────────

function extractContacts(tags = {}) {
  const rawPhone =
    tags["contact:phone"] ||
    tags.phone ||
    tags["phone:mobile"] ||
    tags["contact:mobile"] ||
    "";
  const phone = formatPhone(rawPhone);

  const rawWhatsapp =
    tags["contact:whatsapp"] ||
    tags.whatsapp ||
    "";
  const whatsapp = formatWhatsapp(rawWhatsapp, rawPhone);

  const rawWebsite =
    tags["contact:website"] ||
    tags.website ||
    tags.url ||
    "";
  const website = formatUrl(rawWebsite);

  const rawEmail =
    tags["contact:email"] ||
    tags.email ||
    "";
  const email = formatEmail(rawEmail);

  return { phone, whatsapp, website, email };
}

function extractAddress(tags = {}, locality = {}) {
  const street = sanitize(tags["addr:street"] || "");
  const number = sanitize(tags["addr:housenumber"] || "");
  const neighbourhood = sanitize(
    tags["addr:suburb"] || tags["addr:neighbourhood"] || tags["addr:district"] || ""
  );
  const cep = formatCep(tags["addr:postcode"] || "");

  const streetAndNumber = [street, number].filter(Boolean).join(", ");
  const city = locality.municipalityName || sanitize(tags["addr:city"] || "");
  const state = locality.stateCode || sanitize(tags["addr:state"] || "");
  const cityState = [city, state].filter(Boolean).join(" — ");

  const parts = [streetAndNumber, neighbourhood, cityState].filter(Boolean);
  const formattedAddress = parts.join(", ") || cityState || "";

  return {
    address: streetAndNumber,
    formattedAddress,
    neighbourhood,
    cep,
  };
}

// ─── Construtor de Consultas Overpass ─────────────────────────────────────────

function resolveLocality(localityRef) {
  if (!localityRef) {
    throw new Error("Referência de localidade obrigatória");
  }

  if (typeof localityRef === "string") {
    const loc = getLocalityByMunicipalityId(localityRef);
    if (!loc) {
      throw new Error(`Município IBGE '${localityRef}' não encontrado no catálogo nacional`);
    }
    return loc;
  }

  if (typeof localityRef === "object") {
    return validateLocality(localityRef);
  }

  throw new TypeError("localityRef deve ser string com código IBGE de 7 dígitos ou objeto de localidade");
}

function buildOverpassQuery(localityRef, options = {}) {
  const locality = resolveLocality(localityRef);
  const timeout = Math.min(60, Math.max(10, parseInt(options.timeout, 10) || 30));

  let areaClause = "";
  if (Array.isArray(options.bbox) && options.bbox.length === 4) {
    // bbox: [minLat, minLng, maxLat, maxLng]
    const [minLat, minLng, maxLat, maxLng] = options.bbox;
    areaClause = `(${minLat},${minLng},${maxLat},${maxLng})`;
  } else {
    // Busca na área administrativa do município pelo nome exato
    areaClause = `(area.cityArea)`;
  }

  const areaDeclaration =
    areaClause === "(area.cityArea)"
      ? `area["name"="${locality.municipalityName}"]["boundary"="administrative"]->.cityArea;\n`
      : "";

  return `[out:json][timeout:${timeout}];
${areaDeclaration}(
  nwr["shop"]${areaClause};
  nwr["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|bistro|pharmacy|hospital|clinic|dentist|doctors|veterinary|bank|atm|school|college|university|fuel|car_wash|post_office|laundry|dry_cleaning|hairdresser|cinema|theatre"]${areaClause};
  nwr["office"]${areaClause};
  nwr["craft"]${areaClause};
  nwr["healthcare"]${areaClause};
  nwr["tourism"~"hotel|motel|guest_house|hostel"]${areaClause};
  nwr["leisure"~"fitness_centre|sports_centre"]${areaClause};
);
out center tags;`;
}

// ─── Normalização de Elemento OSM ─────────────────────────────────────────────

function normalizeOsmElement(element, localityRef) {
  if (!element || typeof element !== "object") return null;

  const locality = resolveLocality(localityRef);
  const tags = element.tags || {};

  const name = sanitize(tags.name || tags["brand"] || "");
  if (!name || name.length < 2) {
    // Não indexa locais sem nome ou genéricos
    return null;
  }

  // Extrai coordenadas: node tem lat/lon direto; way e relation têm center
  let lat = null;
  let lng = null;
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    lat = element.lat;
    lng = element.lon;
  } else if (element.center && typeof element.center.lat === "number" && typeof element.center.lon === "number") {
    lat = element.center.lat;
    lng = element.center.lon;
  }

  // Validação geográfica territorial do Brasil
  if (lat !== null && lng !== null) {
    if (
      lat < BRAZIL_GEO_BOUNDS.minLat ||
      lat > BRAZIL_GEO_BOUNDS.maxLat ||
      lng < BRAZIL_GEO_BOUNDS.minLng ||
      lng > BRAZIL_GEO_BOUNDS.maxLng
    ) {
      lat = null;
      lng = null;
    }
  }

  const { categorySlug, categoryLabel } = mapOsmCategory(tags);
  const contacts = extractContacts(tags);
  const addressInfo = extractAddress(tags, locality);

  const rawId = element.id !== undefined ? String(element.id) : "";
  const osmType = element.type || "node";
  const sourceId = `osm-${osmType}-${rawId}`;
  const id = !isNaN(Number(rawId)) ? Number(rawId) : rawId;

  return {
    id,
    source_id: sourceId,
    osm_type: osmType,
    name,
    slug: slugify(name),
    category: categorySlug,
    category_label: categoryLabel,
    categorySlug,
    address: addressInfo.address,
    formattedAddress: addressInfo.formattedAddress,
    neighbourhood: addressInfo.neighbourhood,
    city: locality.municipalityName,
    state: locality.stateCode,
    cep: addressInfo.cep,
    lat,
    lng,
    phone: contacts.phone,
    whatsapp: contacts.whatsapp,
    website: contacts.website,
    email: contacts.email,
    ibge: locality.municipalityId,
    municipalityId: locality.municipalityId,
    source: "OpenStreetMap",
    source_license: "ODbL 1.0",
    source_url: `https://www.openstreetmap.org/${osmType}/${rawId}`,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Deduplicação e Garantia de Unicidade ──────────────────────────────────────

function deduplicateCompanies(companies = []) {
  if (!Array.isArray(companies)) return [];

  const seenIds = new Set();
  const seenSpatial = new Map();
  const result = [];

  for (const company of companies) {
    if (!company || !company.id) continue;

    // 1. Chave primária por ID OSM único
    const idKey = `${company.osm_type || "node"}:${company.id}`;
    if (seenIds.has(idKey)) {
      continue;
    }
    seenIds.add(idKey);

    // 2. Chave composta por nome + coordenadas aproximadas (resolução ~20 metros: 0.0002 graus)
    let isSpatialDuplicate = false;
    if (company.lat !== null && company.lng !== null) {
      const latGrid = Math.round(company.lat * 5000);
      const lngGrid = Math.round(company.lng * 5000);
      const spatialKey = `${company.slug}:${latGrid}:${lngGrid}`;

      if (seenSpatial.has(spatialKey)) {
        // Já existe um elemento com mesmo nome nessa coordenada exata (ex.: node e way sobrepostos)
        const existing = seenSpatial.get(spatialKey);
        // Funde contatos se o registro existente não os tinha
        if (!existing.phone && company.phone) existing.phone = company.phone;
        if (!existing.whatsapp && company.whatsapp) existing.whatsapp = company.whatsapp;
        if (!existing.website && company.website) existing.website = company.website;
        if (!existing.address && company.address) existing.address = company.address;
        isSpatialDuplicate = true;
      } else {
        seenSpatial.set(spatialKey, company);
      }
    }

    if (!isSpatialDuplicate) {
      result.push(company);
    }
  }

  return result;
}

function parseOsmElements(elements = [], localityRef) {
  if (!Array.isArray(elements)) return [];

  const locality = resolveLocality(localityRef);
  const normalized = [];

  for (const el of elements) {
    const item = normalizeOsmElement(el, locality);
    if (item) {
      normalized.push(item);
    }
  }

  const deduplicated = deduplicateCompanies(normalized);

  // Garante slugs estritamente únicos dentro do município
  const slugCounts = new Map();
  for (const comp of deduplicated) {
    const baseSlug = comp.slug;
    const count = (slugCounts.get(baseSlug) || 0) + 1;
    slugCounts.set(baseSlug, count);

    if (count > 1) {
      // Diferencia por sufixo de ID numérico ou bairro
      comp.slug = `${baseSlug}-${comp.id}`;
    }
  }

  return deduplicated;
}

// ─── Busca Remota na Overpass API ─────────────────────────────────────────────

async function fetchOsmData(localityRef, options = {}) {
  const locality = resolveLocality(localityRef);
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch não disponível no runtime para consultar Overpass API");
  }

  const query = buildOverpassQuery(locality, options);
  const endpoint = options.overpassUrl || OVERPASS_DEFAULT_URL;

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": options.userAgent || OVERPASS_USER_AGENT,
    },
    body: new URLSearchParams({ data: query }).toString(),
  });

  if (!response.ok) {
    const err = new Error(`Overpass API HTTP ${response.status}: ${response.statusText}`);
    err.status = response.status;
    throw err;
  }

  const payload = await response.json();
  return Array.isArray(payload.elements) ? payload.elements : [];
}

// ─── Sincronização em Lote (Sync Pipeline) ────────────────────────────────────

async function syncOsmData(localityRef, options = {}) {
  const locality = resolveLocality(localityRef);
  const startTime = Date.now();

  let elements = [];
  if (Array.isArray(options.elements)) {
    elements = options.elements;
  } else {
    elements = await fetchOsmData(locality, options);
  }

  const totalElementsFetched = elements.length;
  const companies = parseOsmElements(elements, locality);
  const validCompanies = companies.length;
  const duplicatesRemoved = totalElementsFetched - validCompanies;

  // Estatísticas por categoria
  const categoriesCount = {};
  for (const c of companies) {
    categoriesCount[c.category] = (categoriesCount[c.category] || 0) + 1;
  }

  const batchSize = Math.max(1, Math.min(200, parseInt(options.batchSize, 10) || 50));
  let savedCount = 0;
  let batchesCount = 0;

  if (!options.dryRun && companies.length > 0) {
    const env = options.env || process.env;
    const fetchImpl = options.fetchImpl || globalThis.fetch;

    for (let i = 0; i < companies.length; i += batchSize) {
      const chunk = companies.slice(i, i + batchSize);
      await saveCompaniesBatch(locality.municipalityId, chunk, env, fetchImpl);
      savedCount += chunk.length;
      batchesCount += 1;
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    municipalityId: locality.municipalityId,
    municipalityName: locality.municipalityName,
    stateCode: locality.stateCode,
    totalElementsFetched,
    validCompanies,
    duplicatesRemoved,
    batchesCount,
    savedCount,
    categoriesCount,
    dryRun: !!options.dryRun,
    durationMs,
    companies: options.returnCompanies ? companies : undefined,
  };
}

module.exports = {
  sanitize,
  slugify,
  formatPhone,
  formatWhatsapp,
  formatUrl,
  formatEmail,
  formatCep,
  mapOsmCategory,
  extractContacts,
  extractAddress,
  resolveLocality,
  buildOverpassQuery,
  normalizeOsmElement,
  deduplicateCompanies,
  parseOsmElements,
  fetchOsmData,
  syncOsmData,
  OSM_CATEGORY_MAP,
  OVERPASS_DEFAULT_URL,
  OVERPASS_USER_AGENT,
};
