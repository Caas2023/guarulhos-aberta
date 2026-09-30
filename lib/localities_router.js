/**
 * Locality Router Utility
 * Handles national routing patterns: /estado/cidade/categoria/empresa
 * Ensures scalability for ~5,570 Brazilian cities.
 */

const localities = require("../data/localities.json");

const IBGE_STATE_ID_PATTERN = /^\d{2}$/;
const IBGE_MUNICIPALITY_ID_PATTERN = /^\d{7}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateLocality(locality) {
  if (!locality || typeof locality !== "object") {
    throw new TypeError("Localidade deve ser um objeto");
  }

  const requiredStrings = [
    "municipalityId",
    "stateId",
    "stateCode",
    "stateSlug",
    "municipalityName",
    "municipalitySlug",
  ];

  for (const field of requiredStrings) {
    if (typeof locality[field] !== "string" || !locality[field].trim()) {
      throw new TypeError(`Campo de localidade inválido: ${field}`);
    }
  }

  if (!IBGE_STATE_ID_PATTERN.test(locality.stateId)) {
    throw new TypeError("stateId deve conter 2 dígitos do IBGE");
  }
  if (!IBGE_MUNICIPALITY_ID_PATTERN.test(locality.municipalityId)) {
    throw new TypeError("municipalityId deve conter 7 dígitos do IBGE");
  }
  if (!SLUG_PATTERN.test(locality.stateSlug) || !SLUG_PATTERN.test(locality.municipalitySlug)) {
    throw new TypeError("Slugs devem usar letras minúsculas, números e hífens");
  }
  if (locality.stateCode !== locality.stateCode.toUpperCase() || locality.stateCode.length !== 2) {
    throw new TypeError("stateCode deve ser uma sigla UF com 2 letras maiúsculas");
  }

  return Object.freeze({ ...locality });
}

const validatedLocalities = Object.freeze(localities.map(validateLocality));

/**
 * Resolves a URL path into locality and category data.
 * Path format: /:stateSlug/:municipalitySlug/:category/:id
 */
function resolveRoute(path) {
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const [stateSlug, municipalitySlug, category, entityId] = segments;

  const locality = validatedLocalities.find(
    (l) => l.stateSlug === stateSlug && l.municipalitySlug === municipalitySlug
  );

  if (!locality) return null;

  return {
    locality,
    category: category || null,
    entityId: entityId || null,
    isRoot: segments.length === 2,
    isCategory: segments.length === 3,
    isEntity: segments.length === 4,
  };
}

module.exports = {
  validateLocality,
  resolveRoute,
  validatedLocalities,
};
