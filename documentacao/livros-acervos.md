# Livros, acervos e localizações — C2 e C2.5A

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

Na C2, os 32 livros então existentes em `livros.json`, pertencentes a Agosto
Lilás, foram auditados e preservados. As variações legadas de rede/unidade
desse conjunto permanecem para uma etapa posterior. Saúde Mental também
permanece inalterada. Nenhuma dessas etapas implementa o Editor.

## Canonicalização no TESTE — C2.5A

O catálogo agora reúne **32 livros anteriores + 13 novos = 45 livros**.
Os 32 registros anteriores foram preservados integralmente, na mesma ordem.
As 13 obras acrescentadas usam os dados de `complementos.livros` de UFMG/FUVEST
após a C2. Seus acervos, registros, links, condições de disponibilidade e fontes
foram preservados; os contadores, `bibliotecas` e `registros_ids` foram derivados
dos acervos estruturados. Não houve nova pesquisa bibliográfica.

Os novos IDs canônicos são os slugs abaixo. O `id_obra` segue o formato
`obra-<id>-<hash de 8 caracteres>`. Para estas 13 obras, o sufixo corresponde aos
primeiros oito dígitos hexadecimais do SHA-256 de `id + "|" + autor_normalizado`,
em UTF-8. A normalização do autor usa NFKD, remove caracteres combinantes,
aplica `casefold` e reduz espaços consecutivos a um espaço, sem espaços nas
extremidades. Essa regra é determinística; os `id_obra` anteriores não mudaram.
Os identificadores atribuídos devem ser preservados em futuras sincronizações.

| ID canônico | id_obra |
| --- | --- |
| `sao-bernardo` | `obra-sao-bernardo-8312ff00` |
| `sobrevivendo-ao-racismo` | `obra-sobrevivendo-ao-racismo-b9f8fa73` |
| `o-quinze` | `obra-o-quinze-e4faba50` |
| `ideias-para-adiar-o-fim-do-mundo` | `obra-ideias-para-adiar-o-fim-do-mundo-e5e72014` |
| `opusculo-humanitario` | `obra-opusculo-humanitario-aa89f20c` |
| `nebulosas` | `obra-nebulosas-ef7f0010` |
| `memorias-de-martha` | `obra-memorias-de-martha-4a2353e9` |
| `caminho-de-pedras` | `obra-caminho-de-pedras-fc31546e` |
| `a-paixao-segundo-g-h` | `obra-a-paixao-segundo-g-h-e514c4c2` |
| `geografia` | `obra-geografia-304ec609` |
| `balada-de-amor-ao-vento` | `obra-balada-de-amor-ao-vento-cd282bc2` |
| `cancao-para-ninar-menino-grande` | `obra-cancao-para-ninar-menino-grande-96f0cf55` |
| `a-visao-das-plantas` | `obra-a-visao-das-plantas-894b1acb` |

As capas existentes foram copiadas, sem conversão, para
`imagens/livros/capas/<id>.<extensão real>`. São JPEG (`.jpg`) as capas de
São Bernardo, O quinze, Ideias para adiar o fim do mundo, Caminho de pedras,
Geografia e A visão das plantas, embora as origens tenham nome `.png`.
As outras sete são PNG. As cópias nas curadorias permanecem intactas;
nenhum crédito ou metadado de imagem sem fonte registrada foi inventado.

Os textos atuais são específicos dos vestibulares. Por isso os novos registros
canônicos usam `pergunta_curiosidade: ""`, `texto_apoio: ""` e `temas: []`, sem
metadados `vestibular` ou associações `curadoria_ids` persistidas. Os textos
editoriais e a vinculação às provas continuam nos complementos existentes.
O campo `qr_code` é opcional: o frontend já gera o QR a partir do link quando
necessário, portanto nenhum arquivo de QR Code foi criado.

### Transição sem duplicação visual

Os 13 novos registros usam temporariamente **`exibicao_ativa: false`**.
Painel e Agenda aplicam `bookIsPublishable`, que exclui esses registros da
exibição. O carregador recebe o catálogo completo antes desse filtro, portanto
os IDs continuam disponíveis para resolução. Os complementos mantêm seus IDs
legados distintos e continuam sendo exibidos pelo comportamento atual.

UFMG/FUVEST permanecem intactas em `complementos.livros`: nenhuma curadoria foi
migrada para `membros` e nenhum overlay novo foi criado. A C3 deverá ativar os
registros canônicos ao substituir os complementos por membros e preservar os
textos específicos da curadoria na camada editorial apropriada. Não remover
as capas antigas antes dessa migração e de uma verificação específica.

Os catálogos centrais são a fonte canônica dos conteúdos. Esta canonicalização
ocorreu somente no TESTE: **`ColetorEventosGratuitos` não foi atualizado**.
A sincronização com suas fontes persistentes permanece pendente para depois
da validação da arquitetura no TESTE. Até lá, uma sincronização legada que
sobrescreva `livros.json` pode apagar estas inclusões; preservar os 13 registros
e seus IDs ao planejar essa integração. Não executar pipelines antigos para
recriá-los. O repositório PÚBLICO também não foi alterado.
