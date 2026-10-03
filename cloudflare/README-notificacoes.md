# Notificações de eventos sem cadastro

O Mural usa Web Push para lembrar, por padrão, **1 dia antes** dos eventos
marcados como favoritos.

## Privacidade

Os favoritos e as preferências ficam somente no navegador, em IndexedDB.
O servidor **não recebe IDs de favoritos, títulos, categorias, localização,
nome, e-mail, telefone, conta ou User-Agent**.

Para entregar Web Push, o Worker precisa manter somente:

- o endpoint técnico da assinatura criado pelo navegador;
- a data do próximo sinal de lembrete (`AAAA-MM-DD`);
- metadados operacionais mínimos de criação/atualização e falhas.

A data é calculada no aparelho a partir dos favoritos locais. O servidor não
sabe a qual evento ela se refere.

## Fluxo

1. A pessoa toca em **Notificações > Ativar notificações**.
2. O navegador pede a permissão nativa.
3. A interface cria uma `PushSubscription`.
4. A interface calcula localmente a próxima data de lembrete e envia ao Worker
   apenas o endpoint técnico e essa data.
5. O cron diário do Worker envia um push vazio somente às assinaturas com
   lembrete vencendo naquele dia.
6. O Service Worker consulta os favoritos locais e o catálogo público,
   monta a notificação visível e calcula localmente a próxima data.
7. Assinaturas expiradas (HTTP 404/410 do serviço push) são removidas.

O push não é usado como sincronização silenciosa periódica: cada envio é
associado a uma data de lembrete e resulta em notificação visível.

## Endpoints

- `GET /api/notificacoes/config`: chave pública VAPID e disponibilidade;
- `POST /api/notificacoes`: cria/atualiza uma assinatura e a próxima data;
- `DELETE /api/notificacoes`: remove a assinatura.

O Worker prepara as tabelas automaticamente, mas
`cloudflare/notificacoes.sql` documenta o esquema e pode ser aplicado
manualmente.

## Chave VAPID

Na primeira configuração, o Worker gera um par P-256 e guarda a chave privada
operacional no D1. A chave pública é devolvida ao navegador. Isso evita exigir
cadastro ou segredos do visitante. Se futuramente for desejado, a chave privada
pode ser migrada para um Secret do Cloudflare sem mudar a interface pública.
