# Livros, acervos e localizações — C2

Uma obra é um conteúdo único, identificado pelo ID do livro. Campus, biblioteca,
edição ou link adicional não justificam criar outra cópia da obra. Suas
localizações físicas e virtuais ficam em `acervos[]`, com os respectivos
`registros[]`.

## Contrato dos acervos e registros

- `biblioteca_rede` identifica a instituição/rede, por exemplo `IFMG`.
- `unidade` identifica o campus ou local específico já registrado, por exemplo
  `Campus Betim`, `Campus Ouro Branco`, `Campus Piumhi` ou `Campus Sabará`.
  Não preencher uma unidade por suposição. A biblioteca virtual já identificada
  usa `Biblioteca Virtual/Pergamum`, sem inventar um campus físico.
- `biblioteca` é o rótulo humano do acervo, como `IFMG — Campus Betim`.
  O modal atual usa esse rótulo e apresenta rede e unidade dos registros;
  não foi necessário alterar o frontend.
- Os registros devem repetir a rede e a unidade corretas do acervo a que
  pertencem, sem carregar uma localização genérica contraditória.

A mesma URL institucional pode servir a vários campi. Compartilhar uma URL
não torna duas localizações duplicadas e não autoriza fundi-las. Ao avaliar
duplicidade, considerar rede, unidade e os dados dos registros: tipo,
identificador, código de acervo e número de chamada.

Quando registros de localizações distintas repetirem um `registro_id`,
desambiguá-los com um sufixo estável da unidade, sem acentos. Exemplo:
`ifmg:busca:opusculo-humanitario:ouro-branco`. IDs já únicos são preservados;
um link de busca compartilhado permanece inalterado.

`consulta_catalogo` significa consulta, não exemplar confirmado. Preservar
`disponibilidade_confirmada: false` e as condições de acesso existentes.
A presença de um campus ou de uma URL não autoriza ativar `acesso_fisico`.
Esta etapa não envolve pesquisa bibliográfica nem confirmação de exemplares.

## Campos derivados persistidos

Por compatibilidade, os campos existentes continuam presentes e devem ser
recalculados a partir de `acervos`:

- `acervos_quantidade`: número de objetos em `acervos`.
- `registros_acervo_quantidade`: soma dos registros de todos os acervos.
- `bibliotecas`: rótulos de `acervos[].biblioteca`, sem repetições e na ordem
  em que aparecem. Não agrupar campi diferentes em um único rótulo genérico.

Resumos legados no nível do livro, como `biblioteca_rede` descrevendo vários
acervos, não são a identidade de uma localização. O contrato estruturado acima
se aplica a `acervos[]` e `registros[]`; esses resumos não foram reestruturados
em massa nesta etapa.

## Limites da etapa e decisão sobre O quinze

Por decisão explícita do projeto, **O quinze**, de Rachel de Queiroz, não existe
no IFMG. Não associar a obra ao IFMG nem a qualquer campus da rede, inclusive
como consulta genérica. Preservar os demais acervos. Scripts antigos não devem
restaurar essa associação.

UFMG e FUVEST continuam com livros completos em `complementos.livros`.
Nenhuma curadoria foi migrada para `membros`. Os catálogos centrais são a fonte
canônica prevista para os conteúdos; a curadoria não deve ser a origem
canônica futura dos dados de obras e acervos. O tratamento das obras ausentes
do catálogo e a migração dos vínculos ficam para a C3, sem antecipar cópias ou IDs.

`livros.json` foi auditado e preservado: seus 32 livros atuais pertencem a
Agosto Lilás, cujos conteúdos estão fora das alterações autorizadas na C2.
As variações legadas de rede/unidade desse conjunto permanecem para a etapa
posterior. Saúde Mental também permanece inalterada. A C2 não implementa o Editor.
