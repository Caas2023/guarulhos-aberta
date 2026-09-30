const { getLocalityBySlug, validateLocality } = require("./localities");
const { generateLocalBusinessSchema, generateBreadcrumbSchema } = require("./schema_generator");

function slugify(text) {
  if (!text || typeof text !== "string") return "geral";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "geral";
}

function sanitize(text) {
  if (typeof text !== "string") return "";
  return text.replace(/[<>]/g, "").trim();
}

/**
 * Builds structured data for an individual company page compliant with Brazilian national architecture.
 *
 * @param {Object} rawCompany Raw company data object
 * @param {string|Object} localityRef Locality IBGE municipalityId or Locality Object
 * @param {string} baseUrl Domain base URL
 * @returns {Object} Structured company page model with route, canonical URL, and JSON-LD schemas
 */
function buildCompanyPageData(rawCompany, localityRef, baseUrl = "https://guarulhos-aberta.vercel.app") {
  if (!rawCompany || typeof rawCompany !== "object") {
    throw new TypeError("Dados da empresa devem ser um objeto válido");
  }

  const name = sanitize(rawCompany.name);
  if (!name) {
    throw new Error("Nome da empresa é obrigatório");
  }

  let locality = null;
  if (typeof localityRef === "string") {
    const { getLocalityByMunicipalityId } = require("./localities");
    locality = getLocalityByMunicipalityId(localityRef);
  } else if (localityRef && typeof localityRef === "object") {
    locality = validateLocality(localityRef);
  }

  if (!locality) {
    throw new Error("Localidade IBGE inválida ou não informada");
  }

  const rawCategory = sanitize(rawCompany.category || "Empresa local");
  const categorySlug = rawCompany.categorySlug || slugify(rawCategory);
  const rawId = sanitize(rawCompany.id || `empresa-${slugify(name)}`);
  const companySlug = rawCompany.slug || `${slugify(name)}-${rawId}`;

  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  const canonicalPath = `/${locality.stateSlug}/${locality.municipalitySlug}/${categorySlug}/${companySlug}`;
  const canonicalUrl = `${cleanBaseUrl}${canonicalPath}`;

  const company = {
    id: rawId,
    name,
    slug: companySlug,
    category: rawCategory,
    categorySlug,
    address: sanitize(rawCompany.formattedAddress || rawCompany.address || `${locality.municipalityName}, ${locality.stateCode}`),
    street: sanitize(rawCompany.street || ""),
    suburb: sanitize(rawCompany.suburb || ""),
    phone: sanitize(rawCompany.phone || ""),
    website: sanitize(rawCompany.website || ""),
    status: rawCompany.status || "Verificado",
    verification: rawCompany.verification || "Fonte Aberta / Pública",
    source: rawCompany.source || "Cadastro Guarulhos Aberta",
    sourceUrl: rawCompany.sourceUrl || canonicalUrl,
  };

  const placeForSchema = {
    name: company.name,
    categorySlug: company.categorySlug,
    slug: company.slug,
    id: company.id,
    street: company.street,
    phone: company.phone,
    website: company.website,
    lat: rawCompany.lat,
    lon: rawCompany.lon,
  };

  const localBusinessSchema = generateLocalBusinessSchema(placeForSchema, locality, cleanBaseUrl);
  const breadcrumbSchema = generateBreadcrumbSchema(
    locality,
    company.category,
    company.categorySlug,
    company.name,
    company.slug,
    cleanBaseUrl
  );

  return {
    success: true,
    canonicalPath,
    canonicalUrl,
    route: {
      stateSlug: locality.stateSlug,
      municipalitySlug: locality.municipalitySlug,
      categorySlug: company.categorySlug,
      companySlug: company.slug,
    },
    locality: {
      municipalityId: locality.municipalityId,
      municipalityName: locality.municipalityName,
      stateCode: locality.stateCode,
      stateSlug: locality.stateSlug,
    },
    company,
    schema: {
      localBusiness: localBusinessSchema,
      breadcrumbs: breadcrumbSchema,
    },
  };
}

module.exports = {
  slugify,
  buildCompanyPageData,
};
