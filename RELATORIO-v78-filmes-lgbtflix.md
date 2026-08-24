# Relatório v78 — catálogo experimental de filmes do LGBTFlix

## Arquitetura e integração

O Mural Cultural usa uma aplicação única em `index.html`, com painel rotativo no desktop e agenda em grade no celular ou por escolha do usuário. Eventos, livros, cursos e concursos compartilham `js/app.js`; módulos testáveis ficam em `js/conteudos/`.

Filmes foi integrado como quinto conteúdo da Agenda, no mesmo seletor e na mesma grade progressiva. O catálogo não entrou no painel rotativo porque todos os registros ainda estão em revisão. Não foi criada uma página `filmes.html`.

## Dados e imagens

- Fonte: execução `2026-08-24_181419` do commit `2e52dba` do coletor.
- Base pública separada: `filmes.json`.
- Filmes: 143, todos com `status_manual: revisar`.
- Cartazes encontrados: 142.
- Filme sem cartaz: 1 (`Armário`), tratado com fallback neutro.
- Originais: 97.023.164 bytes (aprox. 92,53 MiB).
- WebPs otimizados: 3.644.104 bytes (aprox. 3,48 MiB).
- Redução: 96,24%.
- Limite: 800 px no maior eixo, sem ampliação e sem corte.
- Primeira execução: 142 imagens convertidas.
- Segunda execução: 0 convertidas e 142 reutilizadas.
- Falhas de conversão: 0.
- Vídeos baixados ou incorporados: 0.

O preparador reproduzível está em `scripts/preparar_filmes_lgbtflix.py`. Ele lê somente o commit informado, cria nomes estáveis derivados do ID e do conteúdo e não modifica o coletor.

## Interface

- Pesquisa por título, direção, sinopse, gênero e tema, sem diferenciar acentos ou caixa.
- Filtros combináveis por tema, gênero, letra, classificação, faixa de anos e duração.
- Ordenação por título, ano e duração, com campos desconhecidos sempre ao final.
- Contagem acessível, limpeza de filtros e estado vazio com ação de recuperação.
- Cards com cartaz, metadados, direção, etiquetas, link oficial seguro e carregamento tardio.
- Detalhes em um único `dialog` nativo, com fechamento por botão ou `Escape` e devolução do foco.
- Aviso de procedência e de que o Mural não hospeda os filmes.

## PWA e cache

O cache passou para `mural-cultural-v80-film-cards`. `filmes.json` usa a mesma estratégia `network-first` dos demais dados opcionais. Os cartazes não são pré-carregados: entram apenas sob demanda no cache limitado de imagens.

## Validação

Foram aprovados todos os sete testes `.test.cjs` e os dois testes Python do preparador. A inspeção em navegador real cobriu 1280×720, 820×1180 e 390×844, sem rolagem horizontal, imagens quebradas ou erros de console.

Também foram conferidos pesquisa sem acentos, filtros combinados, limpeza, estado vazio, cinco ordenações, os 143 itens após carregamento progressivo, fallback sem cartaz, diálogo, `Escape`, retorno de foco, segurança do link externo, mudança entre os cinco conteúdos, painel, QR Codes, manifesto e recursos do service worker.

### Ajuste responsivo dos cards

Os cards de filmes passaram a ter altura intrínseca ao conteúdo e imagem superior em `16 / 9`. As 142 imagens disponíveis são horizontais; o padrão usa `object-fit: cover`, e uma classe de orientação preserva imagens verticais ou atípicas futuras com `object-fit: contain`. No mobile, o card é uma coluna única, a imagem permanece estática e todo o texto vem abaixo dela. O painel alto de filtros de filmes também deixou de ficar fixo sobre os cards.

Foram feitas medições e capturas em 320, 360, 390, 412 e 480 px de largura, sempre com 844 px de altura, além de desktop em 1280×720. Em todas as larguras móveis, a largura rolável coincidiu com a largura útil, o primeiro card completo coube na tela e nenhuma interseção foi detectada entre imagem, metadados, título, direção, etiquetas, sinopse e ações. As evidências estão em `testes/capturas-filmes/`.

## Limitações e próximos passos

- A licença dos cartazes permanece não verificada.
- Todos os filmes continuam marcados para revisão; esta etapa não realiza curadoria nem publicação automática.
- A categoria selecionada não é gravada na URL porque a arquitetura atual do Mural não possui esse mecanismo para os demais conteúdos.
- Próximo passo recomendado: revisão humana de metadados, direitos dos cartazes e disponibilidade dos links antes de qualquer promoção ao site definitivo.
