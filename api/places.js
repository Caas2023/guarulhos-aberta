const fetchImpl = globalThis.fetch;

module.exports = async function handler(request, response) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const query = request.query?.query || "empresas em Guarulhos SP";
  if (!key) {
    return response.status(503).json({ error: "GOOGLE_MAPS_API_KEY não configurada", places: [] });
  }
  try {
    const upstream = await fetchImpl("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.primaryType,places.primaryTypeDisplayName,places.id",
      },
      body: JSON.stringify({
        textQuery: `${query}, Guarulhos, SP`,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: 20,
      }),
    });
    const payload = await upstream.json();
    return response.status(upstream.status).json(payload);
  } catch (error) {
    return response.status(502).json({ error: error.message, places: [] });
  }
};
