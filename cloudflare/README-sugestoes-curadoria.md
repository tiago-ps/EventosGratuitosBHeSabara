# Sugestões anônimas de curadoria

O Mural envia apenas os IDs estáveis dos conteúdos selecionados e uma mensagem opcional.
Não há campo de nome, e-mail, telefone, conta, localização ou identificador persistente do visitante.

## Bindings e variáveis do Worker

O Worker `cloudflare/social-preview-worker.js` espera:

- binding D1 `SUGESTOES_DB` (declarado no `wrangler.jsonc`, apontando para `mural-sugestoes-curadoria`)
- segredo `CURADORIA_ADMIN_TOKEN` para a fila privada do Editor
- `TURNSTILE_SITE_KEY` e segredo `TURNSTILE_SECRET` para proteção anti-bot
- `PUBLIC_HOSTNAME` com o host oficial esperado pelo Turnstile
- `SUGESTOES_DAILY_LIMIT` opcional; padrão 500 envios por dia

Crie o banco D1 e aplique `cloudflare/sugestoes-curadoria.sql` antes de ativar o formulário.

## Privacidade

A tabela grava somente protocolo, data/hora, status editorial, mensagem opcional,
quantidade, versão do esquema e IDs selecionados. O código não persiste IP,
User-Agent, fingerprint, geolocalização ou identificador do navegador.

O Turnstile é validado no servidor sem enviar o parâmetro opcional `remoteip`.

## Fluxo

`recebido -> em_analise -> aproveitado | descartado`

Nenhuma sugestão é publicada automaticamente.


## Consulta pública por protocolo

O usuário pode consultar somente o andamento de uma sugestão em:

`GET /api/sugestoes-curadoria/status?protocolo=SUG-XXXX-XXXX`

A resposta pública contém apenas:
- protocolo;
- status e rótulo público;
- data de recebimento;
- data da última atualização, quando houver.

A consulta pública não retorna mensagem, IDs enviados, quantidade, dados do Editor ou qualquer informação interna da curadoria. O protocolo funciona como uma chave de consulta; não há login nem cadastro.


## Contribuições gerais da comunidade

O mesmo Worker e o mesmo banco D1 atendem também dois formulários independentes da fila de curadoria:

- `sugerir_evento`: sugestão de um novo evento, com título, cidade/data opcionais, link de referência e observação;
- `corrigir_informacao`: correção de um conteúdo já publicado, preferencialmente identificado pelo ID estável do Mural;
- `opiniao_livro`: opinião contextual sobre um livro, usada como apoio editorial para `pergunta_curiosidade` e `texto_apoio`.

Endpoints:

- `GET /api/contribuicoes-comunidade/config`
- `POST /api/contribuicoes-comunidade`
- `GET /api/contribuicoes-comunidade/status?protocolo=CON-XXXX-XXXX`
- `GET/PATCH /api/contribuicoes-comunidade/admin...` (Bearer `CURADORIA_ADMIN_TOKEN`)

O Turnstile usa a ação `contribuir_mural`. A contribuição não exige cadastro e não grava IP, User-Agent, fingerprint, localização ou identificador persistente do visitante na tabela editorial.

Antes de ativar os formulários, aplique `cloudflare/contribuicoes-comunidade.sql` no mesmo D1 vinculado como `SUGESTOES_DB`.

Se `contribuicoes_comunidade` já existir com o schema anterior, aplique a migração D1 versionada antes de ativar `opiniao_livro` no ambiente remoto:

`npx wrangler d1 migrations apply mural-sugestoes-curadoria --remote`

O `wrangler.jsonc` usa `cloudflare/migrations` como `migrations_dir`; a primeira migração é `0001_opinioes_livros.sql`. O mecanismo nativo do D1 registra as migrações aplicadas, cria backup ao aplicar e reverte uma migração que falhar.


## Links curtos de seleções compartilhadas

O compartilhamento de favoritos pode usar links curtos do próprio domínio:

`https://temsimuai.com.br/s/XXXXXXX`

Endpoints:

- `POST /api/selecoes-compartilhadas` cria ou reutiliza um link curto;
- `GET /api/selecoes-compartilhadas/XXXXXXX` resolve a seleção;
- `GET /s/XXXXXXX` abre a seleção no Mural ou encaminha para o ambiente de curadoria de livros quando o contexto for `curadoria_livros`.

Antes de ativar os links curtos, aplique `cloudflare/selecoes-compartilhadas.sql` no mesmo D1 vinculado como `SUGESTOES_DB`.

A tabela guarda somente código aleatório, data/hora, contexto, quantidade, hash de deduplicação, versão do esquema e os IDs estáveis selecionados. Não grava IP, User-Agent, fingerprint, localização, nome, e-mail ou conta. Seleções idênticas no mesmo contexto reutilizam o mesmo código para evitar armazenamento desnecessário.

`SELECOES_COMPARTILHADAS_DAILY_LIMIT` é opcional; o padrão é 3000 novos registros por dia. Quando o serviço de link curto estiver indisponível, a interface mantém o formato legado como contingência.
