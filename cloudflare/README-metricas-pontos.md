# Métricas por ponto de divulgação

O Mural pode atribuir acessos e visualizações a um QR Code específico sem identificar a pessoa.

## URLs dos pontos iniciais

- Espaço do Conhecimento: https://temsimuai.com.br/q/espaco-conhecimento
- Museu da Pampulha: https://temsimuai.com.br/q/museu-pampulha
- IFMG Betim: https://temsimuai.com.br/q/ifmg-betim

O caminho /q/<ponto> redireciona para o Mural com a origem da visita. Qualquer slug simples em minúsculas pode ser usado para novos pontos.

## QR exibido pelo próprio painel

Para uma instalação física, abra o painel com ?ponto=<slug>, por exemplo:

https://temsimuai.com.br/?ponto=ifmg-betim

Os QR Codes gerados pelo painel passam a usar automaticamente /q/ifmg-betim, inclusive quando apontam para um conteúdo específico.

## Privacidade

O servidor grava apenas contagens agregadas por dia, ambiente, ponto, ação, tipo de conteúdo e ID do conteúdo. Não são gravados IP, user-agent, cookie, fingerprint, nome, e-mail, telefone ou identificador persistente.

O navegador usa apenas sessionStorage para deduplicar a sessão por até 30 minutos de inatividade. A origem é removida da URL visível após a entrada para evitar que seja compartilhada acidentalmente.

## Ações

- entrada: chegada por um QR daquele ponto;
- sessao_ativa: primeira interação do usuário naquela visita;
- visualizacao_conteudo: conteúdo que ficou pelo menos 60% visível por cerca de 800 ms, contado uma vez por sessão local.

## Relatório administrativo

GET /api/metricas-pontos/admin?inicio=AAAA-MM-DD&fim=AAAA-MM-DD

Usa o mesmo CURADORIA_ADMIN_TOKEN das filas administrativas. O retorno contém resumo por ponto e as linhas agregadas do período.
