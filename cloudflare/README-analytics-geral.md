# Estatísticas gerais do site — Cloudflare

A área **Estatísticas gerais** do Editor consulta os dados de tráfego já coletados pela Cloudflare para a zona do `temsimuai.com.br`.

## Arquitetura

O navegador do Editor não fala diretamente com a API da Cloudflare.

1. O Editor do PythonAnywhere chama `GET /api/analytics-geral/admin` no Worker usando o mesmo `CURADORIA_ADMIN_TOKEN` já usado pelas demais filas administrativas.
2. O Worker consulta a GraphQL Analytics API da Cloudflare.
3. O Worker devolve ao Editor apenas dados agregados.

A credencial de Analytics não é enviada ao PythonAnywhere nem ao navegador.

## Segredos do Worker

Configure no Worker:

- `CLOUDFLARE_ANALYTICS_TOKEN`: API Token somente de leitura para Analytics; armazene como **Secret** do Worker.
- `CLOUDFLARE_ANALYTICS_ZONE_ID`: Zone ID da zona `temsimuai.com.br`; ele não é uma credencial, mas também pode ser armazenado como **Secret** para manter a configuração fora do repositório e estável entre deploys.

O token não deve ser incluído no repositório.

Para o token, use uma permissão de leitura da Analytics API e restrinja os recursos à conta/zona necessária. A configuração recomendada pela Cloudflare para a GraphQL Analytics API é **Account → Account Analytics → Read**, com os recursos de zona limitados ao domínio que será consultado.

## Endpoint

`GET /api/analytics-geral/admin?inicio=AAAA-MM-DD&fim=AAAA-MM-DD`

O intervalo máximo é de 31 dias.

O retorno inclui:

- visitas;
- visualizações de páginas HTML bem-sucedidas;
- requisições HTTP;
- transferência de dados;
- evolução diária;
- páginas mais acessadas;
- países;
- dispositivos;
- quando disponíveis no schema/plano: navegadores, sistemas operacionais e hosts de referência.

As consultas usam `requestSource: "eyeball"`, excluindo subrequisições internas de produtos Cloudflare.

## Definições

- **Visitas**: usa a métrica `visits` da Cloudflare.
- **Visualizações de página**: contagem de respostas HTML com status 2xx/3xx.
- **Requisições**: contagem geral de requisições de usuários finais.
- **Dados transferidos**: `edgeResponseBytes`.

O dataset `httpRequestsAdaptiveGroups` pode aplicar amostragem adaptativa. Quando isso ocorrer, a Cloudflare já devolve os valores estimados; o Editor sinaliza que houve amostragem.


## Histórico preservado no D1

O Worker mantém uma cópia agregada diária em `analytics_geral_historico`. O armazenamento contém somente totais e rankings agregados do dia; não são gravados IP, cookies, identificadores persistentes ou eventos individuais.

Na primeira consulta administrativa após a implantação, se o histórico ainda estiver vazio, o Worker tenta fazer um backfill da janela recente ainda disponível na Cloudflare. Depois disso, o Cron Trigger diário já existente atualiza os dois dias anteriores para reduzir o risco de perder dados por atraso de consolidação.

A consulta administrativa pode usar até 366 dias por vez. Dias que não existem no arquivo aparecem como **sem histórico**, em vez de zero.

## Separação de audiência e varreduras

Os caminhos HTML são classificados de forma conservadora:

- **Mural**: caminhos públicos reconhecidos, como `/`, `/index.html`, links curtos `/s/...` e QR `/q/...`;
- **Varredura provável**: padrões de alta confiança, como `/.env`, credenciais, `.git`, Composer, WordPress, phpMyAdmin, Actuator e arquivos de configuração;
- **Outro HTML**: caminhos não reconhecidos que não são automaticamente classificados como ameaça.

A quantidade de varreduras é um **mínimo detectado**, pois o ranking diário arquiva apenas os principais caminhos retornados pela Cloudflare.
