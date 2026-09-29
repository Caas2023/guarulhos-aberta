# Guarulhos Aberta

Diretório local de empresas e serviços de Guarulhos/SP.

## Estado atual

- Interface responsiva criada.
- Busca, filtros por categoria e fallback demonstrativo funcionando no navegador.
- Consulta ao endpoint local pode usar OpenStreetMap/Overpass como fonte aberta de fallback; interface mostra fonte, licença, data e cobertura limitada.
- Não afirmar cobertura total: OSM depende do que foi mapeado e não representa todas as empresas.

## Desenvolvimento local

Servidor estático simples:

```bash
python -m http.server 4173
```

Acesse `http://localhost:4173`.

Para endpoint ao vivo, deploy em Vercel. O fallback OSM não exige chave. O arquivo `.env.example` é apenas referência e não contém segredo.

## Modelo nacional de localidade

O piloto usa `municipalityId` e `stateId` do IBGE, mantendo nomes exibidos separados dos slugs de URL. `lib/localities.js` valida o catálogo e gera a hierarquia `/estado/cidade/categoria/empresa`, permitindo adicionar municípios sem alterar a estrutura.

Testes do modelo:

```bash
node --test
```

## Deploy

1. Criar repositório GitHub `guarulhos-aberta`.
2. Subir arquivos deste diretório.
3. Importar o repositório na Vercel.
4. Testar `/api/places?query=óticas` e a busca da interface.
5. Monitorar limites do Overpass e, para volume, usar provedor/instância OSM autorizada.

## Compliance

Não raspar Google Maps. Dados Google só devem entrar via API oficial autorizada, quando configurada. O fallback usa OpenStreetMap/Overpass sob ODbL, com atribuição e cobertura limitada. Oferecer correção/remoção e não publicar dados pessoais sem base legal.

## Design

- Nome: Guarulhos Aberta
- Fundo: marfim `#f7f4ed`
- Azul-petróleo: `#123b4a`
- Ação: laranja `#ee7044`
- Status: verde `#4e9c72`
## Limitações pendentes

- GitHub remoto não configurado nesta sessão: não há token/remote autenticado.
- Vercel não publicado: CLI instalada, mas sessão está deslogada.
- Google Business não importado: sem API oficial e sem autorização para exportação por scraping.
