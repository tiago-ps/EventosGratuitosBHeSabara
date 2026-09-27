# Sugestões anônimas de curadoria

O Mural envia apenas os IDs estáveis dos conteúdos selecionados e uma mensagem opcional.
Não há campo de nome, e-mail, telefone, conta, localização ou identificador persistente do visitante.

## Bindings e variáveis do Worker

O Worker `cloudflare/social-preview-worker.js` espera:

- binding D1 `SUGESTOES_DB`
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
