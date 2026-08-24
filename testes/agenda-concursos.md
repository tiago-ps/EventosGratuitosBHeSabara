# Validação das Etapas B e C — Concursos na Agenda

Data: 23/08/2026
Baseline de comparação: `bc981ce0eeff725008fa80d130dbbd33420d4dbc`

## Dados e estado

- `concursos.json` contém 27 registros e os 27 atendem ao contrato público mínimo de título e URL.
- O carregamento usa a mesma estratégia opcional de Livros e Cursos; indisponibilidade ou formato inválido resulta em catálogo vazio sem tornar `eventos.json` indisponível.
- `evidencias_formacao` é removido na criação do registro público e não aparece no DOM da Agenda.
- Configurações antigas continuam habilitando Concursos por omissão; somente `modulos.concursos: false` desabilita a seção.
- Perfis e composição do Painel não receberam campos de Concurso nesta etapa.

## Agenda integrada

- Todos: 1.170 conteúdos.
  - Agenda Cultural: 92 cards.
  - Sugestões de Leitura: 10 cards.
  - Cursos Online Gratuitos: 1.041 cards.
  - Concursos públicos: 27 cards.
- Concursos selecionado: 27 de 27 cards, sem limite de 15.
- Busca por `Caraguatatuba`: 1 resultado.
- Formação `Técnico em Informática`: 16 resultados.
- UF `MG`: 16 resultados.
- Formação `Técnico em Informática` + UF `MG`: 9 resultados.
- Prazo `Com data de inscrição`: 27 resultados.
- Prazo `Sem data informada`: 0 resultados e estado vazio exibido.
- Limpar filtros conserva o modo Concursos e restaura os 27 cards.
- 27 links `Ver concurso e edital ↗` foram renderizados.
- Concurso da UENP com múltiplos cargos exibiu os dois cargos.
- Em viewport de 430 × 900, controles e cards ficaram em uma coluna, sem corte horizontal.

## Comparação com `concursos.html`

O protótipo e a Agenda integrada exibem o mesmo catálogo, as mesmas opções de formação e UF, as mesmas contagens para filtros isolados e combinados, e a mesma hierarquia de conteúdo nos cards: badges, título, localidade, inscrições, remuneração, cargos, fonte e chamada para o edital.

Diferenças intencionais da integração:

- cabeçalho, tipografia, cores e espaçamento seguem o Mural Cultural;
- o seletor `Conteúdo` permite retornar aos demais catálogos;
- a Agenda usa grade responsiva e o estado vazio padrão do Mural;
- imagens usam o tratamento seguro e o fallback do renderizador integrado;
- o protótipo permanece como página independente, com seu cabeçalho e sua grade próprios.

## Regressão de Eventos, Livros e Painel

- Eventos sem filtros específicos: 208 cards, igual ao baseline.
- Busca de Eventos por `Foto em Pauta`: 2 cards, igual ao baseline.
- Livros: 10 cards, igual ao baseline.
- Painel padrão: 102 itens, igual ao baseline.
- Próximo avançou de `1 de 102` para `2 de 102`; Anterior retornou ao mesmo título e à posição inicial.
- Pausar alterou o controle para Reproduzir; Reproduzir restaurou Pausar.
- Nenhum card ou rótulo de Concurso apareceu no Painel.
- Console do navegador: sem erros e sem avisos durante a rodada final.

## Verificações automatizadas

- `node testes/modulos-etapa-a.test.cjs`: aprovado.
- `node testes/concursos-agenda.test.cjs`: aprovado.
- `node --check js/app.js`: aprovado.
- `node --check js/conteudos/concursos.js`: aprovado.
- `node --check js/concursos.js`: aprovado.
- `node --check js/eventos-manuais-ui.js`: aprovado.
- `git diff --check`: aprovado.
