# Versão 57 — site Mural Cultural com livros

## Exibição integrada

O site passa a carregar três arquivos independentes:

- `eventos.json`;
- `livros.json`;
- `configuracao-mural.json`.

No modo padrão, o fluxo intercala um livro a cada nove eventos. A proporção pode ser alterada sem editar JavaScript.

## Slide de livro

O livro utiliza os mesmos controles, contador, transição, QR Code, responsividade e modo de pausa dos eventos, mas possui um renderizador próprio com:

- pergunta de curiosidade;
- texto de apoio;
- título e autor;
- número de chamada de Sabará;
- informação de acesso físico e virtual;
- temas;
- links para os catálogos;
- capa e QR Code armazenados localmente.

## Filtros

O painel permite selecionar:

- eventos e livros;
- somente eventos;
- somente livros.

Os filtros específicos de eventos e de livros são exibidos de acordo com o tipo selecionado. No celular, o modo de lista também inclui cards de livros.

## Compatibilidade

Se `livros.json` ou `configuracao-mural.json` estiverem ausentes, o site continua funcionando somente com eventos.

## Publicação inicial

A base incluída possui nove livros. `História e cultura afro-brasileira` não entrou porque o número de chamada de Sabará ainda não pôde ser confirmado.

## Validação

- JavaScript validado sintaticamente;
- nove capas e nove QR Codes presentes;
- teste em navegador automatizado sem erros de execução;
- filtros Eventos/Livros e layout móvel testados.
