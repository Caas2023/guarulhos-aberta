# Guarulhos Aberta

Diretório nacional de empresas, com Guarulhos/SP como cidade-piloto.

## Estado atual

- Interface responsiva com busca, filtros por categoria e cards de empresas.
- Base real: 1.502 registros do município de Guarulhos obtidos de OpenStreetMap/Overpass.
- Contatos encontrados: 379 telefones, 377 links WhatsApp, 155 sites e 1.061 endereços.
- Cards mostram telefone, WhatsApp, site e mapa quando o dado existe na fonte.
- Fonte, licença ODbL, data e cobertura limitada devem permanecer visíveis.
- Não afirmar cobertura total: OSM depende do que foi mapeado e não representa todas as empresas.
- Endpoint de reivindicação/correção valida localidade IBGE, e-mail, sanitização e dígitos verificadores do CNPJ.
- A persistência de reivindicações depende da camada de armazenamento Vercel agora implementada em `lib/claim_store.js`; sem `KV_REST_API_URL` e `KV_REST_API_TOKEN`, `POST /api/claim` retorna `503` e não confirma o protocolo.
- A camada de persistência do catálogo nacional de empresas (`lib/company_store.js`) suporta Vercel KV / Upstash Redis REST com particionamento por código IBGE, indexação de slugs por categoria e pipeline em lote (`saveCompaniesBatch`); opera com fallback limpo na cidade-piloto e isolamento estrito entre municípios.
- A API de empresa (`api/company.js`) consulta a persistência nacional e retorna 404 para slugs inexistentes sem criação sintética indevida de dados.
- A API de categoria (`api/category.js`) consome o catálogo nacional particionado por IBGE em vez de depender de arquivo estático único versionado no Git.
- O endpoint de busca de locais (`api/places.js`) opera em arquitetura nacional: consulta primeiramente o catálogo persistente nacional particionado por código IBGE (`lib/company_store.js`) e só consulta o OpenStreetMap sob demanda quando o catálogo local não tiver registros, com filtragem administrativa correta e compatibilidade regressiva na cidade-piloto.
- O sincronizador e importador OpenStreetMap (`lib/osm_importer.js` e `scripts/sync_osm_companies.js`) suporta qualquer município do Brasil via IBGE, com extração e sanitização de contatos, deduplicação espacial/ID, categorização pt-BR e carga em lotes (batching) na camada de persistência.
- O endpoint rejeita campos textuais acima dos limites definidos e telefones com caracteres inválidos antes de qualquer persistência.

## Referências de design e acessibilidade

- [W3C WAI — Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/): cada controle de busca/filtro tem `label` associado; rótulos visuais foram mantidos quando já faziam parte do fluxo.
- [W3C WCAG 2.2 — Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html): nomes acessíveis explícitos para busca, categoria e contato.
- Direção visual: editorial urbano + mapa noturno, com azul-petróleo, laranja de ação e verde para dados abertos; a pesquisa permanece a ação dominante.
## Desenvolvimento local

Servidor estático simples:

```bash
python -m http.server 4173
```

Acesse `http://localhost:4173`.

## Modelo nacional

O piloto usa código IBGE, nomes separados de slugs e rotas `/estado/cidade/categoria/empresa`, permitindo adicionar municípios sem reescrever a estrutura.

## Testes

```bash
node test/company.test.js
node test/company_store.test.js
node test/localities.test.js
node test/routing.test.js
node test/schema_generator.test.js
node test/sitemap.test.js
node test/claim.test.js
node test/claim_store.test.js
node test/category.test.js
node test/accessibility.test.js
node test/osm_importer.test.js
node test/places.test.js
```

Suíte completa (101 testes automatizados em 12 suítes).

## Deploy

1. Importar este repositório na Vercel.
2. Testar homepage, busca, dados reais e endpoints.
3. Monitorar limites do Overpass e, para volume, usar provedor/instância OSM autorizada.

## Compliance

Não raspar Google Maps. Dados Google só entram via API oficial autorizada. Fallback usa OpenStreetMap/Overpass sob ODbL, com atribuição e cobertura limitada. Oferecer correção/remoção e não publicar dados pessoais sem base legal.

## Marca piloto

- Nome: Guarulhos Aberta
- Fundo: marfim `#f7f4ed` na proposta original
- Implementação atual: interface escura com roxo para melhor leitura de cards

## Pendências

- Deploy Vercel (CLI deslogada; autenticar com `vercel login`).
- Expansão para outras cidades brasileiras.
- Cadastro/reivindicação de empresas.
- Atualização periódica da base.

## Sitemap

O `sitemap.xml` na raiz é gerado automaticamente a partir dos dados reais:

```bash
node scripts/generate-sitemap.js [--base-url https://seudominio.com.br]
```

Em produção Vercel, `/sitemap.xml` é servido pelo handler `api/sitemap.js` com cache CDN de 1 hora.
Resultado atual: **1.571 URLs** (homepage + 118 categorias + 1.452 empresas, rotas `/sp/guarulhos/categoria/empresa`).

