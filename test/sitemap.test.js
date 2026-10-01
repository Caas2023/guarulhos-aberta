/**
 * test/sitemap.test.js
 *
 * Testes unitários para lib/sitemap_generator.js
 * Executa com: node --test test/sitemap.test.js
 */

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  generateSitemap,
  escapeXml,
  isoDate,
  isValidSlug,
} = require("../lib/sitemap_generator");

// Fixtures mínimas — sem dados inventados de empresas reais
const LOCALITY_GUARULHOS = {
  municipalityId: "3518800",
  stateId: "35",
  stateCode: "SP",
  stateSlug: "sp",
  municipalityName: "Guarulhos",
  municipalitySlug: "guarulhos",
};

const LOCALITY_SP_CAPITAL = {
  municipalityId: "3550308",
  stateId: "35",
  stateCode: "SP",
  stateSlug: "sp",
  municipalityName: "São Paulo",
  municipalitySlug: "sao-paulo",
};

const COMPANY_A = {
  id: 1,
  name: "Empresa Alpha",
  slug: "empresa-alpha",
  category: "alimentacao",
  ibge: "3518800",
};

const COMPANY_B = {
  id: 2,
  name: "Empresa Beta",
  slug: "empresa-beta",
  category: "servicos",
  ibge: "3518800",
};

const COMPANY_SP = {
  id: 3,
  name: "Empresa SP",
  slug: "empresa-sp",
  category: "alimentacao",
  ibge: "3550308",
};

// Empresa com ibge desconhecido — deve ser ignorada
const COMPANY_UNKNOWN = {
  id: 4,
  name: "Empresa Desconhecida",
  slug: "empresa-desconhecida",
  category: "servicos",
  ibge: "0000000",
};

// Empresa com slug inválido — deve ser ignorada
const COMPANY_BAD_SLUG = {
  id: 5,
  name: "Empresa",
  slug: "Empresa Com Espaço",
  category: "servicos",
  ibge: "3518800",
};

describe("escapeXml", () => {
  it("escapa & < > \" ' corretamente", () => {
    assert.equal(escapeXml("Café & Bar <Ok> \"test\" 'x'"), "Café &amp; Bar &lt;Ok&gt; &quot;test&quot; &apos;x&apos;");
  });

  it("retorna string vazia para não-string", () => {
    assert.equal(escapeXml(null), "");
    assert.equal(escapeXml(undefined), "");
    assert.equal(escapeXml(123), "");
  });
});

describe("isoDate", () => {
  it("retorna formato YYYY-MM-DD", () => {
    const date = new Date("2026-10-01T00:00:00Z");
    assert.equal(isoDate(date), "2026-10-01");
  });

  it("usa data de hoje quando não fornecida", () => {
    const result = isoDate();
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isValidSlug", () => {
  it("aceita slugs válidos", () => {
    assert.ok(isValidSlug("alimentacao"));
    assert.ok(isValidSlug("empresa-alpha"));
    assert.ok(isValidSlug("a1b2"));
  });

  it("rejeita slugs com maiúsculas, espaços ou caracteres especiais", () => {
    assert.ok(!isValidSlug("Alimentacao"));
    assert.ok(!isValidSlug("empresa alpha"));
    assert.ok(!isValidSlug("empresa@alpha"));
    assert.ok(!isValidSlug(""));
    assert.ok(!isValidSlug(null));
  });
});

describe("generateSitemap — validação de entradas", () => {
  it("lança TypeError se baseUrl não for URL válida", () => {
    assert.throws(
      () => generateSitemap({ baseUrl: "naoéurl", companies: [], localities: [] }),
      TypeError
    );
  });

  it("lança TypeError se companies não for array", () => {
    assert.throws(
      () => generateSitemap({ baseUrl: "https://example.com", companies: null, localities: [] }),
      TypeError
    );
  });

  it("lança TypeError se localities não for array", () => {
    assert.throws(
      () => generateSitemap({ baseUrl: "https://example.com", companies: [], localities: "x" }),
      TypeError
    );
  });
});

describe("generateSitemap — geração nacional com rotas IBGE", () => {
  const BASE = "https://guarulhos-aberta.vercel.app";
  const companies = [COMPANY_A, COMPANY_B, COMPANY_SP, COMPANY_UNKNOWN, COMPANY_BAD_SLUG];
  const localities = [LOCALITY_GUARULHOS, LOCALITY_SP_CAPITAL];

  let result;

  it("retorna objeto com xml e stats", () => {
    result = generateSitemap({ baseUrl: BASE, companies, localities, lastmod: "2026-10-01" });
    assert.ok(result.xml, "xml deve existir");
    assert.ok(result.stats, "stats deve existir");
  });

  it("XML começa com declaração e urlset corretos", () => {
    const { xml } = generateSitemap({ baseUrl: BASE, companies, localities, lastmod: "2026-10-01" });
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), "declaração XML ausente");
    assert.ok(xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), "urlset ausente");
    assert.ok(xml.endsWith("</urlset>"), "fechamento urlset ausente");
  });

  it("inclui homepage com priority 1.0 e changefreq daily", () => {
    const { xml } = generateSitemap({ baseUrl: BASE, companies, localities, lastmod: "2026-10-01" });
    assert.ok(xml.includes(`<loc>${BASE}/</loc>`), "homepage ausente");
    assert.ok(xml.includes("<priority>1.0</priority>"), "priority homepage ausente");
    assert.ok(xml.includes("<changefreq>daily</changefreq>"), "changefreq homepage ausente");
  });

  it("usa rota nacional /estado/cidade/categoria/empresa sem hardcode de guarulhos", () => {
    const { xml } = generateSitemap({ baseUrl: BASE, companies, localities, lastmod: "2026-10-01" });
    // Empresa de Guarulhos
    assert.ok(xml.includes(`${BASE}/sp/guarulhos/alimentacao/empresa-alpha`), "rota empresa Guarulhos ausente");
    // Empresa de SP capital
    assert.ok(xml.includes(`${BASE}/sp/sao-paulo/alimentacao/empresa-sp`), "rota empresa SP capital ausente");
  });

  it("inclui páginas de categoria deduplicadas", () => {
    const { xml } = generateSitemap({ baseUrl: BASE, companies, localities, lastmod: "2026-10-01" });
    // alimentacao aparece uma vez para guarulhos
    const matches = xml.match(/\/sp\/guarulhos\/alimentacao<\/loc>/g) || [];
    assert.equal(matches.length, 1, "categoria duplicada na URL de categoria");
  });

  it("ignora empresa com ibge desconhecido (not in localities)", () => {
    const { xml } = generateSitemap({ baseUrl: BASE, companies, localities, lastmod: "2026-10-01" });
    assert.ok(!xml.includes("empresa-desconhecida"), "empresa com ibge desconhecido não deve aparecer");
  });

  it("ignora empresa com slug inválido", () => {
    const { xml } = generateSitemap({ baseUrl: BASE, companies, localities, lastmod: "2026-10-01" });
    assert.ok(!xml.includes("Empresa Com Espa"), "empresa com slug inválido não deve aparecer");
  });

  it("stats reporta contagem correta", () => {
    const { stats } = generateSitemap({ baseUrl: BASE, companies, localities, lastmod: "2026-10-01" });
    // 1 homepage + 3 category pages (alimentacao-gru, servicos-gru, alimentacao-sp) + 3 valid company pages
    assert.equal(stats.urlCount, 7, `urlCount incorreto: ${stats.urlCount}`);
    assert.equal(stats.companyEntries, 3, `companyEntries incorreto: ${stats.companyEntries}`);
    assert.equal(stats.skipped, 2, `skipped incorreto: ${stats.skipped}`);
    assert.equal(stats.categoryPages, 3, `categoryPages incorreto: ${stats.categoryPages}`);
  });

  it("respeita maxEntries", () => {
    const manyCompanies = Array.from({ length: 200 }, (_, i) => ({
      id: i,
      name: `Empresa ${i}`,
      slug: `empresa-${i}`,
      category: "servicos",
      ibge: "3518800",
    }));
    const { stats } = generateSitemap({
      baseUrl: BASE,
      companies: manyCompanies,
      localities: [LOCALITY_GUARULHOS],
      maxEntries: 10,
    });
    assert.ok(stats.urlCount <= 10, `urlCount deve respeitar maxEntries: ${stats.urlCount}`);
  });

  it("lastmod aparece em todas as entradas <url>", () => {
    const { xml } = generateSitemap({ baseUrl: BASE, companies, localities, lastmod: "2026-10-01" });
    const urlCount = (xml.match(/<url>/g) || []).length;
    const lastmodCount = (xml.match(/<lastmod>2026-10-01<\/lastmod>/g) || []).length;
    assert.equal(urlCount, lastmodCount, "nem todas as entradas têm lastmod");
  });
});

describe("generateSitemap — integração com dados reais", () => {
  it("gera sitemap a partir dos 1502 registros OSM sem falhar", () => {
    const realCompanies = require("../data/companies.json");
    const realLocalities = require("../data/localities.json");
    const { xml, stats } = generateSitemap({
      baseUrl: "https://guarulhos-aberta.vercel.app",
      companies: realCompanies,
      localities: realLocalities,
      lastmod: "2026-10-01",
    });
    assert.ok(xml.length > 1000, "XML muito curto para 1502 empresas");
    assert.ok(stats.companyEntries > 0, "nenhuma empresa indexada");
    assert.ok(stats.urlCount >= stats.companyEntries, "urlCount menor que companyEntries");
    // Deve incluir pelo menos 1 URL nacional válida
    assert.ok(xml.includes("/sp/guarulhos/"), "rota nacional /sp/guarulhos/ ausente");
    // Não deve ter caracteres não-XML
    assert.ok(!xml.includes("undefined"), "XML contém 'undefined'");
    assert.ok(!xml.includes("null"), "XML contém 'null'");
    console.log("Integração real:", JSON.stringify(stats));
  });
});
