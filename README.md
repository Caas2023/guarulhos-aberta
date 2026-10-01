# Guarulhos Aberta

Diretório nacional de empresas, com Guarulhos/SP como cidade-piloto.

## Estado atual

- Interface responsiva com busca, filtros por categoria e cards de empresas.
- Base real: 1.502 registros do município de Guarulhos obtidos de OpenStreetMap/Overpass.
- Contatos encontrados: 379 telefones, 377 links WhatsApp, 155 sites e 1.061 endereços.
- Cards mostram telefone, WhatsApp, site e mapa quando o dado existe na fonte.
- Fonte, licença ODbL, data e cobertura limitada devem permanecer visíveis.
- Não afirmar cobertura total: OSM depende do que foi mapeado e não representa todas as empresas.

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
node test/localities.test.js
node test/routing.test.js
node test/schema_generator.test.js
node test/sitemap.test.js
node test/claim.test.js
node test/category.test.js
```

Suíte completa (26 testes por módulo, 76+ no total).

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

