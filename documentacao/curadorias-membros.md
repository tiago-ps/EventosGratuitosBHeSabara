# Curadorias: membros canônicos (Etapa C1)

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

Esta etapa não migra UFMG, FUVEST, Saúde Mental ou Agosto Lilás, não altera
`status_editorial` e não cria uma interface no Editor. As associações legadas
continuam compatíveis; nenhuma associação nova deve ser persistida em
`curadoria_ids` dos catálogos para cadastrar membros.
