# EventosGratuitosBHeSabara — v63.2 — obras com múltiplos acervos

## Alterações

- compatibilidade com `livros.json` v2 e seu campo `acervos`;
- modo Agenda mostra uma única obra e a seção **Onde encontrar**, organizada por
  biblioteca/acervo;
- cada registro de catálogo mantém seu próprio número de chamada e link;
- se uma biblioteca possui várias edições/registros, todos os links podem ser abertos
  separadamente;
- modo Painel continua com uma única exibição da obra e resume os acervos disponíveis;
- filtros de Campus/acervo reconhecem qualquer um dos acervos vinculados à obra;
- a pesquisa da Agenda também encontra biblioteca, número de chamada e código de acervo;
- livros.json v1 continua funcionando por conversão interna para um único acervo;
- cache PWA atualizado para `mural-cultural-v63.2-obras-multiacervo`.

## Validação

- `node --check js/app.js`: aprovado;
- `node --check service-worker.js`: aprovado;
- compatibilidade legada preservada no JavaScript;
- teste do coletor com a base operacional confirmou estrutura com múltiplos acervos.
