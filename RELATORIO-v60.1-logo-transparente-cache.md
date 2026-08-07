# Versão 60.1 — logo transparente e atualização de cache

## Alterações

- substituição da logo anterior pela versão transparente fornecida pelo projeto;
- retirada do fundo branco, arredondamento, sombra e preenchimento aplicados pelo CSS;
- manutenção da proporção original da marca nos modos painel e agenda;
- retirada da logo da lista de arquivos pré-armazenados do núcleo da PWA;
- estratégia `network first` exclusiva para `imagens/marca/logo-mural-cultural.png`;
- requisição da marca com `cache: no-store`, usando a cópia armazenada apenas quando não houver conexão;
- atualização da versão do cache para `mural-cultural-v60.1`.

## Substituição futura

Para trocar a marca, basta substituir:

```text
imagens/marca/logo-mural-cultural.png
```

Não é necessário alterar HTML, CSS ou JavaScript. A dimensão recomendada é de aproximadamente 1000 a 1600 pixels de largura, em PNG com transparência.
