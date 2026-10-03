"use strict";

/**
 * Vercel Serverless Function — Category Page API
 * GET /api/category?stateSlug=sp&municipalitySlug=guarulhos&categorySlug=alimentacao
 * GET /api/category?municipalityId=3518800&categorySlug=alimentacao
 * GET /api/category?municipalityId=3518800&categorySlug=alimentacao&page=2&pageSize=20
 *
 * Returns structured JSON for category pages with ItemList + BreadcrumbList schema.
 * Routes follow national architecture: no city name is hardcoded.
 */

const { buildCategoryPageData } = require("../lib/category_page");
const { getLocalityBySlug, getLocalityByMunicipalityId } = require("../lib/localities");
const { listCompanies } = require("../lib/company_store");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({
      error: "Method Not Allowed",
      message: "O endpoint de categorias aceita apenas requisições GET",
    });
  }

  const query = request.query || {};
  const { municipalityId, stateSlug, municipalitySlug, categorySlug, page, pageSize } = query;

  /* ── resolve locality ── */
  let locality = null;
  if (municipalityId) {
    locality = getLocalityByMunicipalityId(municipalityId);
  } else if (stateSlug && municipalitySlug) {
    locality = getLocalityBySlug(stateSlug, municipalitySlug);
  }

  if (!locality) {
    return response.status(404).json({
      error: "Not Found",
      message: "Localidade IBGE não encontrada ou não cadastrada no catálogo nacional",
    });
  }

  /* ── require category ── */
  if (!categorySlug || !categorySlug.trim()) {
    return response.status(400).json({
      error: "Bad Request",
      message: "Parâmetro 'categorySlug' é obrigatório",
    });
  }

  /* ── build and return ── */
  try {
    const companies = await listCompanies(locality.municipalityId, { categorySlug });
    const data = buildCategoryPageData({
      categorySlug,
      localityRef: locality,
      allCompanies: companies,
      page: page || 1,
      pageSize: pageSize || 20,
    });
    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};
