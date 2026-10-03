"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  sanitize,
  slugify,
  formatPhone,
  formatWhatsapp,
  formatUrl,
  formatEmail,
  formatCep,
  mapOsmCategory,
  extractContacts,
  extractAddress,
  resolveLocality,
  buildOverpassQuery,
  normalizeOsmElement,
  deduplicateCompanies,
  parseOsmElements,
  fetchOsmData,
  syncOsmData,
} = require("../lib/osm_importer");
const { resetMemoryStore, listCompanies } = require("../lib/company_store");

test.beforeEach(() => {
  resetMemoryStore();
});

test("osm_importer: helpers de formatação e sanitização", () => {
  assert.equal(sanitize("<script>alert(1)</script>Loja & Cia"), "alert(1)Loja & Cia");
  assert.equal(slugify("Óticas & Lentes São Paulo"), "oticas-lentes-sao-paulo");
  assert.equal(slugify(""), "geral");

  // Telefone nacional
  assert.equal(formatPhone("11987654321"), "(11) 98765-4321");
  assert.equal(formatPhone("1134567890"), "(11) 3456-7890");
  assert.equal(formatPhone("+55 (11) 98765-4321"), "(11) 98765-4321");
  assert.equal(formatPhone("123"), "");

  // WhatsApp
  assert.equal(formatWhatsapp("11987654321"), "https://wa.me/5511987654321");
  assert.equal(formatWhatsapp(null, "11987654321"), "https://wa.me/5511987654321");
  assert.equal(formatWhatsapp(null, "1134567890"), ""); // fixo não vira whatsapp automático

  // URL e E-mail
  assert.equal(formatUrl("www.caasexpress.com.br"), "https://www.caasexpress.com.br/");
  assert.equal(formatUrl("http://teste.com/contato"), "http://teste.com/contato");
  assert.equal(formatUrl("javascript:alert(1)"), "");
  assert.equal(formatEmail("CONTATO@EMPRESA.COM.BR"), "contato@empresa.com.br");
  assert.equal(formatEmail("invalido"), "");

  // CEP
  assert.equal(formatCep("07010000"), "07010-000");
  assert.equal(formatCep("07010-000"), "07010-000");
  assert.equal(formatCep("123"), "");
});

test("osm_importer: mapOsmCategory mapeia tags OSM para categorias canônicas em pt-BR", () => {
  assert.equal(mapOsmCategory({ amenity: "restaurant" }).slug, "restaurantes");
  assert.equal(mapOsmCategory({ amenity: "restaurant" }).label, "Restaurantes");
  assert.equal(mapOsmCategory({ shop: "supermarket" }).slug, "supermercados");
  assert.equal(mapOsmCategory({ amenity: "pharmacy" }).slug, "saude");
  assert.equal(mapOsmCategory({ shop: "clothes" }).slug, "moda");
  assert.equal(mapOsmCategory({ amenity: "bank" }).slug, "financas");
  assert.equal(mapOsmCategory({ amenity: "fuel" }).slug, "postos");
  assert.equal(mapOsmCategory({ shop: "car" }).slug, "automoveis");
  assert.equal(mapOsmCategory({ amenity: "school" }).slug, "educacao");
  assert.equal(mapOsmCategory({ office: "lawyer" }).slug, "servicos");
  assert.equal(mapOsmCategory({ tag_desconhecida: "123" }).slug, "outros");
  assert.equal(mapOsmCategory({ tag_desconhecida: "123" }).label, "Outros");
});

test("osm_importer: resolveLocality e buildOverpassQuery geram consulta para qualquer município", () => {
  const guarulhos = resolveLocality("3518800");
  assert.equal(guarulhos.municipalityName, "Guarulhos");
  assert.equal(guarulhos.stateCode, "SP");

  const query = buildOverpassQuery("3518800", { timeout: 20 });
  assert.ok(query.includes('area["name"="Guarulhos"]["boundary"="administrative"]'));
  assert.ok(query.includes("[timeout:20]"));
  assert.ok(query.includes('nwr["shop"](area.cityArea);'));
  assert.ok(query.includes("out center tags;"));

  // Com bounding box
  const bboxQuery = buildOverpassQuery("3518800", {
    bbox: [-23.5, -46.6, -23.4, -46.4],
  });
  assert.ok(bboxQuery.includes("(-23.5,-46.6,-23.4,-46.4)"));

  // Rejeita localidade inexistente
  assert.throws(() => buildOverpassQuery("9999999"), /não encontrado/);
});

test("osm_importer: normalizeOsmElement normaliza nó e caminho com proveniência e coordenadas", () => {
  const mockNode = {
    type: "node",
    id: 1001,
    lat: -23.461,
    lon: -46.528,
    tags: {
      name: "Restaurante Central <script>",
      amenity: "restaurant",
      "addr:street": "Rua Dom Pedro",
      "addr:housenumber": "150",
      "addr:suburb": "Centro",
      "addr:postcode": "07010000",
      phone: "11987654321",
      website: "http://restaurante.com",
    },
  };

  const normalized = normalizeOsmElement(mockNode, "3518800");
  assert.ok(normalized);
  assert.equal(normalized.id, 1001);
  assert.equal(normalized.source_id, "osm-node-1001");
  assert.equal(normalized.osm_type, "node");
  assert.equal(normalized.name, "Restaurante Central");
  assert.equal(normalized.slug, "restaurante-central");
  assert.equal(normalized.category, "restaurantes");
  assert.equal(normalized.category_label, "Restaurantes");
  assert.equal(normalized.address, "Rua Dom Pedro, 150");
  assert.equal(
    normalized.formattedAddress,
    "Rua Dom Pedro, 150, Centro, Guarulhos — SP"
  );
  assert.equal(normalized.neighbourhood, "Centro");
  assert.equal(normalized.city, "Guarulhos");
  assert.equal(normalized.state, "SP");
  assert.equal(normalized.cep, "07010-000");
  assert.equal(normalized.lat, -23.461);
  assert.equal(normalized.lng, -46.528);
  assert.equal(normalized.phone, "(11) 98765-4321");
  assert.equal(normalized.whatsapp, "https://wa.me/5511987654321");
  assert.equal(normalized.website, "http://restaurante.com/");
  assert.equal(normalized.source, "OpenStreetMap");
  assert.equal(normalized.source_license, "ODbL 1.0");
  assert.equal(normalized.source_url, "https://www.openstreetmap.org/node/1001");
});

test("osm_importer: normalizeOsmElement com centroide em way e descarta locais sem nome", () => {
  const mockWay = {
    type: "way",
    id: 2002,
    center: { lat: -23.45, lon: -46.53 },
    tags: {
      name: "Supermercado Estrela",
      shop: "supermarket",
    },
  };

  const comp = normalizeOsmElement(mockWay, "3518800");
  assert.ok(comp);
  assert.equal(comp.id, 2002);
  assert.equal(comp.source_id, "osm-way-2002");
  assert.equal(comp.lat, -23.45);
  assert.equal(comp.lng, -46.53);
  assert.equal(comp.category, "supermercados");

  // Elemento sem nome é descartado (não inventa dados)
  const noName = {
    type: "node",
    id: 3003,
    lat: -23.45,
    lon: -46.53,
    tags: { shop: "bakery" },
  };
  assert.equal(normalizeOsmElement(noName, "3518800"), null);
});

test("osm_importer: deduplicateCompanies remove duplicatas espaciais e funde contatos", () => {
  const comp1 = {
    id: 1,
    osm_type: "node",
    name: "Farmácia Boa Saúde",
    slug: "farmacia-boa-saude",
    lat: -23.45123,
    lng: -46.53123,
    phone: "(11) 2222-3333",
  };
  const comp2 = {
    id: 2,
    osm_type: "way",
    name: "Farmácia Boa Saúde",
    slug: "farmacia-boa-saude",
    lat: -23.45124, // coordenada idêntica na grade (~0.0002)
    lng: -46.53124,
    website: "https://boasaude.com.br",
  };
  const comp3 = {
    id: 3,
    osm_type: "node",
    name: "Outra Loja",
    slug: "outra-loja",
    lat: -23.46,
    lng: -46.52,
  };

  const deduped = deduplicateCompanies([comp1, comp2, comp3]);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].id, 1);
  assert.equal(deduped[0].phone, "(11) 2222-3333");
  assert.equal(deduped[0].website, "https://boasaude.com.br"); // contato fundido
  assert.equal(deduped[1].id, 3);
});

test("osm_importer: parseOsmElements resolve colisão de slugs adicionando sufixo único", () => {
  const elements = [
    {
      type: "node",
      id: 10,
      lat: -23.4,
      lon: -46.5,
      tags: { name: "Padaria Central", shop: "bakery" },
    },
    {
      type: "node",
      id: 20,
      lat: -23.48, // coordenada bem distante (filial diferente)
      lon: -46.58,
      tags: { name: "Padaria Central", shop: "bakery" },
    },
  ];

  const parsed = parseOsmElements(elements, "3518800");
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].slug, "padaria-central");
  assert.equal(parsed[1].slug, "padaria-central-20");
});

test("osm_importer: syncOsmData em dryRun processa métricas sem persistir", async () => {
  const elements = [
    {
      type: "node",
      id: 101,
      lat: -23.45,
      lon: -46.53,
      tags: { name: "Clínica Vida", healthcare: "clinic" },
    },
    {
      type: "node",
      id: 102,
      lat: -23.46,
      lon: -46.54,
      tags: { name: "Auto Mecânica SP", amenity: "car_repair" },
    },
  ];

  const result = await syncOsmData("3518800", {
    elements,
    dryRun: true,
  });

  assert.equal(result.success, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.validCompanies, 2);
  assert.equal(result.savedCount, 0);
  assert.equal(result.categoriesCount["saude"], 1);
  assert.equal(result.categoriesCount["automoveis"], 1);
});

test("osm_importer: syncOsmData com carga ativa persiste empresas no catálogo", async () => {
  const elements = [
    {
      type: "node",
      id: 201,
      lat: -23.45,
      lon: -46.53,
      tags: {
        name: "Livraria Saber",
        shop: "books",
        "addr:street": "Rua das Letras",
        "addr:housenumber": "42",
      },
    },
    {
      type: "node",
      id: 202,
      lat: -23.47,
      lon: -46.55,
      tags: {
        name: "Academia Fitness Fit",
        leisure: "fitness_centre",
      },
    },
  ];

  const result = await syncOsmData("3518800", {
    elements,
    batchSize: 1, // testa múltiplos batches
    dryRun: false,
  });

  assert.equal(result.success, true);
  assert.equal(result.validCompanies, 2);
  assert.equal(result.savedCount, 2);
  assert.equal(result.batchesCount, 2);

  // Verifica que empresas estão no store
  const stored = await listCompanies("3518800", {});
  const livraria = stored.find((c) => c.name === "Livraria Saber");
  const academia = stored.find((c) => c.name === "Academia Fitness Fit");

  assert.ok(livraria);
  assert.equal(livraria.categorySlug, "comercio");
  assert.ok(academia);
  assert.equal(academia.categorySlug, "esportes");
});

test("osm_importer: fetchOsmData trata erros de rede da Overpass API", async () => {
  const mockFailingFetch = async () => ({
    ok: false,
    status: 429,
    statusText: "Too Many Requests",
  });

  await assert.rejects(
    () =>
      fetchOsmData("3518800", {
        fetchImpl: mockFailingFetch,
      }),
    (err) => err.status === 429 && /Overpass API HTTP 429/.test(err.message)
  );
});
