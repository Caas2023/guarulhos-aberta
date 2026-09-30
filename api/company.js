const { buildCompanyPageData } = require("../lib/company");
const { getLocalityBySlug, getLocalityByMunicipalityId } = require("../lib/localities");

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
  } else {
    // Default fallback to pilot municipality (Guarulhos / IBGE 3518800)
    locality = getLocalityByMunicipalityId("3518800");
  }

  if (!locality) {
    return response.status(404).json({
      error: "Not Found",
      message: "Localidade IBGE não encontrada ou não cadastrada no catálogo nacional",
    });
  }

  if (!name && !companySlug) {
    return response.status(400).json({
      error: "Bad Request",
      message: "Parâmetro 'name' ou 'companySlug' é obrigatório para consultar detalhes da empresa",
    });
  }

  try {
    const rawCompany = {
      name: name || companySlug.replace(/-/g, " "),
      slug: companySlug,
      category: category || "Empresa local",
      categorySlug: categorySlug,
      formattedAddress: address,
      id: query.id || companySlug,
    };

    const companyPageData = buildCompanyPageData(rawCompany, locality);
    return response.status(200).json(companyPageData);
  } catch (error) {
    return response.status(400).json({
      error: "Bad Request",
      message: error.message,
    });
  }
};
