const fetchImpl = globalThis.fetch;

module.exports = async function handler(request, response) {
  const query = request.query?.query || "empresas em Guarulhos SP";
  const overpassQuery = '[out:json][timeout:25];area["name"="Guarulhos"]["boundary"="administrative"]->.a;(nwr["name"](area.a););out center tags;';
  try {
    const upstream = await fetchImpl("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "GuarulhosAberta/0.1 (diretorio local)" },
      body: new URLSearchParams({ data: overpassQuery }),
    });
    if (!upstream.ok) throw new Error(`OpenStreetMap HTTP ${upstream.status}`);
    const payload = await upstream.json();
    const needle = String(query).toLocaleLowerCase("pt-BR");
    const places = (payload.elements || []).map((item) => {
      const tags = item.tags || {};
      const name = String(tags.name || "").replace(/[<>]/g, "").trim();
      const category = String(tags.shop || tags.amenity || tags.office || tags.tourism || tags.craft || "Empresa local");
      const address = [tags["addr:street"], tags["addr:housenumber"], tags["addr:suburb"], "Guarulhos — SP"].filter(Boolean).join(", ");
      return { name, category, formattedAddress: address || "Guarulhos — SP", id: `osm-${item.type}-${item.id}`, source: "OpenStreetMap", sourceUrl: `https://www.openstreetmap.org/${item.type}/${item.id}` };
    }).filter((place) => place.name && (!needle || needle === "empresas em guarulhos sp" || `${place.name} ${place.category} ${place.formattedAddress}`.toLocaleLowerCase("pt-BR").includes(needle))).slice(0, 100);
    return response.status(200).json({ places, source: { name: "OpenStreetMap", url: "https://www.openstreetmap.org/", license: "ODbL 1.0" }, query, fetchedAt: new Date().toISOString(), coverage: "objetos públicos mapeados no OSM; não representa todas as empresas" });
  } catch (error) {
    return response.status(502).json({ places: [], error: error.message, source: { name: "OpenStreetMap" }, query });
  }
};
