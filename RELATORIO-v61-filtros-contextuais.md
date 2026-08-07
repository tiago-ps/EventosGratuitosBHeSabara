# Mural Cultural — v61 — filtros contextuais

## Objetivo

Separar os filtros conforme o modo de visualização e o tipo de conteúdo, evitando
controles sem sentido para livros, eventos ou para a visão geral.

## Modo Painel

A área principal de filtros ficou deliberadamente curta:

- Conteúdo: Todos, Eventos ou Livros
- Tema
- Tempo dos slides

Ao escolher **Eventos**, o botão `Mais filtros` disponibiliza:

- Cidade
- Categoria / linguagem
- Instituição / programa
- Espaço

Ao escolher **Livros**, `Mais filtros` disponibiliza:

- Forma de acesso: físico, virtual ou ambos

Em `Conteúdo: Todos`, filtros específicos não são exibidos.

## Modo Agenda

### Conteúdo: Todos

Exibe somente filtros universais:

- Pesquisa
- Conteúdo
- Tema

Os resultados deixam de ser misturados numa única sequência e passam a ser
organizados em seções:

- Agenda Cultural
- Sugestões de Leitura

Cada seção informa sua quantidade e possui atalho para `Ver somente eventos` ou
`Ver somente livros`.

### Conteúdo: Eventos

Exibe:

- Pesquisa
- Conteúdo
- Tema
- Quando
- Cidade
- Categoria / linguagem
- Espaço
- Instituição / programa
- Inscrição

O filtro `Quando` inclui:

- Hoje
- Amanhã
- Este fim de semana
- Próximos 7 dias
- Próximos 30 dias

O filtro de inscrição inclui:

- Inscrições abertas
- Sem inscrição informada
- Inscrições encerradas

### Conteúdo: Livros

Exibe:

- Pesquisa
- Conteúdo
- Tema
- Acesso

## Tema transversal

O campo `Tema` é comum a diferentes linguagens. Nos livros são usados os valores
de `temas`. Nos eventos o site aproveita `temas`, quando esse campo vier a existir,
e atualmente também considera tags temáticas e áreas artísticas disponíveis nos
dados. Tags meramente estruturais, como `Curso`, `Escola Livre de Artes` e
`Formação artística`, são excluídas da lista temática.

Isso deixa o site preparado para futuras curadorias como africanidades, saúde
mental, meio ambiente, memória e outros temas que possam reunir eventos, livros,
filmes, jogos e passeios.

## Resultados e usabilidade

- mostra quantidade total de resultados;
- mostra número de filtros ativos;
- oferece `Limpar filtros` quando necessário;
- preserva filtros específicos enquanto o usuário alterna entre tipos de conteúdo,
  mas eles só são aplicados quando aquele conteúdo está selecionado;
- o título bibliográfico dos livros permanece amarelo no modo Agenda;
- o controle de duração saiu do modo Agenda, pois não há slides nessa visualização,
  permanecendo disponível no modo Painel.

## Cache

O Service Worker foi atualizado para `mural-cultural-v61`.

## Validação

- `node --check js/app.js`: aprovado;
- `eventos.json`, `livros.json` e `configuracao-mural.json`: JSON válido;
- referências antigas aos filtros `bookTheme` e `agenda-slide-duration` removidas;
- o repositório do coletor/editor não precisa ser alterado por esta versão.
