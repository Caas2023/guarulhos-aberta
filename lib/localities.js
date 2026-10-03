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
const localitiesByMunicipalityId = new Map(
  validatedLocalities.map((locality) => [locality.municipalityId, locality]),
);

function getLocalityByMunicipalityId(municipalityId) {
  if (typeof municipalityId !== "string" || !IBGE_MUNICIPALITY_ID_PATTERN.test(municipalityId)) {
    return null;
  }
  return localitiesByMunicipalityId.get(municipalityId) || null;
}

function getLocalityBySlug(stateSlug, municipalitySlug) {
  if (typeof stateSlug !== "string" || typeof municipalitySlug !== "string") {
    return null;
  }
  const cleanState = stateSlug.trim().toLowerCase();
  const cleanMuni = municipalitySlug.trim().toLowerCase();
  for (const locality of validatedLocalities) {
    if (locality.stateSlug === cleanState && locality.municipalitySlug === cleanMuni) {
      return locality;
    }
  }
  return null;
}

function getLocalityPath(locality, categorySlug, businessSlug) {
  const validated = validateLocality(locality);
  const segments = [validated.stateSlug, validated.municipalitySlug];

  if (businessSlug !== undefined && categorySlug === undefined) {
    throw new TypeError("businessSlug exige categorySlug");
  }

  for (const optionalSlug of [categorySlug, businessSlug]) {
    if (optionalSlug === undefined) continue;
    if (typeof optionalSlug !== "string" || !SLUG_PATTERN.test(optionalSlug)) {
      throw new TypeError("Segmento de rota inválido");
    }
    segments.push(optionalSlug);
  }

  return `/${segments.join("/")}`;
}

module.exports = {
  getLocalityByMunicipalityId,
  getLocalityBySlug,
  getLocalityPath,
  localities: validatedLocalities,
  validateLocality,
};
