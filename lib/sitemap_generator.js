/**
 * sitemap_generator.js
 *
 * Gera sitemap XML nacional para o diretório de empresas.
 * Suporta todas as ~5.570 cidades brasileiras via IDs IBGE.
 * Não codifica "guarulhos" como constante — cidade/UF vêm dos dados.
 *
 * Rotas: /estado/cidade/categoria/empresa
 */

"use strict";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Escapa caracteres especiais de XML.
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Formata data ISO YYYY-MM-DD.
 * @param {Date} [date]
 * @returns {string}
 */
function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * Valida se um slug é seguro para URL.
 * @param {string} slug
 * @returns {boolean}
 */
function isValidSlug(slug) {
  return typeof slug === "string" && SLUG_PATTERN.test(slug);
}

/**
 * Gera entrada <url> individual.
 * @param {string} loc   URL canônica completa
 * @param {string} lastmod  Data ISO YYYY-MM-DD
 * @param {string} changefreq
 * @param {string} priority
 * @returns {string}
 */
function urlEntry(loc, lastmod, changefreq = "monthly", priority = "0.6") {
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
    `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
    `    <priority>${escapeXml(priority)}</priority>`,
    "  </url>",
  ].join("\n");
}

/**
 * Gera sitemap XML completo dado lista de empresas e localidades.
 *
 * @param {Object} options
 * @param {string}   options.baseUrl        URL base do site (sem barra final)
 * @param {Array}    options.companies       Array de objetos de empresa
 * @param {Array}    options.localities      Array de localidades (estrutura localities.json)
 * @param {string}  [options.lastmod]        Data de geração (padrão: hoje)
 * @param {number}  [options.maxEntries]     Limite de entradas (padrão: 50000 — limite sitemaps)
 * @returns {{ xml: string, stats: Object }}
 */
function generateSitemap({
  baseUrl,
  companies,
  localities,
  lastmod,
  maxEntries = 50000,
}) {
  if (typeof baseUrl !== "string" || !baseUrl.startsWith("http")) {
    throw new TypeError("baseUrl deve ser uma URL válida");
  }
  if (!Array.isArray(companies)) {
    throw new TypeError("companies deve ser um array");
  }
  if (!Array.isArray(localities)) {
    throw new TypeError("localities deve ser um array");
  }

  const cleanBase = baseUrl.replace(/\/$/, "");
  const today = lastmod || isoDate();

  // Índice de localidades por municipalityId para lookup O(1)
  const localityMap = new Map(
    localities.map((loc) => [loc.municipalityId, loc])
  );

  const urls = [];
  const stats = {
    total: 0,
    skipped: 0,
    categories: new Set(),
    municipalities: new Set(),
  };

  // 1. Homepage
  urls.push(urlEntry(`${cleanBase}/`, today, "daily", "1.0"));

  // 2. Página de categoria por localidade (dedupada)
  const categoryPages = new Set();
  for (const company of companies) {
    const ibge = company.ibge;
    const locality = localityMap.get(ibge);
    if (!locality) continue;

    const catSlug = company.category;
    if (!isValidSlug(catSlug)) continue;

    const categoryKey = `${locality.stateSlug}/${locality.municipalitySlug}/${catSlug}`;
    if (!categoryPages.has(categoryKey)) {
      categoryPages.add(categoryKey);
      stats.categories.add(catSlug);
      stats.municipalities.add(ibge);
      urls.push(
        urlEntry(`${cleanBase}/${categoryKey}`, today, "weekly", "0.7")
      );
    }
  }

  // 3. Página individual por empresa
  for (const company of companies) {
    if (urls.length >= maxEntries) break;

    const ibge = company.ibge;
    const locality = localityMap.get(ibge);
    if (!locality) {
      stats.skipped++;
      continue;
    }

    const catSlug = company.category;
    if (!isValidSlug(catSlug)) {
      stats.skipped++;
      continue;
    }

    // slug da empresa: company.slug já tem o formato correto do OSM import
    const companySlug = company.slug;
    if (!isValidSlug(companySlug)) {
      stats.skipped++;
      continue;
    }

    const path = `/${locality.stateSlug}/${locality.municipalitySlug}/${catSlug}/${companySlug}`;
    urls.push(urlEntry(`${cleanBase}${path}`, today, "monthly", "0.6"));
    stats.total++;
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("\n");

  return {
    xml,
    stats: {
      urlCount: urls.length,
      companyEntries: stats.total,
      categoryPages: categoryPages.size,
      skipped: stats.skipped,
      categoriesFound: [...stats.categories].sort(),
      municipalitiesFound: [...stats.municipalities],
      generatedAt: today,
    },
  };
}

module.exports = { generateSitemap, escapeXml, isoDate, isValidSlug };
