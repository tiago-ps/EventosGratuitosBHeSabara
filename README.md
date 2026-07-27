# Agenda Cultural Gratuita — painel para TV

Site estático para GitHub Pages. A atualização semanal é feita substituindo apenas o conteúdo de `eventos.json`.

## Publicar no GitHub Pages

1. Crie um repositório público no GitHub.
2. Envie todos os arquivos e pastas deste projeto para a raiz do repositório.
3. Abra **Settings → Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha a branch `main` e a pasta `/ (root)`.
6. Salve e aguarde o endereço do site aparecer.

## Atualizar a programação

1. Peça ao GPT personalizado: `Gere o JSON do painel com os eventos gratuitos desta semana.`
2. Abra `eventos.json` no GitHub.
3. Clique no ícone de lápis.
4. Substitua todo o conteúdo pelo novo JSON.
5. Clique em **Commit changes**.

O site atualiza automaticamente após a publicação do commit.

## Formato obrigatório

```json
{
  "titulo_painel": "Agenda Cultural Gratuita",
  "periodo": "21 a 27 de julho de 2026",
  "atualizado_em": "2026-07-21T14:00:00-03:00",
  "tempo_slide": 12,
  "eventos": [
    {
      "id": "identificador-unico",
      "titulo": "Nome do evento",
      "data": "2026-07-23",
      "data_fim": "",
      "horario": "19h",
      "local": "Local",
      "cidade": "Belo Horizonte",
      "categoria": "Cinema",
      "gratuito": true,
      "inscricao": "Entrada gratuita",
      "descricao": "Descrição curta.",
      "imagem": "https://endereco-direto-da-imagem.jpg",
      "link": "https://link-oficial-do-evento",
      "mapa": "https://www.google.com/maps/search/?api=1&query=..."
    }
  ]
}
```

## Comportamento automático

- organiza os eventos por data;
- ignora eventos cuja data final já passou;
- troca de evento automaticamente;
- cria QR Code a partir do campo `link`;
- exibe **Abrir no Google Maps** quando o evento possui o campo `mapa`;
- mantém o QR Code apontando para a página oficial, não para o mapa;
- usa a imagem remota indicada no JSON;
- mostra uma arte genérica por categoria se a imagem estiver vazia ou falhar;
- adapta o layout a telas horizontais e verticais;
- não exige alterações no HTML, CSS ou JavaScript.

## Observação sobre imagens

Alguns sites bloqueiam a exibição externa de suas imagens. Quando isso acontecer, o painel usa automaticamente a arte genérica da categoria, sem quebrar o slide.


## Como funcionam as imagens

O campo `imagem` aceita:

- uma URL direta externa, como `https://site.org/banner.jpg`; ou
- um caminho local, como `imagens/banner.jpg`, caso você decida adicionar arquivos ao repositório.

Na rotina recomendada, o GPT fornece uma URL externa no JSON. Se ela estiver vazia, não for uma imagem direta ou o servidor bloquear a exibição, o painel mostra automaticamente uma arte gráfica da categoria. Portanto, não é necessário manter uma pasta de imagens.

## Localização no Google Maps

O texto do campo `local` continua sendo exibido integralmente, inclusive quando informa piso, galeria, teatro ou outro espaço interno. Quando o campo `mapa` estiver preenchido com uma URL HTTP ou HTTPS válida, o bloco **Onde** exibirá o botão **Abrir no Google Maps**. Eventos sem esse campo continuam aparecendo normalmente, sem botão.

## Ajuste de layout v35

As caixas **Quando** e **Onde** comportam até três linhas. O botão **Abrir no
Google Maps** fica em uma linha própria dentro da caixa **Onde**, sem reduzir a
largura disponível para o nome do local.

## Dados corrigidos na v36

O arquivo de demonstração passa a exibir corretamente `Fazenda Arraial Velho` e `Teatro de Bolso SESIMINAS`. O layout de três linhas para **Quando** e **Onde**, com o botão do Maps em linha própria, permanece o mesmo da v35.

## Tema visual

O site utiliza exclusivamente o tema **Original**. O seletor de tema foi removido da interface e preferências antigas salvas no navegador são descartadas ao carregar a página.

## Classificação indicativa

Quando o evento possui o campo `classificacao_indicativa`, o painel exibe uma
badge compacta junto a categoria, gratuidade e cidade. Os valores aceitos são:

```text
Livre
10 anos
12 anos
14 anos
16 anos
18 anos
```

A badge é omitida quando a fonte não fornece classificação confiável. O site
não tenta deduzir a faixa a partir do público-alvo descrito no evento.
