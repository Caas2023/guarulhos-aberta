#!/usr/bin/env node
"use strict";

/**
 * scripts/sync_osm_companies.js
 *
 * Script CLI para sincronização de dados municipais do OpenStreetMap
 * diretamente no catálogo persistente nacional (Vercel KV REST ou fallback em memória).
 *
 * Uso:
 *   node scripts/sync_osm_companies.js [--municipality 3518800] [--file data/overpass.json] [--dry-run] [--batch-size 50]
 */

const fs = require("fs");
const path = require("path");
const { syncOsmData, resolveLocality } = require("../lib/osm_importer");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    municipalityId: "3518800", // Guarulhos como padrão da implantação piloto
    filePath: null,
    dryRun: false,
    batchSize: 50,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--municipality" && args[i + 1]) {
      options.municipalityId = args[++i];
    } else if (arg === "--file" && args[i + 1]) {
      options.filePath = args[++i];
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--batch-size" && args[i + 1]) {
      options.batchSize = parseInt(args[++i], 10) || 50;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log("=== Sincronizador Nacional OpenStreetMap ===");
  console.log(`Localidade alvo: ${options.municipalityId}`);
  console.log(`Modo: ${options.dryRun ? "Simulação (Dry-Run)" : "Persistência Ativa"}`);
  console.log(`Tamanho do lote (batch): ${options.batchSize}`);

  let elements = null;
  if (options.filePath) {
    const resolvedPath = path.resolve(process.cwd(), options.filePath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`[ERRO] Arquivo não encontrado: ${resolvedPath}`);
      process.exit(1);
    }
    console.log(`Carregando elementos locais de: ${resolvedPath}`);
    const content = fs.readFileSync(resolvedPath, "utf8");
    const json = JSON.parse(content);
    elements = Array.isArray(json) ? json : json.elements || [];
  }

  try {
    const result = await syncOsmData(options.municipalityId, {
      elements,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
    });

    console.log("\n--- Resultado da Sincronização ---");
    console.log(`Município: ${result.municipalityName} / ${result.stateCode} (IBGE: ${result.municipalityId})`);
    console.log(`Total de elementos OSM lidos: ${result.totalElementsFetched}`);
    console.log(`Empresas válidas normalizadas: ${result.validCompanies}`);
    console.log(`Duplicatas/ruídos removidos: ${result.duplicatesRemoved}`);
    console.log(`Lotes processados: ${result.batchesCount}`);
    console.log(`Registros persistidos: ${result.savedCount}`);
    console.log(`Tempo decorrido: ${result.durationMs}ms`);

    console.log("\nDistribuição por Categorias:");
    for (const [cat, count] of Object.entries(result.categoriesCount)) {
      console.log(`  - ${cat}: ${count}`);
    }

    console.log("\n[SUCESSO] Sincronização concluída com êxito.");
  } catch (error) {
    console.error(`\n[FALHA] Erro na sincronização: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, parseArgs };
