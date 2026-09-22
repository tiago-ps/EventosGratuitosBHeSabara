# ATC4.6 — Relações de Eventos na interface

A interface carrega `relacoes-eventos.json` como conteúdo opcional.

O módulo `js/relacoes-eventos.js` mantém o parsing isolado do restante do
runtime e fornece índice por `evento_id`, organização e localização canônica.

Nesta etapa, `eventProgram(event)` mantém a seguinte precedência:

1. `programa` explícito do Evento;
2. nome da Instituição em `organizado_por`;
3. mapeamento legado de `instituicao_id`;
4. fonte textual.

A ausência ou indisponibilidade de `relacoes-eventos.json` não impede o
carregamento da Agenda/Painel. O fallback legado permanece durante a transição.

A localização textual exibida ao usuário (`event.local`) ainda não foi
substituída nesta etapa; ela continua sendo conteúdo de apresentação, enquanto
a identidade relacional passa a ser consumida pelo novo módulo.
