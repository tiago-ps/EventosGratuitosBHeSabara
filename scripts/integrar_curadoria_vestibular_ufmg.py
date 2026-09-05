from __future__ import annotations

import json
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CURATIONS = ROOT / "curadorias-site.json"
APP = ROOT / "js" / "app.js"
THEMES = ROOT / "js" / "temas-visuais.js"
TEST = ROOT / "testes" / "vestibular-ufmg-curadoria.test.cjs"

CURATION_ID = "vestibular-ufmg-seriado-2026"
CURATION_THEME = "Vestibular UFMG"
BANNER_PATH = "imagens/curadorias/vestibular-ufmg-banner.png"


def vestibular_meta(ciclo: str, etapa: int, tipo_obra: str) -> dict:
    return {
        "instituicao": "UFMG",
        "processo": "Seriado UFMG",
        "ano_prova": 2026,
        "ciclo": ciclo,
        "etapa": etapa,
        "obrigatoria": True,
        "tipo_obra": tipo_obra,
    }


def curation_payload() -> dict:
    etapa_2 = [CURATION_THEME, "Seriado UFMG 2026", "Etapa 2", "Ciclo 2025-2027"]
    etapa_1 = [CURATION_THEME, "Seriado UFMG 2026", "Etapa 1", "Ciclo 2026-2028"]
    return {
        "id": CURATION_ID,
        "nome": "Seriado UFMG 2026 — Obras para Vestibular",
        "ativo_de": "2026-09-01",
        "ativo_ate": "2026-12-13",
        "tema": CURATION_THEME,
        "instituicao": "UFMG",
        "processo": "Seriado UFMG",
        "ano_prova": 2026,
        "titulo_editorial": "Obras para Vestibular — Seriado UFMG 2026",
        "subtitulo_editorial": "Livros, documentário e álbum musical cobrados nas Etapas 1 e 2",
        "texto_introdutorio": (
            "Curadoria das obras literárias e artísticas indicadas para as provas do Seriado UFMG 2026, "
            "organizadas por ciclo e etapa. Nesta primeira versão, o álbum Txai é representado tecnicamente "
            "na estrutura de filmes até a criação futura de uma categoria própria para música."
        ),
        "overlays": {"eventos": {}, "cursos": {}, "livros": {}, "filmes": {}},
        "complementos": {
            "eventos": [],
            "livros": [
                {
                    "id": "site:vestibular-ufmg:sao-bernardo",
                    "titulo": "São Bernardo",
                    "autor": "Graciliano Ramos",
                    "ano": 1934,
                    "pergunta_curiosidade": "Obra obrigatória do Seriado UFMG 2026 — Etapa 2.",
                    "texto_apoio": (
                        "Romance de Graciliano Ramos incluído na Etapa 2 do ciclo 2025–2027. "
                        "Há exemplar físico catalogado no IFMG Sabará e acesso integral em domínio público."
                    ),
                    "temas": etapa_2,
                    "icone": "📚",
                    "biblioteca_rede": "IFMG Sabará / acesso aberto",
                    "codigo_acervo": "86891",
                    "exemplares_fisicos_catalogados": 1,
                    "acesso_fisico": True,
                    "acesso_virtual": True,
                    "link_fisico": "https://pergamum.ifmg.edu.br/acervo/86891",
                    "link_virtual": "https://pt.wikisource.org/wiki/S._Bernardo_(1934)",
                    "link": "https://pt.wikisource.org/wiki/S._Bernardo_(1934)",
                    "tipo_link_principal": "virtual",
                    "fonte": "UFMG / IFMG Sabará / Wikisource",
                    "exibicao_ativa": True,
                    "vestibular": vestibular_meta("2025-2027", 2, "Livro — romance"),
                },
                {
                    "id": "site:vestibular-ufmg:sobrevivendo-ao-racismo",
                    "titulo": "Sobrevivendo ao racismo: memórias, cartas e o cotidiano da discriminação no Brasil",
                    "autor": "Luana Tolentino",
                    "ano": 2023,
                    "pergunta_curiosidade": "Obra obrigatória do Seriado UFMG 2026 — Etapa 2.",
                    "texto_apoio": (
                        "Livro de Luana Tolentino incluído na Etapa 2 do ciclo 2025–2027. "
                        "A Biblioteca Virtual do IFMG registra versões em PDF e ePUB."
                    ),
                    "temas": etapa_2,
                    "icone": "📚",
                    "biblioteca_rede": "Biblioteca Virtual/Pergamum — IFMG",
                    "codigo_acervo": "211229",
                    "acesso_fisico": False,
                    "acesso_virtual": True,
                    "link_virtual": "https://pergamum.ifmg.edu.br/pesquisa_geral?for=LIVRE&q=211229&page=1&perPage=20&orderBy=obra&direction=C",
                    "link": "https://pergamum.ifmg.edu.br/pesquisa_geral?for=LIVRE&q=211229&page=1&perPage=20&orderBy=obra&direction=C",
                    "tipo_link_principal": "virtual",
                    "fonte": "UFMG / Biblioteca Virtual do IFMG",
                    "exibicao_ativa": True,
                    "vestibular": vestibular_meta("2025-2027", 2, "Livro"),
                },
                {
                    "id": "site:vestibular-ufmg:o-quinze",
                    "titulo": "O quinze",
                    "autor": "Rachel de Queiroz",
                    "ano": 1930,
                    "pergunta_curiosidade": "Obra obrigatória do Seriado UFMG 2026 — Etapa 1.",
                    "texto_apoio": (
                        "Romance de Rachel de Queiroz incluído na Etapa 1 do ciclo 2026–2028. "
                        "Não foi localizado nos inventários físico ou virtual do IFMG Sabará consultados até abril de 2026."
                    ),
                    "temas": etapa_1,
                    "icone": "📚",
                    "biblioteca_rede": "Não localizado no acervo IFMG Sabará consultado",
                    "acesso_fisico": False,
                    "acesso_virtual": False,
                    "link": "https://www.record.com.br/products/o-quinze/",
                    "pagina_oficial": "https://www.record.com.br/products/o-quinze/",
                    "fonte": "UFMG / Editora José Olympio",
                    "exibicao_ativa": True,
                    "vestibular": vestibular_meta("2026-2028", 1, "Livro — romance"),
                },
                {
                    "id": "site:vestibular-ufmg:ideias-para-adiar-o-fim-do-mundo",
                    "titulo": "Ideias para adiar o fim do mundo",
                    "autor": "Ailton Krenak",
                    "ano": 2019,
                    "pergunta_curiosidade": "Obra obrigatória do Seriado UFMG 2026 — Etapa 1.",
                    "texto_apoio": (
                        "Ensaio de Ailton Krenak incluído na Etapa 1 do ciclo 2026–2028. "
                        "Há exemplar físico catalogado na Biblioteca do IFMG Campus Sabará."
                    ),
                    "temas": etapa_1,
                    "icone": "📚",
                    "biblioteca_rede": "IFMG Sabará",
                    "codigo_acervo": "102547",
                    "exemplares_fisicos_catalogados": 1,
                    "acesso_fisico": True,
                    "acesso_virtual": False,
                    "link_fisico": "https://pergamum.ifmg.edu.br/acervo/102547",
                    "link": "https://pergamum.ifmg.edu.br/acervo/102547",
                    "tipo_link_principal": "fisico",
                    "pagina_oficial": "https://www.companhiadasletras.com.br/livro/9788535933581/ideias-para-adiar-o-fim-do-mundo-nova-edicao",
                    "fonte": "UFMG / IFMG Sabará",
                    "exibicao_ativa": True,
                    "vestibular": vestibular_meta("2026-2028", 1, "Livro — ensaio"),
                },
            ],
            "cursos": [],
            "filmes": [
                {
                    "id": "site:vestibular-ufmg:bale-de-pe-no-chao",
                    "titulo": "Balé de Pé no Chão — a dança afro de Mercedes Baptista",
                    "ano": 2005,
                    "direcao": ["Lilian Solá Santiago", "Marianna Monteiro"],
                    "generos": ["Documentário", "Obra para vestibular"],
                    "plataforma": "TV Câmara",
                    "pagina_oficial": "https://www.camara.leg.br/tv/401867-bale-de-pe-no-chao-a-danca-afro-de-mercedes-baptista/",
                    "sinopse": (
                        "Documentário sobre a dança afro-brasileira e a trajetória artística de Mercedes Baptista, "
                        "incluído na Etapa 2 do ciclo 2025–2027 do Seriado UFMG."
                    ),
                    "temas": etapa_2,
                    "icone": "🎬",
                    "fonte": "UFMG / TV Câmara",
                    "exibicao_ativa": True,
                    "vestibular": vestibular_meta("2025-2027", 2, "Documentário"),
                },
                {
                    "id": "site:vestibular-ufmg:txai",
                    "titulo": "Txai",
                    "ano": 1990,
                    "generos": ["Álbum musical", "Música brasileira", "Obra para vestibular"],
                    "plataforma": "Spotify",
                    "pagina_oficial": "https://open.spotify.com/intl-pt/album/37EITqrt8brFFMNvVDQmrR",
                    "sinopse": (
                        "Álbum de Milton Nascimento incluído na Etapa 1 do ciclo 2026–2028 do Seriado UFMG. "
                        "Está representado provisoriamente na estrutura técnica de filmes até a criação da categoria de música."
                    ),
                    "temas": etapa_1,
                    "icone": "🎵",
                    "fonte": "UFMG / Spotify",
                    "exibicao_ativa": True,
                    "tipo_conteudo_real": "album_musical",
                    "representacao_temporaria": "filmes",
                    "autoria": ["Milton Nascimento"],
                    "vestibular": vestibular_meta("2026-2028", 1, "Álbum musical"),
                },
            ],
        },
        "auditoria_dados": {
            "revisado_em": "2026-09-05",
            "confirmacoes": [
                {
                    "tipo": "lista-oficial",
                    "id": "seriado-ufmg-2026",
                    "confirmado": ["seis obras", "ciclos", "etapas", "tipos de obra"],
                    "observacao": "Curadoria criada a partir da lista oficial do Seriado UFMG 2026 e da verificação de acesso realizada para o Mural Cultural.",
                },
                {
                    "tipo": "acervo-ifmg-sabara",
                    "id": "levantamento-ate-2026-04",
                    "confirmado": ["São Bernardo físico", "Sobrevivendo ao racismo virtual", "Ideias para adiar o fim do mundo físico"],
                    "observacao": "O quinze não foi localizado nos inventários físico ou virtual consultados."
                },
            ],
            "pendencias_manuais": [
                {
                    "tipo": "imagem",
                    "id": "vestibular-ufmg-banner",
                    "campos": ["arquivo"],
                    "motivo": f"Adicionar manualmente {BANNER_PATH} ao repositório."
                },
                {
                    "tipo": "modelo",
                    "id": "categoria-musica",
                    "campos": ["catalogo", "renderizador"],
                    "motivo": "Txai permanece provisoriamente na estrutura de filmes até futura implementação de música."
                },
            ],
        },
    }


def patch_curations() -> None:
    text = CURATIONS.read_text(encoding="utf-8")
    if f'"id": "{CURATION_ID}"' in text:
        return
    marker = "\n  ]\n}"
    if marker not in text:
        raise RuntimeError("Fechamento de curadorias-site.json não encontrado")
    payload = json.dumps(curation_payload(), ensure_ascii=False, indent=2)
    payload = textwrap.indent(payload, "    ")
    head, tail = text.rsplit(marker, 1)
    CURATIONS.write_text(head + ",\n" + payload + marker + tail, encoding="utf-8")


def patch_app() -> None:
    text = APP.read_text(encoding="utf-8")
    if f"'{CURATION_ID}':" in text:
        return
    marker = "    }\n  });\n  const AGENDA_BATCH_SIZE = 24;"
    if text.count(marker) != 1:
        raise RuntimeError("Âncora de BUILTIN_PANEL_PROFILES não encontrada de forma única")
    block = """    },
    'vestibular-ufmg-seriado-2026': {
      nome: 'Seriado UFMG 2026 — Obras para Vestibular',
      destaque: 'Obras obrigatórias',
      ativo_de: '2026-09-01',
      ativo_ate: '2026-12-13',
      configuracao: {
        modules: {
          events: false,
          books: true,
          courses: false,
          contests: false,
          films: true
        },
        theme: 'vestibular ufmg',
        eventCities: [],
        eventCategory: '',
        eventProgram: '',
        eventUnit: '',
        bookCampuses: [],
        bookAccess: '',
        filmGenre: '',
        filmRating: '',
        filmDuration: '',
        weights: {
          events: 1,
          books: 2,
          courses: 1,
          contests: 1,
          films: 1
        },
        slideDuration: 0
      }
    }
  });
  const AGENDA_BATCH_SIZE = 24;"""
    APP.write_text(text.replace(marker, block, 1), encoding="utf-8")


def patch_themes() -> None:
    text = THEMES.read_text(encoding="utf-8")
    if "id: 'vestibular-ufmg'" in text:
        return
    marker = "    }\n  ];\n\n  const allowed = new Set(THEMES.map(theme => theme.id));"
    if text.count(marker) != 1:
        raise RuntimeError("Âncora final de THEMES não encontrada de forma única")
    block = """    },
    {
      id: 'vestibular-ufmg',
      label: 'Vestibular UFMG',
      description: 'Obras do Seriado UFMG 2026',
      swatch: 'is-default',
      panelProfile: 'vestibular-ufmg-seriado-2026',
      profileLabel: 'Vestibular UFMG',
      banner: {
        src: 'imagens/curadorias/vestibular-ufmg-banner.png',
        alt: 'Obra para Vestibular — UFMG'
      }
    }
  ];

  const allowed = new Set(THEMES.map(theme => theme.id));"""
    THEMES.write_text(text.replace(marker, block, 1), encoding="utf-8")


def write_test() -> None:
    content = r"""'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const payload = JSON.parse(fs.readFileSync(path.join(root, 'curadorias-site.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const themesSource = fs.readFileSync(path.join(root, 'js', 'temas-visuais.js'), 'utf8');

const curation = payload.curadorias.find(item => item.id === 'vestibular-ufmg-seriado-2026');
assert.ok(curation, 'Curadoria Vestibular UFMG ausente');
assert.equal(curation.tema, 'Vestibular UFMG');
assert.equal(curation.ativo_de, '2026-09-01');
assert.equal(curation.ativo_ate, '2026-12-13');
assert.equal(curation.complementos.livros.length, 4);
assert.equal(curation.complementos.filmes.length, 2);

const allItems = [...curation.complementos.livros, ...curation.complementos.filmes];
assert.equal(allItems.length, 6);
for (const item of allItems) {
  assert.ok(item.temas.includes('Vestibular UFMG'), `${item.titulo}: tema Vestibular UFMG ausente`);
  assert.equal(item.vestibular.instituicao, 'UFMG');
  assert.equal(item.vestibular.processo, 'Seriado UFMG');
  assert.equal(item.vestibular.ano_prova, 2026);
  assert.equal(item.vestibular.obrigatoria, true);
}

const txai = curation.complementos.filmes.find(item => item.titulo === 'Txai');
assert.ok(txai, 'Txai ausente');
assert.equal(txai.tipo_conteudo_real, 'album_musical');
assert.equal(txai.representacao_temporaria, 'filmes');
assert.ok(txai.generos.includes('Álbum musical'));

assert.match(appSource, /'vestibular-ufmg-seriado-2026':\s*\{[\s\S]*theme: 'vestibular ufmg'/);
assert.match(themesSource, /id: 'vestibular-ufmg',[\s\S]*panelProfile: 'vestibular-ufmg-seriado-2026'/);
assert.match(themesSource, /src: 'imagens\/curadorias\/vestibular-ufmg-banner\.png'/);

// Protege os perfis já existentes contra remoção acidental.
assert.match(appSource, /'agosto-lilas-2026':/);
assert.match(appSource, /'setembro-amarelo-2026':/);
assert.match(themesSource, /panelProfile: 'agosto-lilas-2026'/);
assert.match(themesSource, /panelProfile: 'setembro-amarelo-2026'/);

console.log('Curadoria Vestibular UFMG 2026 validada.');
"""
    TEST.write_text(content, encoding="utf-8")


def main() -> None:
    patch_curations()
    patch_app()
    patch_themes()
    write_test()


if __name__ == "__main__":
    main()
