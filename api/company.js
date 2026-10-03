const { buildCompanyPageData } = require("../lib/company");
const { getLocalityBySlug, getLocalityByMunicipalityId } = require("../lib/localities");
const { getCompany } = require("../lib/company_store");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({
      error: "Method Not Allowed",
      message: "O endpoint de empresas aceita apenas requisições GET",
    });
  }

  const query = request.query || {};
  const { stateSlug, municipalitySlug, municipalityId, categorySlug, companySlug, name, category, address } = query;

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

  if (!name && !companySlug && !query.id) {
    return response.status(400).json({
      error: "Bad Request",
      message: "Parâmetro 'name' ou 'companySlug' é obrigatório para consultar detalhes da empresa",
    });
  }

  try {
    let rawCompany = null;

    if (companySlug || query.id) {
      const stored = await getCompany({
        municipalityId: locality.municipalityId,
        id: query.id,
        categorySlug,
        slug: companySlug,
      });

      if (stored) {
        rawCompany = {
          id: stored.id,
          name: stored.name,
          slug: stored.slug || companySlug,
          category: stored.category_label || stored.category || category || "Empresa local",
          categorySlug: stored.categorySlug || categorySlug,
          formattedAddress: stored.formattedAddress || stored.address || address,
          phone: stored.phone,
          whatsapp: stored.whatsapp,
          website: stored.website,
          lat: stored.lat,
          lon: stored.lng,
          source: stored.source,
          sourceUrl: stored.sourceUrl,
        };
      }
    }

    if (!rawCompany) {
      if (name) {
        rawCompany = {
          name,
          slug: companySlug,
          category: category || "Empresa local",
          categorySlug: categorySlug,
          formattedAddress: address,
          id: query.id || companySlug,
        };
      } else {
        return response.status(404).json({
          error: "Not Found",
          message: `Empresa '${companySlug}' não encontrada para a localidade informada`,
        });
      }
    }

    const companyPageData = buildCompanyPageData(rawCompany, locality);
    return response.status(200).json(companyPageData);
  } catch (error) {
    return response.status(400).json({
      error: "Bad Request",
      message: error.message,
    });
  }
};
