# Mural Cultural — v63 — QR geral do mural

## Objetivo

Adicionar ao Modo Painel um QR Code fixo para abrir o próprio Mural Cultural no celular,
sem confundi-lo com o QR Code específico de cada slide.

## QR superior — Mural Cultural

O cabeçalho do Painel agora exibe um QR menor e fixo, acompanhado dos textos:

- **Mural Cultural no celular**
- **Explore a agenda e outros conteúdos**

A URL não foi gravada manualmente no código. O site monta o endereço a partir de
`window.location`, portanto em produção o QR aponta para o endereço público em que o
Mural Cultural estiver sendo servido.

Exemplos:

- no GitHub Pages, aponta para o endereço do GitHub Pages em uso;
- se o projeto for movido para outro repositório/endereço e a página for aberta nesse
  novo endereço, o QR passa a usar esse novo endereço;
- se futuramente houver domínio próprio, o QR passa a usar o domínio próprio quando o
  site estiver sendo acessado por ele.

O QR geral remove:

- parâmetros da URL, como `?perfil=ifmg-betim`;
- âncoras, como `#agenda`;
- `index.html`, quando estiver explícito.

Assim ele sempre aponta para a porta de entrada do Mural Cultural e não para o estado
específico da TV ou daquela sessão.

## QR inferior — conteúdo do slide

O QR existente no rodapé permanece ligado ao conteúdo exibido e agora recebe um
rótulo explícito:

- Evento: **Abrir este evento**
- Livro: **Ver este livro**
- Filme: **Ver este filme**
- Jogo: **Ver este jogo**
- Passeio: **Ver este passeio**
- Outros tipos: **Abrir este conteúdo**

O QR inferior continua maior que o QR geral e permanece próximo do link do conteúdo.
Quando não existe QR/link utilizável, o bloco inferior é ocultado.

## Responsividade

O QR geral foi pensado para TVs e monitores:

- fica no canto superior direito;
- tem tamanho menor que o QR do conteúdo;
- em larguras intermediárias, o texto de apoio é reduzido;
- em telas de até 760 px, o QR geral é ocultado, pois o usuário já está navegando pelo
  próprio site no dispositivo.

## Cache

O Service Worker foi atualizado para `mural-cultural-v63`.

## Arquivos alterados

- `index.html`
- `css/styles.css`
- `js/app.js`
- `service-worker.js`

## Validação

- `node --check js/app.js`: aprovado;
- `eventos.json`, `livros.json` e `configuracao-mural.json`: JSON válido;
- preservada a lógica modular do Painel da v62;
- preservada a lógica contextual da Agenda;
- preservada a regra da Escola Livre de Artes da v61.1.
