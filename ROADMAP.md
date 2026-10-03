# Roadmap — Guarulhos Aberta

Atualizado em 02/10/2026.

## Nome e posicionamento

- Nome de trabalho: **Guarulhos Aberta**.
- Busca pública não encontrou portal empresarial com expressão exata.
- Concorrentes encontrados: Tudo Aqui Guarulhos, guia.gru.br, Guia Guarulhos e Guarulhos em Rede.
- Nome continua provisório até pesquisa de marca no INPI e consulta direta de domínio no Registro.br.
- Promessa: localizar empresas e serviços de Guarulhos com fonte e atualização transparentes.

## Próxima tarefa recomendada

- [ ] Categorias e bairros canônicos nacionais (normalização e mapeamento de bairros/distritos por código IBGE para filtros avançados de busca).
- [x] Importador e sincronizador de dados OSM com paginação, deduplicação e carga em lote no catálogo persistente (`lib/osm_importer.js`, `scripts/sync_osm_companies.js`, `api/places.js` nacional com suporte a `company_store`).
- [x] Persistência do catálogo de empresas compatível com Vercel, sem depender do JSON versionado (`lib/company_store.js` com Vercel KV REST, particionamento IBGE, índice de slug, batch pipeline e fallback).
- [x] Persistência compatível com Vercel para reivindicações/correções via REST KV, com falha fechada (`503`) quando as variáveis não estão configuradas.
- [x] APIs de empresa e categoria sem fallback implícito para Guarulhos; localidade é obrigatória por IBGE/slug.

## Progresso recente

- [x] Sincronizador e importador OpenStreetMap (`lib/osm_importer.js`, `scripts/sync_osm_companies.js`): normalização geográfica territorial, sanitização estrita, formatação de contatos (telefone com DDD, WhatsApp wa.me, URL, e-mail), mapeamento pt-BR, deduplicação espacial/ID e carga em lotes na camada de persistência.
- [x] `api/places.js` atualizado para arquitetura nacional: consulta prioritária ao catálogo persistente (`company_store`), fallback dinâmico Overpass delimitado por município e compatibilidade com cidade-piloto.
- [x] Função `getLocalityBySlug` implementada e exportada em `lib/localities.js`.
- [x] 101 testes automatizados cobrindo todo o pipeline de importação, busca, persistência, sitemap e schemas.

## Arquitetura atual

- Frontend estático: `index.html`, `styles.css`, `app.js`.
- API Vercel: `api/places.js`.
- Fonte atual: OpenStreetMap/Overpass, ODbL, cobertura limitada.
- Git local: branch `main`, commits registrados.
- GitHub remoto: pendente de autenticação/configuração.
- Vercel: CLI instalada; sessão deslogada.

## Escala nacional

Guarulhos é cidade-piloto. Arquitetura deverá atender futuramente todas as aproximadamente 5.570 cidades brasileiras:

- Rotas: `/estado/cidade/categoria/empresa`.
- Localidade identificada por código IBGE, UF, município e slug.
- Banco, SEO, sitemap, cadastro e reivindicação não podem codificar Guarulhos como constante global.
- Nome nacional ainda precisa validação no INPI e Registro.br. “Guarulhos Aberta” permanece nome da implantação piloto.

## Fases

### Fase 1 — Fundação

- [x] Pasta exclusiva do portal.
- [x] Nome provisório e identidade visual.
- [x] Homepage responsiva.
- [x] Busca e categorias.
- [x] API pública OSM/Overpass.
- [x] README e regras de compliance.
- [x] Git local e commits.
- [x] PRD e roadmap detalhado (`PRD.md`).
- [ ] Pesquisa INPI e domínio Registro.br.
- [ ] Publicação GitHub.
- [ ] Deploy Vercel verificado.

### Fase 1.1 — SEO técnico

- [x] Homepage com canonical, Open Graph e `WebSite` JSON-LD/`SearchAction`.
- [ ] Validar produção após domínio definitivo.

### Fase 2 — Catálogo

- [x] Modelo nacional localidade com IDs IBGE slugs separados (`data/localities.json`, `lib/localities.js`).
- [x] Gerador de Schema JSON-LD (`LocalBusiness` e `BreadcrumbList`) dinâmico por localidade (`lib/schema_generator.js`).
- [x] Sitemap dinâmico nacional com todas as empresas reais: `lib/sitemap_generator.js`, `api/sitemap.js`, `scripts/generate-sitemap.js`. 1.571 URLs (1 homepage + 118 categorias + 1.452 empresas). Rotas IBGE `/sp/guarulhos/categoria/empresa`. 20 testes unitários + integração real.
- [x] Modelo persistente empresa: camada de persistência nacional (`lib/company_store.js`) compatível com Vercel KV REST, particionamento por código IBGE, indexação de slug por categoria, suporte a batch pipeline e fallback na cidade-piloto.
- [ ] Categorias e bairros canônicos.
- [x] Página individual por empresa e Endpoint Vercel API (`lib/company.js` e `api/company.js`).
- [x] Página por categoria: `lib/category_page.js` e `api/category.js`. Gera ItemList + BreadcrumbList schema, paginação, proveniência ODbL. 26 testes. Rota nacional IBGE sem Guarulhos fixo.
- [ ] Sitemap e schema `LocalBusiness` por registro verificável. (Sitemap XML básico adicionado)
- [x] Importador OSM paginado com deduplicação e sincronização em lote (`lib/osm_importer.js` e `scripts/sync_osm_companies.js`).
- [ ] Atualização periódica e registro de fonte/data.

### Fase 3 Cadastro conta

- Login seguro.
- Cadastro usuário.
- Cadastro empresa.
- [x] Reivindicação e solicitação de correção de empresa existente com validação IBGE nacional (`lib/claim_submission.js` e `api/claim.js`).
- Verificação por e-mail/domínio/documentação.
- Painel empresário.
- [x] Correção, remoção e trilha de auditoria estruturada (pending_verification com sanitização e CNPJ).
- [x] Validação dos dígitos verificadores do CNPJ antes de aceitar reivindicações.
- [x] Limites de tamanho e formato para entrada de reivindicações.

### Fase 4 — Receita

- [ ] Página premium identificada como anúncio.
- [ ] Destaque por categoria/bairro.
- [ ] Geração de leads com consentimento.
- [ ] Planos e cobrança.
- [ ] Métricas sem vender dados pessoais.

### Fase 5 — Google Business autorizado

- [ ] Configurar Google Places API oficial.
- [ ] Restringir chave e quota.
- [ ] Consultas por categoria/área com paginação.
- [ ] Armazenamento/atribuição compatíveis com termos.
- [ ] Nunca alegar cobertura total.

## Automação

Cronjob: `Guarulhos Aberta — evolução do portal`  
Job ID: `9ce137ee39af`  
Periodicidade: uma tarefa verificável a cada 5 horas.

Cada execução deve editar código real, testar, criar commit local e reportar bloqueios. Não raspar Google Maps, não criar empresas falsas, não expor segredos.
