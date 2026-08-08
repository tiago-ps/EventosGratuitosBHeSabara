# EventosGratuitosBHeSabara — v63.1 — compatibilidade Pergamum multiacervo

## Base preservada

Esta versão parte do site público v63 (`EventosGratuitosBHeSabara-v63-qr-mural.zip`).

As alterações Pergamum da cópia antiga v59 foram transplantadas manualmente, sem substituir os arquivos centrais pela versão antiga. Assim permanecem preservados:

- logo e cabeçalho atuais;
- filtros contextuais da Agenda;
- Painel modular e perfis locais;
- regra atual da Escola Livre de Artes;
- QR geral do Mural no topo;
- monitoramento e apresentação de formulários Google encerrados;
- layout dinâmico dos livros;
- configurações e dados públicos atuais.

## Alterações Pergamum incorporadas

- rótulo `Número de chamada · Sabará` alterado para `Localização no acervo`;
- livros podem exibir `Número de chamada: ... • Campus/Unidade`;
- o texto de outras edições físicas deixou de presumir Sabará;
- cards da Agenda mostram número de chamada e unidade quando disponíveis;
- identificação de Campus/acervo do Painel também considera `unidade` e `biblioteca_rede` publicados pelo coletor;
- cache atualizado para `mural-cultural-v63.1-pergamum`.

## Validação

- `node --check js/app.js`: aprovado;
- `eventos.json`, `livros.json` e `configuracao-mural.json`: JSON válido;
- funções v59 para inscrições/formulários Google continuam presentes;
- `eventos.json`, `livros.json`, `configuracao-mural.json`, CSS e logo permaneceram idênticos aos da v63.
