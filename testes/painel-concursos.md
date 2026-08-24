# Validação — Concursos no modo Painel

Data: 23/08/2026
Baseline funcional: Painel padrão com 102 itens

## Composição e amostragem

- Programação somente com Concursos: 15 itens distintos.
- Duas voltas completas apresentaram os mesmos 15 títulos na mesma ordem.
- A amostra veio do catálogo público completo de 27 Concursos.
- Programação com todos os módulos ativos: 132 itens.
  - Eventos: 92.
  - Livros: 10.
  - Cursos: 15.
  - Concursos: 15.
- Painel padrão restaurado ao final: 102 itens, com Eventos e Livros ativos.

## Slide de Concurso

- Cada navegação cria um clone novo de `#slide-template`.
- Badges próprios: Concurso, UF e formação principal.
- Título, até dois cargos com indicação de vagas, inscrições, remuneração, localidade e formações foram exibidos.
- CTA `Ver concurso e edital` abriu a URL segura do registro em nova aba com `noopener noreferrer`.
- QR Code foi criado com o rótulo acessível `Ver este concurso por QR Code` e o mesmo destino do CTA.
- Imagem primária foi carregada; o código tenta a imagem reserva de Concursos e, se ambas falharem, exibe fallback visual próprio sem iframe.
- Layout validado em desktop e em viewport de 430 × 900.
- `evidencias_formacao` não integra a amostra pública do Painel.

## Transições e controles

- Evento → Concurso → Evento: aprovado em programação de 107 itens.
- Livro → Concurso → Livro: aprovado em programação de 25 itens.
- Curso → Concurso → Curso: aprovado em programação de 30 itens.
- Nenhuma badge, cópia ou classe específica do tipo anterior permaneceu após as transições.
- Próximo e Anterior retornaram à posição e ao título de origem.
- Autoplay com intervalo de 5 segundos avançou de Evento para Concurso.
- Pausa conservou posição e tipo durante espera superior ao intervalo configurado.
- Reproduzir retomou o avanço automático.

## Regressões

- Painel padrão: 102 itens, igual ao baseline.
- Eventos na Agenda: 208 cards; busca `Foto em Pauta`: 2 cards.
- Livros na Agenda: 10 cards.
- Concursos na Agenda: 27 cards, sem aplicação do limite do Painel.
- Cursos mantiveram o máximo existente de 15 no Painel.
- Console do navegador: sem erros e sem avisos.
- Configuração armazenada anteriormente, sem campos de Concurso, carregou normalmente e manteve Concursos desativados por padrão.

## Verificações automatizadas

- `node testes/modulos-etapa-a.test.cjs`: aprovado.
- `node testes/concursos-agenda.test.cjs`: aprovado, incluindo limite, unicidade e remoção de evidências na amostra do Painel.
- Verificação sintática de `js/app.js` e `js/conteudos/concursos.js`: aprovada.
- `configuracao-mural.json`: JSON válido.
- `git diff --check`: aprovado.
