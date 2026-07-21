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
      "link": "https://link-oficial-do-evento"
    }
  ]
}
```

## Comportamento automático

- organiza os eventos por data;
- ignora eventos cuja data final já passou;
- troca de evento automaticamente;
- cria QR Code a partir do campo `link`;
- usa a imagem remota indicada no JSON;
- mostra uma arte genérica por categoria se a imagem estiver vazia ou falhar;
- adapta o layout a telas horizontais e verticais;
- não exige alterações no HTML, CSS ou JavaScript.

## Observação sobre imagens

Alguns sites bloqueiam a exibição externa de suas imagens. Quando isso acontecer, o painel usa automaticamente a arte genérica da categoria, sem quebrar o slide.
