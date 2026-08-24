# Baseline da Etapa A — modularização para Concursos

Data da validação: 23/08/2026  
Commit inicial: `bc981ce0eeff725008fa80d130dbbd33420d4dbc`  
Branch inicial: `main`

O arquivo `INSTRUCOES_CODEX_CONCURSOS_MURAL.md` já aparecia como não rastreado antes da implementação. Nenhum outro arquivo estava modificado.

## Catálogos

- Eventos: 221 registros brutos; 208 exibidos na Agenda ao selecionar Eventos sem filtros.
- Livros: 10 registros.
- Cursos: 1.041 registros.
- Concursos: 27 registros.

## Painel padrão

- Programação padrão: 102 itens.
- Módulos ativos: Eventos e Livros.
- Cursos disponível no compositor, mas desativado por padrão.
- Pesos: Eventos 5, Livros 1, Cursos 1.
- Próximo avançou de `3 de 102` para `4 de 102`.
- Anterior retornou ao mesmo título e a `3 de 102`.
- Pausa alterou o controle para Reproduzir; Reproduzir restaurou Pausar.
- Ao restaurar a programação padrão, o Painel voltou a `1 de 102`.

## Agenda

- Todos: 1.143 conteúdos.
  - Agenda Cultural: 92 cards na seleção padrão.
  - Sugestões de Leitura: 10 cards.
  - Cursos Online Gratuitos: 1.041 cards.
- Eventos sem filtros específicos: 208 cards, após o aprimoramento de `js/eventos-manuais-ui.js`.
- Livros: 10 cards.
- Cursos: 1.041 cards.
- Busca de Eventos por `Foto em Pauta`: 2 cards.
- Busca de Cursos por `ética`: 62 cards de Curso; contador geral atual de 74 conteúdos.

O contador geral ao selecionar ou pesquisar Cursos já inclui correspondências de outros catálogos, embora a lista renderize somente Cursos. Esse débito preexistente não será corrigido na Etapa A.

## Cursos no Painel

- Somente Cursos ativo: `1 de 15`.
- Foram percorridos 15 títulos distintos.
- Uma segunda volta apresentou os mesmos 15 títulos na mesma ordem.
- Resultado: limite máximo de 15 e amostra estável durante a programação confirmados.

## Verificações técnicas

- `node --check js/app.js`: aprovado.
- `node --check js/eventos-manuais-ui.js`: aprovado.
- `node --check js/ios-install.js`: aprovado.
- Console do navegador após os testes: sem erros e sem avisos.

## Regressão após a modularização da Etapa A

- Painel padrão: 102 itens.
- Próximo/Anterior: mesmas posições e mesmo título ao retornar.
- Módulos e pesos: Eventos/Livros ativos, Cursos inativo; pesos 5/1/1.
- Agenda — Todos: 1.143 conteúdos, divididos em 92 Eventos padrão, 10 Livros e 1.041 Cursos.
- Agenda — Eventos: 208 cards.
- Agenda — Livros: 10 cards.
- Agenda — Cursos: 1.041 cards.
- Busca de Cursos por `ética`: mesmos 62 cards e contador preexistente de 74 conteúdos.
- Painel somente Cursos: 15 títulos distintos e segunda volta idêntica.
- Programação padrão restaurada ao final: `1 de 102`.
- Console: sem erros e sem avisos.
- `node testes/modulos-etapa-a.test.cjs`: aprovado.
