# Versão 58.3 — layout dinâmico dos livros

## Problema

O texto de apoio dos livros permanecia limitado a duas linhas, mesmo quando número de chamada, disponibilidade, temas, comentário ou botões ocupavam pouco espaço.

## Correção

- o texto de apoio pode utilizar até nove linhas em telas amplas;
- o limite é calculado novamente para cada livro;
- caixas de detalhes vazias são removidas e a caixa restante ocupa toda a largura;
- temas, comentários e botões ausentes deixam de reservar espaço;
- quando o conteúdo é maior, o slide reduz progressivamente linhas e espaçamentos;
- em último caso, utiliza modos compacto e muito compacto sem ultrapassar a área do card;
- o ajuste é repetido após o carregamento das fontes e ao redimensionar a janela.

A alteração não muda `livros.json`, o editor nem o fluxo de coleta.
