# PRD — Guarulhos Aberta

**Product Requirements Document · v1.0**  
**Status:** aprovado como plano de execução  
**Cidade-piloto:** Guarulhos/SP  
**Escala-alvo:** Brasil inteiro, aproximadamente 5.570 municípios  
**Data:** 01/10/2026

---

## 1. Visão do produto

Criar diretório empresarial nacional que ajude pessoas e empresas a encontrar fornecedores reais, comparar canais de contato e solicitar orçamento.

Guarulhos será laboratório inicial. Produto não poderá depender estruturalmente de Guarulhos: localidade, categorias, SEO, cadastro, base e URLs deverão funcionar para qualquer município brasileiro.

**Referência de experiência:** oHub — busca orientada a serviço, categorias, orçamento e conexão direta. Não copiar marca, textos, imagens, layout ou código proprietário.

## 2. Problema

- Empresas locais têm dados espalhados e desatualizados.
- Clientes não sabem quais fornecedores existem perto deles.
- Pequenas empresas têm pouca presença digital.
- Diretórios frequentemente não mostram telefone, WhatsApp, site, mapa e fonte dos dados juntos.
- Bases públicas não equivalem a cobertura total; o produto precisa ser transparente.

## 3. Objetivos

### MVP Guarulhos

- Oferecer busca rápida por empresa, serviço, categoria e bairro.
- Exibir dados verificáveis: nome, categoria, endereço, telefone, WhatsApp, site e mapa quando existentes.
- Permitir solicitar orçamento.
- Permitir empresa solicitar correção, remoção ou reivindicação do cadastro.
- Mostrar fonte, licença, data e limitações.
- Publicar com URL estável e HTTPS.

### Expansão nacional

- Adicionar municípios por código IBGE sem reescrever o produto.
- Usar URLs `/uf/cidade/categoria/empresa`.
- Gerar páginas indexáveis por cidade, bairro, categoria e empresa.
- Criar rede nacional de fornecedores sem afirmar que a base contém todas as empresas.

## 4. Não objetivos

- Não raspar Google Maps.
- Não copiar base proprietária do Google Business.
- Não publicar empresas inventadas.
- Não vender dados pessoais.
- Não enviar mensagens comerciais automáticas sem consentimento.
- Não garantir que telefone/WhatsApp esteja ativo quando fonte não confirmar.
- Não lançar cobrança antes de política, suporte, recibo e fluxo de cancelamento.

## 5. Usuários

### Visitante
Busca empresa e entra em contato.

### Comprador B2B
Busca fornecedor, compara opções e solicita orçamento.

### Empresário
Cadastra, reivindica, atualiza ou remove dados da empresa.

### Administrador
Modera cadastros, valida correções, monitora fonte, qualidade e abuso.

## 6. Proposta de valor

**Para quem procura:** fornecedores locais com contatos e localização em um só lugar.  
**Para empresas:** descoberta local, página pública, correção de dados e geração de oportunidades.  
**Para o portal:** dados transparentes, SEO local, oferta de destaque identificado e leads com consentimento.

## 7. Escopo funcional

### 7.1 Descoberta

- Busca por nome, categoria, bairro, endereço e palavra-chave.
- Filtro por categoria.
- Filtro por município/UF.
- Ordenação futura por relevância, distância, atualização e destaque pago identificado.
- Paginação ou carregamento incremental.

### 7.2 Página de empresa

Campos possíveis:

- Nome comercial.
- Categoria e subcategoria.
- Descrição fornecida/revisada pelo responsável.
- Endereço.
- Bairro.
- CEP.
- Município, UF e código IBGE.
- Telefone.
- WhatsApp somente quando houver número fonte ou confirmação.
- Site.
- E-mail público empresarial, quando permitido.
- Coordenadas.
- Link de mapa.
- Horários, somente se fonte confiável.
- Fonte, licença e data de atualização.
- Botão corrigir/remover/reivindicar.

### 7.3 Contato

- Link `tel:` para telefone.
- Link WhatsApp apenas com número válido e normalizado.
- Link do site com HTTPS quando possível.
- Link de mapa.
- Não mascarar links nem redirecionar sem informar o destino.

### 7.4 Cadastro e reivindicação

- Usuário envia pedido.
- Sistema valida campos e localidade IBGE.
- Solicitação entra em `pending_verification`.
- Administrador aprova, rejeita ou pede comprovação.
- Registrar auditoria: quem, quando, campo alterado, fonte e decisão.
- Verificação futura por e-mail do domínio, documento ou método equivalente.

### 7.5 Orçamento

- Visitante escolhe categoria.
- Informa descrição mínima e contato.
- Aceita política de contato.
- Pedido recebe protocolo.
- Fornecedores participantes recebem somente dados necessários e consentidos.
- Usuário pode cancelar contato.

### 7.6 Administração

- Painel de empresas pendentes.
- Fila de correções e remoções.
- Fila de denúncias.
- Logs de importação.
- Histórico de fonte/data.
- Bloqueio de duplicatas.
- Exportação administrativa controlada.

## 8. Fontes de dados

### Fonte atual

- OpenStreetMap/Overpass.
- Licença ODbL 1.0.
- Cidade-piloto atual: 1.502 registros coletados.
- Dados atuais encontrados: 379 telefones, 377 links WhatsApp derivados, 155 sites e 1.061 endereços.
- Cobertura limitada ao que foi mapeado.

### Fontes futuras

- Cadastro voluntário da empresa.
- Correções reivindicadas e verificadas.
- Dados governamentais abertos compatíveis com finalidade e licença.
- BrasilAPI, IBGE, CEP e outras fontes apenas após teste e validação.
- Google Places/Business Profile somente via API oficial autorizada e com termos, quota, atribuição, retenção e armazenamento revisados.

## 9. Regras de qualidade

- Deduplicar por combinação de nome normalizado, endereço, coordenada e fonte.
- Nunca transformar telefone automaticamente em WhatsApp confirmado: marcar como “WhatsApp provável” até confirmação, ou manter botão somente quando política permitir.
- Validar URL, telefone, CEP e código IBGE.
- Escapar conteúdo exibido para evitar XSS.
- Não exibir dado vazio como se fosse confirmado.
- Mostrar `última atualização`.
- Manter origem do dado por registro.
- Criar rotina de dados desatualizados.
- Permitir correção e remoção.

## 10. Arquitetura alvo

### MVP

- Frontend estático rápido.
- JavaScript sem framework pesado enquanto o volume permitir.
- API serverless Vercel.
- JSON/SQLite/Postgres compatível para catálogo, conforme necessidade.
- Funções separadas para empresas, localidades, reivindicações e importação.

### Escala

- Banco relacional com índices por `ibge_code`, `state_slug`, `city_slug`, `category_slug` e busca textual.
- Armazenamento de fontes e snapshots.
- Fila de importação idempotente.
- Cache de consultas públicas.
- Rate limiting.
- Observabilidade de erros, latência e quota.
- CDN para páginas públicas.

### Rotas

```text
/                         homepage
/uf/cidade                página da cidade
/uf/cidade/categoria      listagem de categoria
/uf/cidade/bairro         listagem de bairro
/uf/cidade/categoria/empresa página individual
/api/companies            busca/listagem
/api/company              detalhe
/api/claim                reivindicação/correção
/api/import               importação protegida
/sitemap.xml              sitemap público
/robots.txt               regras de crawler
```

## 11. Roadmap por fases

### Fase 0 — Produto e segurança

- [x] Definir Guarulhos como piloto.
- [x] Definir escala nacional.
- [x] Criar regras de fonte e compliance.
- [x] Criar PRD e roadmap.
- [ ] Validar nome no INPI.
- [ ] Consultar domínio Registro.br.
- [ ] Definir política de privacidade, termos e remoção.
- [ ] Definir responsável por moderação.

### Fase 1 — Fundação pública

- [x] Homepage responsiva.
- [x] Busca e categorias.
- [x] Cards de empresas.
- [x] Links telefone, WhatsApp, site e mapa conforme dados.
- [x] Base inicial OSM.
- [x] GitHub publicado.
- [ ] Deploy Vercel verificado.
- [ ] Domínio e HTTPS.
- [ ] Monitoramento básico.

### Fase 2 — Catálogo confiável

- [x] Código IBGE e slugs separados.
- [x] Modelo de página individual.
- [x] JSON-LD `LocalBusiness` e `BreadcrumbList`.
- [ ] Categorias canônicas.
- [ ] Bairros canônicos.
- [ ] Páginas de cidade/categoria/bairro.
- [ ] Sitemap por localidade.
- [ ] Importador OSM paginado.
- [ ] Deduplicação robusta.
- [ ] Log de fonte/data por empresa.
- [ ] Atualização periódica.

### Fase 3 — Cadastro e confiança

- [x] Estrutura de reivindicação/correção.
- [x] Sanitização e validação básica.
- [ ] Login seguro.
- [ ] Cadastro de usuário.
- [ ] Cadastro voluntário de empresa.
- [ ] Verificação de e-mail.
- [ ] Painel da empresa.
- [ ] Moderação administrativa.
- [ ] Fluxo de remoção LGPD.
- [ ] Auditoria completa.

### Fase 4 — Orçamento e leads

- [ ] Formulário de orçamento.
- [ ] Consentimento específico.
- [ ] Protocolo de solicitação.
- [ ] Roteamento por categoria/localidade.
- [ ] Painel de leads.
- [ ] Cancelamento de contato.
- [ ] Métricas agregadas sem vender dados pessoais.

### Fase 5 — Monetização responsável

- [ ] Página premium identificada como anúncio.
- [ ] Destaque por categoria/bairro.
- [ ] Planos empresariais.
- [ ] Pagamento seguro.
- [ ] Nota/recibo e cancelamento.
- [ ] Termos comerciais.
- [ ] Nenhum ranking pago disfarçado de orgânico.

### Fase 6 — Google autorizado e novas fontes

- [ ] Avaliar Google Places API oficial.
- [ ] Restringir chave, APIs, domínio e quota.
- [ ] Definir retenção e atribuição.
- [ ] Testar consulta por categoria/área.
- [ ] Comparar com OSM sem misturar fontes silenciosamente.
- [ ] Nunca alegar cobertura total.

### Fase 7 — Expansão nacional

- [ ] Importar catálogo IBGE completo.
- [ ] Ativar páginas por UF/município.
- [ ] Criar fila de importação por prioridade.
- [ ] Expandir categorias e bairros.
- [ ] Criar painéis por estado.
- [ ] Medir cobertura e frescor por município.
- [ ] Escalar banco, cache, CDN e observabilidade.

## 12. Critérios de aceite MVP

- Busca retorna somente registros existentes.
- Empresa sem telefone não recebe telefone inventado.
- WhatsApp abre número correto quando existente.
- Site abre URL correta quando existente.
- Mapa abre coordenada/endereço correto.
- Fonte, licença e limitação aparecem na interface.
- Correção/remoção possui canal funcional.
- Dados são escapados contra XSS.
- Rotas nacionais validam IBGE.
- JSON-LD não declara dados inexistentes.
- Mobile e desktop funcionam.
- Testes automatizados passam.
- GitHub contém commit verificável.
- Deploy Vercel responde com HTTPS.

## 13. Métricas

- Empresas válidas por município.
- Percentual com endereço, telefone, WhatsApp, site e coordenadas.
- Data média da atualização.
- Buscas por categoria/localidade.
- Cliques em telefone, WhatsApp, site e mapa.
- Solicitações de correção e tempo de atendimento.
- Solicitações de orçamento com consentimento.
- Erros de API e tempo de resposta.
- Duplicatas detectadas.
- Cobertura declarada por município.

## 14. Riscos e respostas

- **OSM incompleto:** mostrar cobertura e criar cadastro/reivindicação.
- **Overpass limitado:** cache, importação responsável e instância autorizada.
- **Telefones desatualizados:** data, denúncia e correção.
- **Spam/falsos cadastros:** moderação, rate limit e verificação.
- **LGPD:** minimização, consentimento, remoção e política clara.
- **Google quota/termos:** somente API oficial e sem exportação indevida.
- **Custo de escala:** começar estático, medir e migrar por necessidade.
- **Marca indisponível:** validar INPI/domínio antes de investimento alto.

## 15. Próxima execução prioritária

1. Corrigir e validar a homepage inspirada no fluxo de marketplace B2B.
2. Adicionar modal/página de detalhe por empresa.
3. Exibir todos contatos disponíveis com fonte e data.
4. Criar páginas de categoria.
5. Rodar testes e revisão de segurança.
6. Commitar e publicar no GitHub.
7. Fazer deploy Vercel após autenticação.
