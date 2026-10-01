/**
 * scripts/generate-sitemap.js
 *
 * Gera e grava sitemap.xml estático a partir dos dados locais.
 * Usado em deploy estático (Vercel static export, CI, local dev).
 *
 * Uso:
 *   node scripts/generate-sitemap.js [--base-url https://dominioseu.com.br]
 *
 * O sitemap gerado é gravado em sitemap.xml na raiz do projeto.
 * Não requer credenciais externas — usa apenas data/companies.json e data/localities.json.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { generateSitemap } = require("../lib/sitemap_generator");

const ROOT = path.resolve(__dirname, "..");

// Parse --base-url do argv
function parseBaseUrl() {
  const idx = process.argv.indexOf("--base-url");
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1].replace(/\/$/, "");
  }
  // Fallback para variável de ambiente ou URL de produção padrão
  return (
    process.env.SITE_BASE_URL || "https://guarulhos-aberta.vercel.app"
  );
}

function main() {
  const baseUrl = parseBaseUrl();
  console.log(`[sitemap] Gerando sitemap para: ${baseUrl}`);

  const companies = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "companies.json"), "utf8")
  );
  const localities = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "localities.json"), "utf8")
  );

  const { xml, stats } = generateSitemap({ baseUrl, companies, localities });

  const outPath = path.join(ROOT, "sitemap.xml");
  fs.writeFileSync(outPath, xml, "utf8");

  console.log(`[sitemap] Gravado: ${outPath}`);
  console.log(
    `[sitemap] URLs totais: ${stats.urlCount} | Empresas: ${stats.companyEntries} | Categorias: ${stats.categoryPages} | Ignoradas: ${stats.skipped}`
  );
  console.log(`[sitemap] Data de geração: ${stats.generatedAt}`);

  if (stats.skipped > 0) {
    console.warn(
      `[sitemap] AVISO: ${stats.skipped} empresas ignoradas (slug ou IBGE inválidos).`
    );
  }
}

main();
