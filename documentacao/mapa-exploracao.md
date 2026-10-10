# Mapa no modo Exploração

O controle Lista | Mapa aparece em Todos, Eventos, Livros, Espaços, Esporte e Lazer, Concursos e Utilidade pública. Cursos e Filmes on-line não são geolocalizados.

## Regras

- Reaproveitar exatamente os filtros da lista; não incluir conteúdos ocultos pelos filtros.
- Mostrar somente locais físicos com coordenadas verificadas; agrupá-los no mesmo marcador.
- Para livros, usar os acervos com acesso físico e localização confirmada, permitindo várias bibliotecas para o mesmo título. Não inferir disponibilidade para empréstimo.
- Para concursos, exigir unidade ou local de trabalho informado; cidade do edital, sede administrativa e local de prova não equivalem a local de trabalho.
- Para utilidade pública, exigir ponto de atendimento físico explicitado.
- Perto de mim requer permissão do navegador e indica proximidade em linha reta; não grava a localização em nossos dados.

## Arquivos

- coordenadas-espacos.json: coordenadas dos equipamentos culturais, vinculadas por ID/endereço exato.
- coordenadas-conteudos.json: bibliotecas com livros físicos e endereços de eventos/atividades verificados.
- pendencias-coordenadas-espacos.json e pendencias-coordenadas-conteudos.json: revisão humana.
- scripts/geocodificar_espacos.py e scripts/geocodificar_conteudos.py: importação pontual baseada nos endereços oficiais, com cache e validação.
- .github/workflows/geocodificar-conteudos.yml: workflow manual para atualizações posteriores; não rodar como rotina periódica.

## Sobre os links Google Maps

No catálogo analisado havia 38 URLs distintas maps.app.goo.gl compartilhadas pelos espaços. URLs curtas não contêm coordenadas explícitas. Ao expandir o link, URLs longas podem conter !3dLAT!4dLON ou query=LAT,LON; @LAT,LON pode ser apenas o centro da visualização do mapa, não o estabelecimento.

Os links de Google Maps continuam disponíveis como referência e navegação. Não extrair em massa nem transferir coordenadas provenientes de Google Maps Platform para Leaflet/OpenStreetMap: os termos restringem a extração e o uso com mapas de outros fornecedores.

Fontes: https://developers.google.com/maps/documentation/urls/get-started ; https://cloud.google.com/maps-platform/terms ; https://cloud.google.com/maps-platform/terms/maps-service-terms

Para o mapa Leaflet, obter geolocalização independentemente dos links Google: usar endereços públicos confirmados e dados abertos compatíveis, documentando fonte, precisão e revisão. Nominatim público admite uso leve e importações pontuais pequenas, sob limites e cache. Não oferecer geocodificação automática em tempo real aos visitantes.

Política Nominatim: https://operations.osmfoundation.org/policies/nominatim/

## Limitações e próximos campos

- Biblioteca IFMG Sabará: ponto referencial do campus, não a entrada exata da biblioteca.
- Concursos atuais carecem de local de lotação físico confirmado; incorporar ao editor e coletor campos para locais_lotacao (nome da unidade, endereço, cidade, UF, fonte, geocodificação e nível de precisão), separados de local_prova.
- Atividades com endereço sem ponto validado permanecem acessíveis pela lista; não apontar para o centro de uma rua como local exato.
- Antes de enviar ao público, validar no teste os marcadores, links diretos, filtros, disponibilidade dos dados e comportamento mobile.
