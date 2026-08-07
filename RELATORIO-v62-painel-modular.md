# Mural Cultural — v62 — Painel modular

## Objetivo

Transformar o Modo Painel em uma composição de programação, em vez de aplicar
um único filtro de conteúdo a toda a exibição.

Isso permite, por exemplo, que uma instalação futura no IFMG Betim exiba:

- eventos de Belo Horizonte e Betim;
- livros do acervo do IFMG Betim;
- sem que o filtro de cidade dos eventos interfira no acervo dos livros.

## Nova interface do Modo Painel

O antigo seletor `Conteúdo: Todos / Eventos / Livros` foi substituído por módulos
independentes:

- Eventos;
- Livros.

Os dois podem ficar ativos simultaneamente ou apenas um deles pode ser usado.

### Configuração geral

Aplica-se aos módulos ativos:

- Tema;
- Tempo dos slides.

### Eventos

Possui configuração própria:

- seleção múltipla de cidades;
- Categoria / linguagem;
- Instituição / programa;
- Espaço;
- Frequência na rotação.

As cidades são descobertas dinamicamente a partir de `eventos.json`.
Na base atual foram detectadas:

- Belo Horizonte;
- Sabará.

Quando novas cidades, como Betim, passarem a existir nos dados, elas aparecerão
automaticamente na interface.

### Livros

Possui configuração própria:

- seleção múltipla de Campus / acervo;
- Forma de acesso;
- Frequência na rotação.

O site procura o campus/acervo nos campos específicos do livro, quando existirem,
e também consegue inferi-lo pelo campo `fonte`.

Na base atual, os nove livros publicados são identificados como:

- IFMG Sabará.

Para um futuro acervo de Betim, basta que os registros tragam um campo de campus,
biblioteca/acervo ou uma `fonte` que identifique o IFMG Campus Betim.

## Frequência dos módulos

Cada módulo recebe um peso de 1 a 10.

O padrão atual é:

- Eventos: 5;
- Livros: 1.

Isso preserva a lógica aproximada de cinco eventos para cada sugestão de leitura,
mas agora o usuário pode ajustar a proporção diretamente na interface.

## Persistência da programação

Ao clicar em `Aplicar programação`, a configuração é salva no `localStorage` do
navegador.

Assim, a TV ou computador configurado mantém sua própria programação mesmo após
fechar ou recarregar o site.

Se nenhuma cidade/campus for restringido, o sistema interpreta a opção como
"todos", inclusive futuros valores que sejam adicionados aos dados.

## Perfis do painel

A interface permite salvar configurações com nomes como:

- IFMG Sabará;
- IFMG Betim;
- Biblioteca;
- Recepção;
- Semana temática.

Os perfis ficam armazenados localmente no navegador.

O código também aceita a estrutura opcional `perfis_painel` em
`configuracao-mural.json` para uma futura distribuição institucional de perfis
pré-configurados.

Também existe suporte a `?perfil=nome-do-perfil`. O site procura um perfil local
ou pré-configurado cujo nome gere esse identificador. Um perfil chamado
`IFMG Betim`, por exemplo, pode ser solicitado por `?perfil=ifmg-betim`.

## Escola Livre de Artes

A correção da v61.1 foi preservada.

Com os dados atuais:

- Modo Painel sem filtro: exatamente 1 slide da Escola Livre, o slide geral;
- filtro explícito `Escola Livre de Artes Arena da Cultura`: 93 registros detalhados.

O antigo rodízio automático dos resumos de unidades deixou de ser executado no
fim de cada volta do Painel.

## Modo Agenda

A Agenda não passou a usar a configuração local do Painel.

Ela continua sendo uma ferramenta de exploração independente:

- Todos;
- Eventos;
- Livros;

com os filtros contextuais introduzidos na v61.

## Testes realizados

Além de validação sintática com `node --check`, foi executado um teste funcional
em Chromium headless com os JSONs atuais.

Resultados:

- nenhum erro JavaScript durante os cenários testados;
- cidades detectadas: Belo Horizonte e Sabará;
- campus de livros detectado: IFMG Sabará;
- configuração "eventos apenas de BH + livros de Sabará": 83 itens,
  sendo 74 eventos de BH e 9 livros;
- Painel sem filtro da Escola Livre: 1 slide geral;
- Painel filtrado pela Escola Livre: 93 registros;
- modo somente Livros: funcionando;
- perfis no armazenamento local: funcionando;
- Modo Agenda preservado com Todos / Eventos / Livros.

## Arquivos alterados

- `index.html`
- `css/styles.css`
- `js/app.js`
- `service-worker.js`

O Service Worker foi atualizado para `mural-cultural-v62`.

## Coletor

Esta versão não exige alteração no repositório do coletor.

O `configuracao-mural.json` atual continua compatível. O suporte a configurações
mais detalhadas em `painel` e `perfis_painel` é opcional e poderá ser incorporado
ao coletor posteriormente, caso se queira distribuir perfis institucionais pelo
próprio repositório.
