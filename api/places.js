"use strict";

/**
 * api/places.js
 *
 * Endpoint server-side para busca de locais e empresas em âmbito nacional.
 * - Suporta parâmetro de localidade nacional (`municipalityId` ou `stateSlug` + `municipalitySlug`).
 * - Utiliza a cidade-piloto (Guarulhos / IBGE 3518800) como padrão para compatibilidade regressiva.
 * - Consulta primeiramente o catálogo persistente nacional (`lib/company_store.js`).
 * - Se o catálogo estiver vazio para a localidade, realiza consulta sob demanda ao OpenStreetMap (Overpass API)
 *   com a delimitação administrativa da localidade selecionada via `lib/osm_importer.js`.
 * - Conformidade estrita: licença ODbL 1.0, proveniência transparente e aviso de cobertura limitada.
 */

const { getLocalityByMunicipalityId, getLocalityBySlug } = require("../lib/localities");
const { listCompanies } = require("../lib/company_store");
const { buildOverpassQuery, parseOsmElements, OVERPASS_DEFAULT_URL, OVERPASS_USER_AGENT } = require("../lib/osm_importer");

const fetchImpl = globalThis.fetch;

module.exports = async function handler(request, response) {
  const queryParams = request.query || {};
  const rawQuery = queryParams.query || "empresas em Guarulhos SP";
  const { municipalityId, stateSlug, municipalitySlug, categorySlug } = queryParams;

  // 1. Resolução da localidade nacional
  let locality = null;
  if (municipalityId) {
    locality = getLocalityByMunicipalityId(municipalityId);
  } else if (stateSlug && municipalitySlug) {
    locality = getLocalityBySlug(stateSlug, municipalitySlug);
  } else {
    // Padrão da implantação piloto
    locality = getLocalityByMunicipalityId("3518800");
  }

  if (!locality) {
    return response.status(404).json({
      error: "Not Found",
      message: "Localidade IBGE não encontrada ou não cadastrada no catálogo nacional",
      places: [],
    });
  }

  const needle = String(rawQuery).trim().toLowerCase();
  const isGenericQuery =
    !needle ||
    needle === "empresas em guarulhos sp" ||
    needle.startsWith("empresas em ");

  const searchParam = isGenericQuery ? undefined : needle;

  // 2. Consulta ao catálogo persistente nacional
  try {
    const stored = await listCompanies(locality.municipalityId, {
      search: searchParam,
      categorySlug,
      pageSize: 100,
    });

    if (Array.isArray(stored) && stored.length > 0) {
      const places = stored.map((c) => ({
        id: c.source_id || `osm-${c.osm_type || "node"}-${c.id}`,
        name: c.name,
        category: c.category_label || c.category || "Empresa local",
        categorySlug: c.categorySlug,
        formattedAddress:
          c.formattedAddress ||
          c.address ||
          `${locality.municipalityName} — ${locality.stateCode}`,
        phone: c.phone || "",
        whatsapp: c.whatsapp || "",
        website: c.website || "",
        lat: c.lat,
        lng: c.lng,
        source: c.source || "OpenStreetMap",
        sourceUrl: c.source_url || "https://www.openstreetmap.org/",
        source_license: c.source_license || "ODbL 1.0",
      }));

      return response.status(200).json({
        places,
        source: {
          name: "OpenStreetMap",
          url: "https://www.openstreetmap.org/",
          license: "ODbL 1.0",
        },
        locality: {
          municipalityId: locality.municipalityId,
          municipalityName: locality.municipalityName,
          stateCode: locality.stateCode,
          stateSlug: locality.stateSlug,
          municipalitySlug: locality.municipalitySlug,
        },
        query: rawQuery,
        fetchedAt: new Date().toISOString(),
        coverage:
          "dados persistentes com proveniência OpenStreetMap; não representa a totalidade das empresas",
        provider: "persistent-store",
      });
    }
  } catch (storeError) {
    // Se a consulta ao store falhar, segue para fallback Overpass
  }

  // 3. Fallback: consulta sob demanda ao Overpass com a delimitação da localidade
  try {
    const overpassQuery = buildOverpassQuery(locality, { timeout: 25 });
    const upstream = await fetchImpl(OVERPASS_DEFAULT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": OVERPASS_USER_AGENT,
      },
      body: new URLSearchParams({ data: overpassQuery }).toString(),
    });

    if (!upstream.ok) {
      throw new Error(`OpenStreetMap HTTP ${upstream.status}`);
    }

    const payload = await upstream.json();
    const rawElements = payload.elements || [];
    const normalizedCompanies = parseOsmElements(rawElements, locality);

    const filtered = normalizedCompanies.filter((place) => {
      if (isGenericQuery) return true;
      const haystack = `${place.name} ${place.category_label} ${place.formattedAddress}`.toLowerCase();
      return haystack.includes(needle);
    });

    const places = filtered.slice(0, 100).map((c) => ({
      id: c.source_id,
      name: c.name,
      category: c.category_label,
      categorySlug: c.categorySlug,
      formattedAddress: c.formattedAddress,
      phone: c.phone || "",
      whatsapp: c.whatsapp || "",
      website: c.website || "",
      lat: c.lat,
      lng: c.lng,
      source: "OpenStreetMap",
      sourceUrl: c.source_url,
      source_license: "ODbL 1.0",
    }));

    return response.status(200).json({
      places,
      source: {
        name: "OpenStreetMap",
        url: "https://www.openstreetmap.org/",
        license: "ODbL 1.0",
      },
      locality: {
        municipalityId: locality.municipalityId,
        municipalityName: locality.municipalityName,
        stateCode: locality.stateCode,
        stateSlug: locality.stateSlug,
        municipalitySlug: locality.municipalitySlug,
      },
      query: rawQuery,
      fetchedAt: new Date().toISOString(),
      coverage:
        "objetos públicos mapeados no OSM; não representa todas as empresas",
      provider: "overpass-live",
    });
  } catch (error) {
    return response.status(502).json({
      places: [],
      error: error.message,
      source: { name: "OpenStreetMap", license: "ODbL 1.0" },
      query: rawQuery,
    });
  }
};
