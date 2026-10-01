/**
 * Category Page Builder
 * Generates structured data and metadata for category listing pages.
 * Scalable across all ~5,570 Brazilian municipalities via IBGE IDs and slugs.
 * No city name is hardcoded — all locality data comes from validated IBGE records.
 *
 * Schema.org types produced:
 *   - ItemList  (category listing)
 *   - BreadcrumbList (breadcrumb trail)
 *
 * Routes follow national architecture: /:stateSlug/:municipalitySlug/:categorySlug
 */

"use strict";

const {
  getLocalityByMunicipalityId,
  getLocalityBySlug,
  validateLocality,
} = require("./localities");

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;

/* ─── helpers ─────────────────────────────────────────────── */

function sanitize(text) {
  if (typeof text !== "string") return "";
  return text.replace(/[<>]/g, "").trim();
}

function slugify(text) {
  if (!text || typeof text !== "string") return "geral";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "geral";
}

/**
 * Derive a human-readable category label from its slug.
 * Falls back to capitalising the slug when no known mapping exists.
 */
const CATEGORY_LABELS = {
  alimentacao: "Alimentação",
  restaurantes: "Restaurantes",
  supermercados: "Supermercados",
  mercados: "Mercados",
  saude: "Saúde",
  beleza: "Beleza",
  moda: "Moda",
  tecnologia: "Tecnologia",
  servicos: "Serviços",
  educacao: "Educação",
  esportes: "Esportes",
  financas: "Finanças",
  automoveis: "Automóveis",
  postos: "Postos de Combustível",
  transporte: "Transporte",
  religiao: "Religião",
  shopping: "Shopping",
  bares: "Bares",
  artesanato: "Artesanato",
  "servicos-publicos": "Serviços Públicos",
  outros: "Outros",
};

function categoryLabel(categorySlug) {
  if (!categorySlug) return "Empresas";
  return (
    CATEGORY_LABELS[categorySlug] ||
    categorySlug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/* ─── ItemList schema ──────────────────────────────────────── */

/**
 * Build a schema.org ItemList for a category page.
 * @param {Object[]} companies - Array of company objects from companies.json
 * @param {Object} locality    - Validated IBGE locality
 * @param {string} catSlug     - Category slug
 * @param {string} baseUrl     - Domain base URL
 * @returns {Object} JSON-LD ItemList schema
 */
function buildItemListSchema(companies, locality, catSlug, baseUrl) {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const pageUrl = `${cleanBase}/${locality.stateSlug}/${locality.municipalitySlug}/${catSlug}`;

  const listItems = companies.map((c, idx) => {
    const companySlug = c.slug || slugify(c.name);
    return {
      "@type": "ListItem",
      position: idx + 1,
      url: `${cleanBase}/${locality.stateSlug}/${locality.municipalitySlug}/${catSlug}/${companySlug}`,
      name: sanitize(c.name),
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": pageUrl,
    name: `${categoryLabel(catSlug)} em ${locality.municipalityName} (${locality.stateCode})`,
    description: `Lista de empresas de ${categoryLabel(catSlug)} em ${locality.municipalityName}, ${locality.stateCode}. Fonte: OpenStreetMap / ODbL.`,
    url: pageUrl,
    numberOfItems: companies.length,
    itemListElement: listItems,
  };
}

/* ─── BreadcrumbList schema ────────────────────────────────── */

/**
 * Build a schema.org BreadcrumbList for a category page.
 * @param {Object} locality - Validated IBGE locality
 * @param {string} catSlug  - Category slug
 * @param {string} baseUrl  - Domain base URL
 * @returns {Object} JSON-LD BreadcrumbList schema
 */
function buildCategoryBreadcrumb(locality, catSlug, baseUrl) {
  const cleanBase = baseUrl.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Início",
        item: cleanBase,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: `${locality.municipalityName} (${locality.stateCode})`,
        item: `${cleanBase}/${locality.stateSlug}/${locality.municipalitySlug}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: categoryLabel(catSlug),
        item: `${cleanBase}/${locality.stateSlug}/${locality.municipalitySlug}/${catSlug}`,
      },
    ],
  };
}

/* ─── main builder ─────────────────────────────────────────── */

/**
 * Build all structured data needed to render a category page.
 *
 * @param {Object} opts
 * @param {string} opts.categorySlug       - Category URL slug (e.g., "alimentacao")
 * @param {string|Object} opts.localityRef - IBGE municipalityId string OR raw locality object
 * @param {Object[]} opts.allCompanies     - Full companies array (filtered internally)
 * @param {number}  [opts.page]            - 1-based page number (default 1)
 * @param {number}  [opts.pageSize]        - Results per page (default 20, max 100)
 * @param {string}  [opts.baseUrl]         - Domain base URL
 * @returns {Object} Structured category page data ready for API response or SSG
 */
function buildCategoryPageData({
  categorySlug,
  localityRef,
  allCompanies,
  page = 1,
  pageSize = PAGE_SIZE_DEFAULT,
  baseUrl = "https://guarulhos-aberta.vercel.app",
}) {
  /* ── locality resolution ── */
  let locality = null;
  if (typeof localityRef === "string") {
    // Try as 7-digit IBGE municipalityId first, then as stateSlug/municipalitySlug
    locality = getLocalityByMunicipalityId(localityRef);
    if (!locality) {
      throw new Error(
        `Localidade IBGE não encontrada para municipalityId: ${localityRef}`
      );
    }
  } else if (localityRef && typeof localityRef === "object") {
    locality = validateLocality(localityRef);
  } else {
    throw new TypeError("localityRef deve ser um IBGE municipalityId ou objeto de localidade");
  }

  /* ── category validation ── */
  const catSlug = sanitize(categorySlug ? slugify(categorySlug) : "");
  if (!catSlug) {
    throw new Error("categorySlug é obrigatório");
  }

  /* ── pagination ── */
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(pageSize, 10) || PAGE_SIZE_DEFAULT));

  /* ── filter companies ── */
  if (!Array.isArray(allCompanies)) {
    throw new TypeError("allCompanies deve ser um array");
  }

  const matchedIbge = locality.municipalityId;
  const filtered = allCompanies.filter(
    (c) =>
      c &&
      (c.category === catSlug || slugify(c.category || "") === catSlug) &&
      (!c.ibge || c.ibge === matchedIbge) // keep companies without ibge field too (fallback)
  );

  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / safeSize) || 1;
  const offset = (safePage - 1) * safeSize;
  const pageCompanies = filtered.slice(offset, offset + safeSize);

  /* ── route & SEO metadata ── */
  const cleanBase = baseUrl.replace(/\/$/, "");
  const canonicalUrl = `${cleanBase}/${locality.stateSlug}/${locality.municipalitySlug}/${catSlug}`;
  const label = categoryLabel(catSlug);

  const title = `${label} em ${locality.municipalityName} — Empresas e Fornecedores`;
  const metaDescription = [
    `Encontre empresas de ${label} em ${locality.municipalityName}, ${locality.stateCode}.`,
    `${totalCount} estabelecimento${totalCount !== 1 ? "s" : ""} listado${totalCount !== 1 ? "s" : ""}.`,
    "Dados: OpenStreetMap / ODbL.",
  ].join(" ");

  /* ── schema ── */
  const itemListSchema = buildItemListSchema(pageCompanies, locality, catSlug, baseUrl);
  const breadcrumbSchema = buildCategoryBreadcrumb(locality, catSlug, baseUrl);

  return {
    /* routing */
    route: `/${locality.stateSlug}/${locality.municipalitySlug}/${catSlug}`,
    canonicalUrl,
    /* locality */
    locality: {
      municipalityId: locality.municipalityId,
      stateId: locality.stateId,
      stateCode: locality.stateCode,
      stateSlug: locality.stateSlug,
      municipalityName: locality.municipalityName,
      municipalitySlug: locality.municipalitySlug,
    },
    /* category */
    categorySlug: catSlug,
    categoryLabel: label,
    /* SEO */
    title,
    metaDescription,
    /* companies */
    companies: pageCompanies,
    pagination: {
      page: safePage,
      pageSize: safeSize,
      totalCount,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
    },
    /* schema.org */
    schemas: [itemListSchema, breadcrumbSchema],
    /* data provenance */
    source: "OpenStreetMap",
    sourceLicense: "ODbL 1.0",
    sourceAttribution: "© OpenStreetMap contributors",
    generatedAt: new Date().toISOString().slice(0, 10),
  };
}

/* ─── exports ──────────────────────────────────────────────── */

module.exports = {
  buildCategoryPageData,
  buildItemListSchema,
  buildCategoryBreadcrumb,
  categoryLabel,
  slugify,
  // Expose internals for testing without re-importing
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
};
