# Plano de segurança — site e PWA

Atualizado em: 2 de agosto de 2026  
Escopo auditado: `index.html`, `js/app.js`, `service-worker.js`, `manifest.webmanifest`, carregamento de `eventos.json`, links externos, imagens e funcionamento da PWA.

## Legenda

- [x] concluído nesta auditoria;
- [ ] pendente;
- **curto prazo**: fazer antes de ampliar a divulgação pública;
- **médio prazo**: fazer durante a consolidação do projeto;
- **longo prazo**: fazer quando o projeto tiver mais usuários, domínio próprio ou novas funções.

## Resultado geral

O site é estático, não possui login, pagamento, formulário próprio nem banco de dados no navegador. Isso reduz muito a superfície de ataque. Os riscos mais relevantes eram a inserção de conteúdo coletado por `innerHTML`, links com protocolos perigosos, dependência externa para o QR Code e manutenção indefinida de imagens no cache da PWA.

Nesta auditoria foram corrigidos os riscos diretamente tratáveis sem alterar a arquitetura do projeto.

# Curto prazo

## Conteúdo coletado e prevenção de XSS

- [x] **Escapar dados antes de inseri-los no HTML da agenda móvel.**

  Títulos, descrições, locais, categorias, horários e demais textos vêm de fontes externas e não devem ser tratados como HTML confiável. A versão anterior montava cartões com `innerHTML` e interpolava diretamente os campos do `eventos.json`. Um texto malicioso contendo tags ou atributos poderia ser interpretado pelo navegador. Agora os valores são convertidos em texto seguro antes da interpolação.

- [x] **Manter o modo painel usando `textContent` para campos textuais.**

  O modo painel já usava `textContent` na maior parte dos campos, o que é a opção correta. Esse comportamento deve ser preservado em alterações futuras.

- [ ] **Criar teste automatizado de segurança para conteúdo hostil.**

  Acrescentar um teste que carregue um evento com título como `<img src=x onerror=alert(1)>` e confirme que o texto aparece literalmente, sem criar elementos HTML. Isso evita que uma futura refatoração reintroduza XSS.

## Links e URLs

- [x] **Aceitar nos botões apenas links `http://` ou `https://`.**

  Links de programação, inscrição e mapa passam por validação no navegador. Protocolos como `javascript:`, `data:`, `file:` e `vbscript:` são rejeitados.

- [x] **Aplicar a validação também ao link e ao QR Code do modo painel.**

  A versão anterior validava o mapa, mas usava o link principal sem a mesma proteção. Agora o painel e a agenda móvel usam a mesma validação.

- [x] **Manter `rel="noopener noreferrer"` nos links abertos em nova aba.**

  Isso impede que a página externa use `window.opener` para manipular o site original.

- [ ] **Exibir o domínio do destino antes do clique.**

  Além do texto “Programação e inscrição”, mostrar algo como `form.jotform.com`, `sympla.com.br` ou `prefeitura.pbh.gov.br`. Isso ajuda o usuário a perceber redirecionamentos inesperados.

- [ ] **Adotar uma lista de domínios confiáveis para inscrições.**

  Não é recomendável bloquear imediatamente todo domínio desconhecido, porque há fontes legítimas variadas. Primeiro gerar relatório dos domínios presentes no `eventos.json`; depois separar domínios conhecidos, desconhecidos e proibidos. Links desconhecidos podem continuar disponíveis, mas com aviso visual.

## Política de Segurança de Conteúdo

- [x] **Adicionar uma Content Security Policy básica.**

  Foi incluída uma política por `<meta http-equiv="Content-Security-Policy">` que restringe scripts, conexões, objetos incorporados, formulários e URL-base. Como o GitHub Pages não permite configurar livremente todos os cabeçalhos HTTP, a política por meta é uma proteção parcial, mas útil.

- [ ] **Eliminar a permissão de script para `cdn.jsdelivr.net`.**

  O QR Code ainda depende de `qrcodejs` carregado pelo jsDelivr. O ideal é copiar a versão aprovada da biblioteca para `js/vendor/qrcode.min.js` e passar a usar apenas `script-src 'self'`.

- [ ] **Eliminar gradualmente `style-src 'unsafe-inline'`.**

  O site ainda usa estilos inline e alterações diretas de estilo. Removê-los permitiria uma CSP mais rígida. Não é urgente, mas melhora a proteção contra injeções de estilo.

## Service worker e cache

- [x] **Versionar o cache da auditoria.**

  A versão foi alterada para `agenda-cultural-v53.3-security`, forçando a remoção dos caches antigos controlados pelo aplicativo.

- [x] **Limitar o cache de imagens.**

  O cache agora mantém no máximo 80 imagens. Isso reduz uso de armazenamento e evita acúmulo indefinido de arquivos antigos.

- [x] **Não armazenar respostas que não sejam válidas.**

  O service worker verifica `response.ok`, origem e tipo básico de resposta antes de gravar no cache.

- [x] **Validar o tipo de conteúdo de `eventos.json` e das imagens.**

  O JSON só é atualizado no cache quando a resposta declara conteúdo JSON; imagens só são armazenadas quando o tipo começa com `image/`.

- [x] **Restringir a interceptação do service worker à própria origem.**

  Requisições externas não são interceptadas nem guardadas pelo service worker.

- [ ] **Mostrar aviso explícito quando dados antigos forem usados offline.**

  O site deve informar “Você está vendo a última versão salva neste aparelho” e exibir a data de atualização. Isso é importante porque inscrições, horários e cancelamentos podem mudar.

- [ ] **Criar aviso de nova versão disponível.**

  Quando um novo service worker estiver aguardando ativação, mostrar um botão “Atualizar agora”. Isso reduz o período em que alguém permanece numa versão antiga.

## Dependências externas

- [ ] **Hospedar localmente a biblioteca de QR Code.**

  Esta é a principal pendência técnica de curto prazo. Enquanto o script for carregado de um CDN, uma falha no fornecedor, na cadeia de distribuição ou na referência utilizada pode afetar o site.

- [ ] **Caso o CDN seja mantido temporariamente, usar Subresource Integrity.**

  Adicionar `integrity="sha384-..."` e `crossorigin="anonymous"` à tag do script. O hash deve ser calculado a partir do arquivo exato aprovado e conferido antes da publicação.

## GitHub e publicação

- [ ] **Ativar autenticação de dois fatores na conta GitHub.**

  A tomada da conta é o risco com maior impacto, pois permitiria alterar o JavaScript, o service worker, os links e os eventos publicados.

- [ ] **Confirmar “Enforce HTTPS” em Settings → Pages.**

  O GitHub Pages oferece HTTPS. A opção deve permanecer obrigatória, inclusive após adicionar domínio próprio.

- [ ] **Revisar todos os arquivos antes de publicar no repositório público.**

  Nunca enviar tokens, cookies, `.env`, relatórios privados, dados pessoais de estudantes, credenciais, arquivos de testes com segredos ou backups do editor.

- [ ] **Ativar proteção da branch principal.**

  Exigir ao menos revisão ou verificação antes de alterações nos arquivos críticos: `index.html`, `js/app.js`, `service-worker.js`, `manifest.webmanifest` e `eventos.json`.

# Médio prazo

## Integridade dos dados

- [ ] **Criar validação automática do `eventos.json` antes da publicação.**

  A validação deve conferir estrutura, tamanho máximo dos campos, datas, protocolos de URL, quantidade anormal de eventos e presença de HTML suspeito.

- [ ] **Gerar relatório de domínios externos.**

  Listar todos os domínios usados em `link`, `pagina`, `link_inscricao`, `mapa` e imagens. Mudanças inesperadas devem ser destacadas no workflow.

- [ ] **Marcar links externos visualmente.**

  Informar que a inscrição ocorre fora do aplicativo e que o site não solicita senha, CPF, cartão ou pagamento.

- [ ] **Adicionar página “Sobre, privacidade e segurança”.**

  Explicar quem mantém a agenda, quais dados são armazenados localmente, como remover o aplicativo, como limpar os dados e como informar evento falso ou link suspeito.

- [ ] **Adicionar canal “Informar erro ou problema de segurança”.**

  O canal deve aceitar relatos de evento cancelado, link fraudulento, imagem indevida, endereço incorreto e vulnerabilidade.

## Privacidade

- [ ] **Evitar imagens remotas sempre que possível.**

  Imagens remotas revelam ao servidor externo que o usuário abriu a página. A preferência deve continuar sendo armazenar cópias autorizadas no próprio repositório.

- [ ] **Documentar o uso de `localStorage` e Cache Storage.**

  Atualmente são guardadas apenas preferências de visualização, lote rotativo, interface, dados e imagens vistas. Não armazenar localização, histórico pessoal ou dados de inscrição sem necessidade e informação clara.

- [ ] **Não implementar notificações push sem política específica.**

  Notificações aumentam o risco de spam e phishing. Só devem ser adicionadas quando houver finalidade clara, consentimento e mecanismo fácil de cancelamento.

## Auditoria contínua

- [ ] **Executar auditoria semestral do frontend.**

  Revisar usos de `innerHTML`, scripts externos, permissões da PWA, alterações de cache, links e armazenamento local.

- [ ] **Adicionar ferramenta automática de análise.**

  Avaliar CodeQL, Dependabot e uma verificação de segurança do site em ambiente de teste. Alertas devem ser revisados, não apenas ativados.

# Longo prazo

- [ ] **Usar domínio próprio verificado no GitHub.**

  Verificar o domínio na conta GitHub antes de associá-lo ao Pages. Evitar registros DNS curingas. Ao desativar o site, remover imediatamente os registros DNS para evitar tomada de domínio.

- [ ] **Separar publicação e código-fonte se o projeto crescer.**

  Um workflow pode gerar apenas os arquivos estáticos necessários e publicá-los numa branch ou artefato dedicado, mantendo relatórios, ferramentas e materiais internos fora do site público.

- [ ] **Migrar para hospedagem com cabeçalhos HTTP configuráveis se necessário.**

  Isso permitiria CSP por cabeçalho, `Permissions-Policy`, `Referrer-Policy`, `X-Content-Type-Options` e políticas adicionais mais fortes que a meta tag.

- [ ] **Preparar procedimento de resposta a incidente.**

  Definir como suspender o Pages, trocar credenciais, revogar tokens, limpar caches, publicar correção, avisar usuários e revisar histórico de commits em caso de comprometimento.

# Arquivos alterados nesta auditoria

- `index.html`: CSP e remoção do script inline de registro da PWA;
- `js/app.js`: escape de conteúdo externo, validação de links e imagens, registro do service worker;
- `service-worker.js`: cache versionado, validação de respostas e limite de imagens;
- `SEGURANCA.md`: este plano.
