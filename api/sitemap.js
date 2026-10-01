/**
 * api/sitemap.js
 *
 * Handler Vercel serverless para sitemap.xml dinâmico.
 * Gera sitemap em tempo real a partir dos dados locais e serve com cache.
 *
 * Rota sugerida em vercel.json:
 *   { "src": "/sitemap.xml", "dest": "/api/sitemap.js" }
 *
 * Cache: 1 hora (s-maxage=3600) via CDN Vercel, revalidação background.
 */

"use strict";

const path = require("path");
const fs = require("fs");
const { generateSitemap } = require("../lib/sitemap_generator");

// Carrega dados uma vez no cold start para minimizar latência
let cached = null;

function loadData() {
  if (cached) return cached;
  const root = path.resolve(__dirname, "..");
  cached = {
    companies: JSON.parse(
      fs.readFileSync(path.join(root, "data", "companies.json"), "utf8")
    ),
    localities: JSON.parse(
      fs.readFileSync(path.join(root, "data", "localities.json"), "utf8")
    ),
  };
  return cached;
}

module.exports = function handler(req, res) {
  // Apenas GET
  if (req.method && req.method !== "GET") {
    res.status(405).set("Allow", "GET").end("Method Not Allowed");
    return;
  }

  try {
    const baseUrl =
      process.env.SITE_BASE_URL ||
      (req.headers && req.headers.host
        ? `https://${req.headers.host}`
        : "https://guarulhos-aberta.vercel.app");

    const { companies, localities } = loadData();
    const { xml } = generateSitemap({ baseUrl, companies, localities });

    res
      .status(200)
      .set("Content-Type", "application/xml; charset=utf-8")
      .set(
        "Cache-Control",
        "public, s-maxage=3600, stale-while-revalidate=86400"
      )
      .end(xml);
  } catch (err) {
    console.error("[api/sitemap] Erro ao gerar sitemap:", err);
    res.status(500).end("Erro interno ao gerar sitemap");
  }
};
