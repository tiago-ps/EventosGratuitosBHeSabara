# Mural Cultural — v61.1 — dinâmica da Escola Livre de Artes

## Problema identificado

A Escola Livre de Artes possuía dois comportamentos diferentes:

- no Modo Painel, ao selecionar o programa, eram disponibilizados 93 registros detalhados;
- no Modo Agenda, ao selecionar apenas `Instituição / programa = Escola Livre de Artes Arena da Cultura`,
  a origem dos resultados ainda era o conjunto reduzido usado na rotação geral, resultando em cerca de 10 itens;
- no Painel sem filtros, além do slide geral, entravam seis resumos rotativos de centros culturais e
  alguns eventos específicos associados ao programa.

## Estrutura encontrada nos dados

No `eventos.json` analisado havia 118 registros associados à Escola Livre:

- 1 registro geral do programa;
- 25 resumos de unidades;
- 89 atividades individuais;
- 3 eventos específicos adicionais.

Os 25 resumos de unidades possuem `exibicao_por_filtro = false`.

## Nova regra

### Modo Painel — sem filtro

A Escola Livre é representada exclusivamente pelo slide geral:

`Inscrições abertas — Escola Livre de Artes Arena da Cultura`

Nenhum resumo de centro cultural, atividade individual ou evento específico associado
ao programa entra automaticamente na rotação geral.

### Modo Painel — filtro explícito da Escola Livre

Continua liberando o conjunto detalhado:

- 93 registros;
- 1 slide geral;
- 89 atividades;
- 3 eventos específicos;
- 0 resumos sintéticos de unidade.

### Modo Agenda — filtro explícito da Escola Livre

O filtro `Instituição / programa` agora ativa a mesma fonte detalhada utilizada pelos
demais filtros de exploração.

Resultado esperado: os mesmos 93 registros disponíveis no Painel filtrado.

### Modo Agenda — visão geral

A visão geral continua enxuta: a Escola Livre aparece apenas pelo registro geral.
Para navegar por todas as atividades, o usuário seleciona explicitamente o programa,
uma categoria, um tema, um espaço ou faz uma pesquisa.

## Validação

Com o `eventos.json` da versão analisada em 07/08/2026:

- 194 registros ainda publicáveis;
- 118 registros publicáveis associados à Escola Livre;
- Painel sem filtro: 1 registro da Escola Livre;
- filtro Escola Livre: 93 registros detalhados;
- JavaScript validado com `node --check`;
- JSONs do site validados;
- Service Worker atualizado para `mural-cultural-v61.1`.

Esta versão altera apenas o site público.
