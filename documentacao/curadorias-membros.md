# Curadorias: membros canônicos e overlays contextuais (C1 e C3A)

Cada arquivo de curadoria pode incluir, opcionalmente:

```json
"membros": {
  "eventos": [],
  "livros": [],
  "cursos": [],
  "filmes": [],
  "utilidade_publica": []
}
```

Cada lista contém somente IDs, como strings ou números finitos. A resolução
compara sua representação textual exata, preservando maiúsculas e acentos.
Objetos de conteúdo não são aceitos como membros.

| Lista | Catálogo canônico | Campo de identidade |
| --- | --- | --- |
| `eventos` | `eventos.json` | `id` |
| `livros` | `livros.json` | `id` |
| `cursos` | `cursos.json` | `id_fonte` |
| `filmes` | `filmes.json` | `id` |
| `utilidade_publica` | `utilidade-publica.json` | `id` |

Por exemplo, `"cursos": ["410"]` seleciona o curso cujo `id_fonte` é `410`
no catálogo carregado. O conteúdo continua armazenado no catálogo central.

O carregador resolve os membros de todas as curadorias nas cópias em memória
dos catálogos, antes de aplicar overlays, fallbacks e complementos. Acrescenta
o ID da curadoria a `curadoria_ids` em runtime, sem duplicar conteúdos nem
alterar os arquivos canônicos. Um conteúdo pode pertencer a várias curadorias;
IDs repetidos na mesma lista não repetem a associação. Apenas a associação é
acrescentada: membros não modificam títulos, temas, imagens, URLs ou outros
dados editoriais.

O campo `membros` e suas listas podem ser omitidos. Listas vazias não acrescentam
associações; coleções desconhecidas são ignoradas. Formatos inválidos e IDs não
encontrados geram avisos e são ignorados sem interromper as outras associações.
Membros não resolvem IDs que existam apenas em complementos ou fallbacks de
overlays, mesmo que esses conteúdos pertençam a outra curadoria.

Overlays continuam aplicando alterações editoriais e complementos continuam
permitindo conteúdos ainda ausentes dos catálogos, com as regras existentes.
As associações de membros seguem a mesma separação entre vínculo de conteúdo
e período da campanha já usada pelo carregador: disponibilidade e promoção
continuam sendo decididas pelas regras existentes.

## Overlays editoriais contextuais — C3A

UFMG seleciona quatro livros e FUVEST nove por `membros.livros`. Seus antigos
livros completos foram retirados de `complementos.livros`, preservando os
complementos não literários da UFMG (Balé de Pé no Chão e Txai). Os 13 livros
canônicos estão ativos em `livros.json`.

O catálogo descreve a obra; `membros` registra a seleção pela curadoria;
`overlays` define sua apresentação editorial; `complementos` admite conteúdo
ainda ausente do catálogo. Para livros, a forma contextual é:

```json
"overlays": {
  "livros": {
    "sao-bernardo": {
      "titulo_esperado": "São Bernardo",
      "temas": ["Vestibular UFMG"],
      "editorial": {
        "pergunta_curiosidade": "Obra obrigatória do Seriado UFMG 2026 — Etapa 2.",
        "texto_apoio": "",
        "vestibular": {}
      }
    }
  }
}
```

`editorial` aceita somente `pergunta_curiosidade` e `texto_apoio` como strings
e `vestibular` como objeto. Outros campos são ignorados. Acervos, links, capas,
disponibilidade e fontes factuais permanecem no catálogo, fora desse objeto.
O exemplo acima ilustra o formato; a migração preserva integralmente os textos
editoriais originais nos arquivos de cada curadoria.

A integração armazena os campos permitidos em
`item.curadoria_overlays[curationId]`, somente em memória. Acrescentar outra
curadoria preserva as entradas anteriores; seus textos não sobrescrevem os
campos gerais da obra. Os temas do overlay continuam sendo unidos aos temas
integrados, sem substituir os existentes.

`window.MuralCultural.siteCurations.effectiveItemForCuration(item, curationId)`
retorna uma cópia independente do item. Se houver associação explícita em
`curadoria_ids` e overlay para o ID solicitado, aplica apenas os três campos
editoriais permitidos. Sem contexto ou overlay, retorna a cópia dos dados
gerais. O objeto recebido permanece inalterado, inclusive os campos aninhados.

O Painel usa o ID do perfil editorial ativo. A Agenda usa `state.mobileCuration`
antes da busca por livros e da renderização dos resultados: pergunta, texto de
apoio e temas integrados participam da busca. Com a opção Todas, usa os dados
gerais. A interseção Conteúdo + Curadoria permanece no filtro existente.

Nas curadorias com `membros`, `matchesCuration()` exige associação explícita;
temas não criam membership. Os overlays de livros dessas curadorias também
não acrescentam associações: elas vêm de `membros`. Complementos preservados
continuam recebendo sua associação em runtime. O fallback por tema e a
associação por overlays legados permanecem para curadorias sem membros formais.

`curadoria_ids` e `curadoria_overlays` não devem ser persistidos em
`livros.json`. Saúde Mental e Agosto Lilás não foram migradas: C3B/C3C, C4 e
Editor permanecem fora desta etapa. `status_editorial` foi preservado.

## Agosto Lilás — C3B

Agosto Lilás passa a ser a curadoria declarativa `curadorias/agosto-lilas.json`,
com ID permanente `agosto-lilas`, status aprovado e `permanente: true`. A entrada
no index e a disponibilidade no filtro Curadoria da Agenda valem o ano inteiro.
A promoção é independente da existência: `promocao_painel.meses: [8]` permite
banner e visual automático somente em agosto, acompanhando um item associado.
Fora desse mês, os conteúdos continuam disponíveis pelos filtros normais.

`membros` referencia conteúdos canônicos: 32 livros históricos anteriores à
C2.5A, 1 evento, 15 cursos (por `id_fonte`) e 20 filmes; utilidade pública fica
vazia. Os temas legados foram usados apenas como evidência para esta migração.
Nenhum membership desta curadoria depende de tema textual em runtime. Os 13
livros canonicalizados para UFMG/FUVEST não integram esse conjunto. Os catálogos
permanecem intactos; `curadoria_ids` é derivado em runtime, unindo associações.
`overlays` e `complementos` ficam explicitamente vazios, sem cópias dos conteúdos
nem novos textos editoriais. Conteúdo + Curadoria mantém a interseção existente.

O `perfil_painel` preserva as opções do perfil legado, inclusive o filtro
`theme: "agosto lilas"`, módulos, pesos e duração. O nome específico do perfil
é lido de `perfil_painel.nome`, com fallback para o nome da curadoria. A definição
builtin `agosto-lilas-2026` foi removida. O banner foi copiado byte a byte para
`imagens/curadorias/agosto-lilas/agosto-lilas-banner.svg`; o original foi mantido.

`perfil_visual` registra `agosto-lilas-glow` declarativamente, com ativação
automática e cor `#120626`, reutilizando o CSS compartilhado sem stylesheet novo.
O tema deixou de integrar `BASE_THEMES` e não há fallback sazonal fixo de 2026.
A infraestrutura existente de `isPromoted()` e a associação explícita do slide
controlam a promoção; o fallback visual é `padrao`.

Os JS/CSS, scripts e workflows históricos de Agosto Lilás foram preservados,
sem execução, para limpeza futura. Saúde Mental e UFMG/FUVEST não foram alteradas.
C3C, C4 e Editor permanecem fora desta etapa.
