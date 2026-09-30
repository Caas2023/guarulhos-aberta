const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generateLocalBusinessSchema,
  generateBreadcrumbSchema
} = require("../lib/schema_generator");

const sampleLocality = {
  municipalityId: "3518800",
  stateId: "35",
  stateCode: "SP",
  stateSlug: "sp",
  municipalityName: "Guarulhos",
  municipalitySlug: "guarulhos"
};

test("gera Schema JSON-LD LocalBusiness correto e dinâmico por localidade", () => {
  const place = {
    id: "12345",
    name: "Óticas Dyana",
    categorySlug: "oticas",
    slug: "oticas-dyana",
    street: "Rua Capitão Gabriel, 100",
    postcode: "07011-010",
    phone: "+55 11 2400-0000",
    lat: "-23.4665",
    lon: "-46.5322",
    description: "Ótica tradicional em Guarulhos"
  };

  const schema = generateLocalBusinessSchema(place, sampleLocality);

  assert.equal(schema["@context"], "https://schema.org");
  assert.equal(schema["@type"], "LocalBusiness");
  assert.equal(schema["@id"], "https://guarulhos-aberta.vercel.app/sp/guarulhos/oticas/oticas-dyana");
  assert.equal(schema.name, "Óticas Dyana");
  assert.equal(schema.address["@type"], "PostalAddress");
  assert.equal(schema.address.addressLocality, "Guarulhos");
  assert.equal(schema.address.addressRegion, "SP");
  assert.equal(schema.address.addressCountry, "BR");
  assert.equal(schema.address.streetAddress, "Rua Capitão Gabriel, 100");
  assert.equal(schema.geo.latitude, -23.4665);
  assert.equal(schema.geo.longitude, -46.5322);
});

test("gera Schema BreadcrumbList com hierarquia nacional", () => {
  const breadcrumb = generateBreadcrumbSchema(
    sampleLocality,
    "Óticas",
    "oticas",
    "Óticas Dyana",
    "oticas-dyana"
  );

  assert.equal(breadcrumb["@context"], "https://schema.org");
  assert.equal(breadcrumb["@type"], "BreadcrumbList");
  assert.equal(breadcrumb.itemListElement.length, 4);

  assert.deepEqual(breadcrumb.itemListElement[0], {
    "@type": "ListItem",
    position: 1,
    name: "Início",
    item: "https://guarulhos-aberta.vercel.app"
  });

  assert.deepEqual(breadcrumb.itemListElement[1], {
    "@type": "ListItem",
    position: 2,
    name: "Guarulhos (SP)",
    item: "https://guarulhos-aberta.vercel.app/sp/guarulhos"
  });

  assert.deepEqual(breadcrumb.itemListElement[3], {
    "@type": "ListItem",
    position: 4,
    name: "Óticas Dyana",
    item: "https://guarulhos-aberta.vercel.app/sp/guarulhos/oticas/oticas-dyana"
  });
});
