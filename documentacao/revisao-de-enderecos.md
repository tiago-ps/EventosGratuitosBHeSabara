# Fila de revisão de endereços de eventos — Tem Sim, Uai

## Acesso e objetivo

Página experimental de revisão: /revisar-localizacoes.html (no GitHub Pages do TESTE).
Não é uma página administrativa autenticada. Não concede escrita no GitHub ou no editor: salva as revisões apenas no navegador e exporta um JSON para análise editorial.

Os grupos são calculados ao abrir a página a partir de eventos.json, espaços, coordenadas e relações. São considerados apenas eventos que não tenham somente_teste=true. A mesma unidade com 19 atividades forma UM grupo para conferir.

### Fluxo editorial

1. Pesquisar um espaço com eventos pendentes, priorizando locais com maior número de eventos.
2. Abrir o link oficial ou o link Google Maps já existente apenas como referência textual de endereço. Conferir nome da unidade, número e bairro em fonte oficial.
3. Usar Pesquisar no OpenStreetMap; retornar à página e clicar na entrada ou área efetiva no mapa, ou preencher latitude e longitude verificadas em fontes compatíveis.
4. Informar URL da fonte, observação sobre a precisão e marcar a confirmação.
5. Clicar Salvar validação neste navegador; conferir outros locais e, ao final, Exportar revisões (JSON).
6. Encaminhar o JSON para revisão no projeto. Não alterar automaticamente eventos ou coordenadas públicas antes da validação.
7. Importar o pacote no clone do site de teste executando:

    python scripts/importar_revisoes_localizacoes.py localizacoes-revisadas-AAAA-MM-DD.json
    python scripts/importar_revisoes_localizacoes.py localizacoes-revisadas-AAAA-MM-DD.json --aplicar

8. Conferir os novos marcadores no TESTE, executar os testes e usar workflow 02 do Coletor para publicar coordenadas apenas de eventos públicos e espaços aprovados.

Os arquivos alterados pelo importador são coordenadas-espacos.json e coordenadas-conteudos.json. O segundo passa a aceitar os campos opcionais locais_por_id e locais_por_nome, além de locais_por_endereco. Os pontos só devem ser usados por eventos relacionados àquele ID, nome ou endereço.

### Endereços genéricos

Não apontar automaticamente para o centro de BH ou para a sede administrativa quando o evento indicar Vários espaços, Local informado na página oficial, Tour com ponto variável ou local a definir. O cadastro precisa ser desmembrado em locais/sessões concretos quando possível.

Na visualização de mapa, eventos ainda sem coordenadas aparecem na seção pesquisável 'eventos sem ponto geográfico confirmado'. Assim a informação permanece recuperável sem um marcador fictício.

### Diagnóstico inicial (21/10/2026)

Dos 193 eventos públicos do catálogo revisado, uma reprodução direta do algoritmo encontrou 85 com ponto e 108 sem ponto. Estes 108 se agrupavam em 36 locais: 29 grupos com endereço (91 eventos) e 7 grupos sem endereço (17 eventos). A tela do usuário mostrou 84/109, compatível com diferença de renderização/filtros ou snapshot.

Principais prioridades: NUFAC (19 eventos), Conservatório UFMG (6), Centro Cultural Vila Marçola (5), Centro Cultural São Bernardo (4), Urucuia (4), Salgado Filho (4), Padre Eustáquio (4), Vila Santa Rita (4).

Esses números representam fotografia do catálogo daquela data. A página de revisão sempre recalcula sua própria fila com o conteúdo mais recente.

## Regra de publicação

O workflow 02 no Coletor contém filtragem editorial de pontos por IDs de espaços aprovados, IDs/nomes de eventos públicos e endereços vinculados. Arquivos com revisão não substituem o processo de aprovação e publicação existente.
