# Roadmap — Guarulhos Aberta

Atualizado em 29/09/2026.

## Nome e posicionamento

- Nome de trabalho: **Guarulhos Aberta**.
- Busca pública não encontrou portal empresarial com expressão exata.
- Concorrentes encontrados: Tudo Aqui Guarulhos, guia.gru.br, Guia Guarulhos e Guarulhos em Rede.
- Nome continua provisório até pesquisa de marca no INPI e consulta direta de domínio no Registro.br.
- Promessa: localizar empresas e serviços de Guarulhos com fonte e atualização transparentes.

## Arquitetura atual

- Frontend estático: `index.html`, `styles.css`, `app.js`.
- API Vercel: `api/places.js`.
- Fonte atual: OpenStreetMap/Overpass, ODbL, cobertura limitada.
- Git local: branch `main`, commits registrados.
- GitHub remoto: pendente de autenticação/configuração.
- Vercel: CLI instalada; sessão deslogada.

## Fases

### Fase 1 — Fundação

- [x] Pasta exclusiva do portal.
- [x] Nome provisório e identidade visual.
- [x] Homepage responsiva.
- [x] Busca e categorias.
- [x] API pública OSM/Overpass.
- [x] README e regras de compliance.
- [x] Git local e commits.
- [ ] Pesquisa INPI e domínio Registro.br.
- [ ] Publicação GitHub.
- [ ] Deploy Vercel verificado.

### Fase 2 — Catálogo

- [ ] Modelo persistente de empresa.
- [ ] Categorias e bairros canônicos.
- [ ] Página individual por empresa.
- [ ] Página por categoria e bairro.
- [ ] Sitemap e schema `LocalBusiness` por registro verificável.
- [ ] Importador OSM paginado com deduplicação.
- [ ] Atualização periódica e registro de fonte/data.

### Fase 3 — Cadastro e conta

- [ ] Login seguro.
- [ ] Cadastro de usuário.
- [ ] Cadastro de empresa.
- [ ] Reivindicação de empresa existente.
- [ ] Verificação por e-mail/domínio/documentação.
- [ ] Painel do empresário.
- [ ] Correção, remoção e trilha de auditoria.

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
