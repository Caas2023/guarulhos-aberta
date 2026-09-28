# Guarulhos Aberta

Diretório local de empresas e serviços de Guarulhos/SP.

## Estado atual

- Interface responsiva criada.
- Busca, filtros por categoria e fallback demonstrativo funcionando no navegador.
- Endpoint serverless preparado para Google Places API (New).
- Segredo protegido por `GOOGLE_MAPS_API_KEY`; nunca incluir chave no Git.
- Dados demonstrativos aparecem enquanto a API não estiver configurada.
- Não afirmar cobertura total: Google Places retorna resultados por consulta, área, paginação e quota.

## Desenvolvimento local

Servidor estático simples:

```bash
python -m http.server 4173
```

Acesse `http://localhost:4173`.

Para endpoint ao vivo, deploy em Vercel e configure `GOOGLE_MAPS_API_KEY` no painel/CLI. O arquivo `.env.example` não contém segredo.

## Deploy

1. Criar repositório GitHub `guarulhos-aberta`.
2. Subir arquivos deste diretório.
3. Importar repositório na Vercel.
4. Adicionar `GOOGLE_MAPS_API_KEY` como Environment Variable em Preview e Production.
5. Restringir a chave no Google Cloud por API, domínio e quota.
6. Testar `/api/places?query=óticas` e a busca da interface.

## Compliance

Usar Google Places API oficial. Não raspar Google Maps. Conferir preços, quota, FieldMask, atribuição, armazenamento e termos atuais antes de publicar base persistente. Exibir fonte e data de atualização. Oferecer canal para correção/remoção.

## Design

- Nome: Guarulhos Aberta
- Fundo: marfim `#f7f4ed`
- Azul-petróleo: `#123b4a`
- Ação: laranja `#ee7044`
- Status: verde `#4e9c72`
- Direção: editorial urbano, mapa noturno, mobile-first, escaneável.
