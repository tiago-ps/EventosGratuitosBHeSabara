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
IMAGE_BASE = "imagens/curadorias/vestibular-ufmg"


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


def registro_catalogo(
    *,
    registro_id: str,
    titulo: str,
    autor: str,
    biblioteca: str,
    link: str = "",
    link_fisico: str = "",
    link_virtual: str = "",
    codigo_acervo: str = "",
    numero_chamada: str = "",
    acesso_fisico: bool = False,
    acesso_virtual: bool = False,
) -> dict:
    registro = {
        "registro_id": registro_id,
        "titulo_registro": titulo,
        "autor_registro": autor,
        "biblioteca_rede": biblioteca,
        "unidade": "",
        "codigo_acervo": codigo_acervo,
        "numero_chamada": numero_chamada,
        "acesso_fisico": acesso_fisico,
        "acesso_virtual": acesso_virtual,
    }
    if link:
        registro["link"] = link
    if link_fisico:
        registro["link_fisico"] = link_fisico
    if link_virtual:
        registro["link_virtual"] = link_virtual
    return registro


def acervo(biblioteca: str, registros: list[dict]) -> dict:
    return {
        "biblioteca": biblioteca,
        "biblioteca_rede": biblioteca,
        "unidade": "",
        "acesso_fisico": any(item.get("acesso_fisico") for item in registros),
        "acesso_virtual": any(item.get("acesso_virtual") for item in registros),
        "registros": registros,
    }


def curation_payload() -> dict:
    etapa_2 = [CURATION_THEME, "Seriado UFMG 2026", "Etapa 2", "Ciclo 2025-2027"]
    etapa_1 = [CURATION_THEME, "Seriado UFMG 2026", "Etapa 1", "Ciclo 2026-2028"]

    sao_bernardo_titulo = "São Bernardo"
    sao_bernardo_autor = "Graciliano Ramos"
    sao_bernardo_acervos = [
        acervo("IFMG Sabará", [
            registro_catalogo(
                registro_id="ifmg:86891",
                titulo=sao_bernardo_titulo,
                autor=sao_bernardo_autor,
                biblioteca="IFMG Sabará",
                link_fisico="https://pergamum.ifmg.edu.br/acervo/86891",
                codigo_acervo="86891",
                numero_chamada="821(81)-3 R175s 2008 (SB)",
                acesso_fisico=True,
            )
        ]),
        acervo("FMC-PBH", [
            registro_catalogo(
                registro_id="fmc-pbh:busca:sao-bernardo",
                titulo=sao_bernardo_titulo,
                autor=sao_bernardo_autor,
                biblioteca="FMC-PBH",
                link="https://bibliotecasfmc.pbh.gov.br/pesquisa_geral?for=INDICE_1&q=S%25C3%25A3o%2520Bernardo&page=1&perPage=20&orderBy=obra&direction=C",
            )
        ]),
        acervo("Biblioteca Pública Estadual de Minas Gerais", [
            registro_catalogo(
                registro_id="bpemg:busca:sao-bernardo",
                titulo=sao_bernardo_titulo,
                autor=sao_bernardo_autor,
                biblioteca="Biblioteca Pública Estadual de Minas Gerais",
                link="http://200.198.28.214/?q=S%C3%A3o%20Bernardo&for=INDICE_1",
            )
        ]),
        acervo("BibliON", [
            registro_catalogo(
                registro_id="biblion:65277808",
                titulo=sao_bernardo_titulo,
                autor=sao_bernardo_autor,
                biblioteca="BibliON",
                link_virtual="https://biblion.arvore.com.br/biblioteca/ler/livros?hsf=65277808",
                acesso_virtual=True,
            )
        ]),
        acervo("MEC Livros", [
            registro_catalogo(
                registro_id="mec-livros:busca:sao-bernardo",
                titulo=sao_bernardo_titulo,
                autor=sao_bernardo_autor,
                biblioteca="MEC Livros",
                link="https://meclivros.mec.gov.br/search?search=S%C3%A3o+Bernardo",
            )
        ]),
        acervo("Wikisource — domínio público", [
            registro_catalogo(
                registro_id="wikisource:sao-bernardo-1934",
                titulo=sao_bernardo_titulo,
                autor=sao_bernardo_autor,
                biblioteca="Wikisource — domínio público",
                link_virtual="https://pt.wikisource.org/wiki/S._Bernardo_(1934)",
                acesso_virtual=True,
            )
        ]),
    ]

    sobrevivendo_titulo = "Sobrevivendo ao racismo: memórias, cartas e o cotidiano da discriminação no Brasil"
    sobrevivendo_autor = "Luana Tolentino"
    sobrevivendo_acervos = [
        acervo("Biblioteca Virtual/Pergamum — IFMG", [
            registro_catalogo(
                registro_id="ifmg:211229",
                titulo=sobrevivendo_titulo,
                autor=sobrevivendo_autor,
                biblioteca="Biblioteca Virtual/Pergamum — IFMG",
                link_virtual="https://pergamum.ifmg.edu.br/pesquisa_geral?for=LIVRE&q=211229&page=1&perPage=20&orderBy=obra&direction=C",
                codigo_acervo="211229",
                acesso_virtual=True,
            ),
            registro_catalogo(
                registro_id="ifmg:211228",
                titulo=sobrevivendo_titulo,
                autor=sobrevivendo_autor,
                biblioteca="Biblioteca Virtual/Pergamum — IFMG",
                link_virtual="https://pergamum.ifmg.edu.br/pesquisa_geral?for=LIVRE&q=211228&page=1&perPage=20&orderBy=obra&direction=C",
                codigo_acervo="211228",
                acesso_virtual=True,
            ),
        ]),
        acervo("FMC-PBH", [
            registro_catalogo(
                registro_id="fmc-pbh:busca:sobrevivendo-ao-racismo",
                titulo=sobrevivendo_titulo,
                autor=sobrevivendo_autor,
                biblioteca="FMC-PBH",
                link="https://bibliotecasfmc.pbh.gov.br/pesquisa_geral?for=INDICE_1&q=Sobrevivendo%2520ao%2520racismo%253A%2520mem%25C3%25B3rias%252C%2520cartas%2520e%2520o%2520cotidiano%2520da%2520discrimina%25C3%25A7%25C3%25A3o%2520no%2520Brasil&page=1&perPage=20&orderBy=obra&direction=C",
            )
        ]),
    ]

    quinze_titulo = "O quinze"
    quinze_autor = "Rachel de Queiroz"
    quinze_acervos = [
        acervo("IFMG", [
            registro_catalogo(
                registro_id="ifmg:busca:o-quinze",
                titulo=quinze_titulo,
                autor=quinze_autor,
                biblioteca="IFMG",
                link="https://pergamum.ifmg.edu.br/pesquisa_avancada?q=quinze&for=TITULO&condition=AND&q2=queiroz&for2=AUTOR&tipo_obra=49%252C&keyword_type=P&cr=N&orderBy=obra&direction=C",
            )
        ]),
        acervo("FMC-PBH", [
            registro_catalogo(
                registro_id="fmc-pbh:busca:o-quinze",
                titulo=quinze_titulo,
                autor=quinze_autor,
                biblioteca="FMC-PBH",
                link="https://bibliotecasfmc.pbh.gov.br/pesquisa_avancada?q=quinze&for=TITULO&condition=AND&q2=queiroz&for2=AUTOR&keyword_type=P&cr=N&orderBy=obra&direction=C",
            )
        ]),
        acervo("Biblioteca Pública Estadual de Minas Gerais", [
            registro_catalogo(
                registro_id="bpemg:busca:o-quinze",
                titulo=quinze_titulo,
                autor=quinze_autor,
                biblioteca="Biblioteca Pública Estadual de Minas Gerais",
                link="http://200.198.28.214/pesquisa_avancada?for=TITULO&q=quinze&condition=AND&for2=AUTOR&q2=queiroz&keyword_type=P",
            )
        ]),
    ]

    ideias_titulo = "Ideias para adiar o fim do mundo"
    ideias_autor = "Ailton Krenak"
    ideias_acervos = [
        acervo("IFMG Sabará", [
            registro_catalogo(
                registro_id="ifmg:102547",
                titulo=ideias_titulo,
                autor=ideias_autor,
                biblioteca="IFMG Sabará",
                link_fisico="https://pergamum.ifmg.edu.br/acervo/102547",
                codigo_acervo="102547",
                acesso_fisico=True,
            )
        ]),
        acervo("FMC-PBH", [
            registro_catalogo(
                registro_id="fmc-pbh:busca:ideias-para-adiar-o-fim-do-mundo",
                titulo=ideias_titulo,
                autor=ideias_autor,
                biblioteca="FMC-PBH",
                link="https://bibliotecasfmc.pbh.gov.br/pesquisa_geral?for=INDICE_1&q=Ideias%2520para%2520adiar%2520o%2520fim%2520do%2520mundo%2520&page=1&perPage=20&orderBy=obra&direction=C",
            )
        ]),
        acervo("Biblioteca Pública Estadual de Minas Gerais", [
            registro_catalogo(
                registro_id="bpemg:busca:ideias-para-adiar-o-fim-do-mundo",
                titulo=ideias_titulo,
                autor=ideias_autor,
                biblioteca="Biblioteca Pública Estadual de Minas Gerais",
                link="http://200.198.28.214/?q=Ideias%20para%20adiar%20o%20fim%20do%20mundo%20&for=INDICE_1",
            )
        ]),
    ]

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
                    "tipo_conteudo": "livro",
                    "titulo": sao_bernardo_titulo,
                    "autor": sao_bernardo_autor,
                    "ano": 1934,
                    "imagem": f"{IMAGE_BASE}/sao-bernardo.png",
                    "pergunta_curiosidade": "Obra obrigatória do Seriado UFMG 2026 — Etapa 2.",
                    "texto_apoio": (
                        "Romance de Graciliano Ramos incluído na Etapa 2 do ciclo 2025–2027. "
                        "Há exemplar físico catalogado no IFMG Sabará, além de outros catálogos e acessos digitais reunidos abaixo."
                    ),
                    "temas": etapa_2,
                    "icone": "📚",
                    "biblioteca_rede": "IFMG Sabará e outros acervos",
                    "codigo_acervo": "86891",
                    "exemplares_fisicos_catalogados": 1,
                    "acesso_fisico": True,
                    "acesso_virtual": True,
                    "link_fisico": "https://pergamum.ifmg.edu.br/acervo/86891",
                    "link_virtual": "https://pt.wikisource.org/wiki/S._Bernardo_(1934)",
                    "link": "https://pt.wikisource.org/wiki/S._Bernardo_(1934)",
                    "tipo_link_principal": "virtual",
                    "fonte": "UFMG / acervos de bibliotecas / Wikisource",
                    "exibicao_ativa": True,
                    "acervos": sao_bernardo_acervos,
                    "acervos_quantidade": len(sao_bernardo_acervos),
                    "registros_acervo_quantidade": sum(len(item["registros"]) for item in sao_bernardo_acervos),
                    "bibliotecas": [item["biblioteca"] for item in sao_bernardo_acervos],
                    "vestibular": vestibular_meta("2025-2027", 2, "Livro — romance"),
                },
                {
                    "id": "site:vestibular-ufmg:sobrevivendo-ao-racismo",
                    "tipo_conteudo": "livro",
                    "titulo": sobrevivendo_titulo,
                    "autor": sobrevivendo_autor,
                    "ano": 2023,
                    "imagem": f"{IMAGE_BASE}/sobrevivendo-ao-racismo.png",
                    "pergunta_curiosidade": "Obra obrigatória do Seriado UFMG 2026 — Etapa 2.",
                    "texto_apoio": (
                        "Livro de Luana Tolentino incluído na Etapa 2 do ciclo 2025–2027. "
                        "A Biblioteca Virtual do IFMG registra versões em PDF e ePUB; a curadoria também inclui o catálogo da FMC-PBH informado na lista-base."
                    ),
                    "temas": etapa_2,
                    "icone": "📚",
                    "biblioteca_rede": "Biblioteca Virtual/Pergamum — IFMG e FMC-PBH",
                    "codigo_acervo": "211229",
                    "acesso_fisico": False,
                    "acesso_virtual": True,
                    "link_virtual": "https://pergamum.ifmg.edu.br/pesquisa_geral?for=LIVRE&q=211229&page=1&perPage=20&orderBy=obra&direction=C",
                    "link": "https://pergamum.ifmg.edu.br/pesquisa_geral?for=LIVRE&q=211229&page=1&perPage=20&orderBy=obra&direction=C",
                    "tipo_link_principal": "virtual",
                    "fonte": "UFMG / Biblioteca Virtual do IFMG / FMC-PBH",
                    "exibicao_ativa": True,
                    "acervos": sobrevivendo_acervos,
                    "acervos_quantidade": len(sobrevivendo_acervos),
                    "registros_acervo_quantidade": sum(len(item["registros"]) for item in sobrevivendo_acervos),
                    "bibliotecas": [item["biblioteca"] for item in sobrevivendo_acervos],
                    "vestibular": vestibular_meta("2025-2027", 2, "Livro"),
                },
                {
                    "id": "site:vestibular-ufmg:o-quinze",
                    "tipo_conteudo": "livro",
                    "titulo": quinze_titulo,
                    "autor": quinze_autor,
                    "ano": 1930,
                    "imagem": f"{IMAGE_BASE}/o-quinze.png",
                    "pergunta_curiosidade": "Obra obrigatória do Seriado UFMG 2026 — Etapa 1.",
                    "texto_apoio": (
                        "Romance de Rachel de Queiroz incluído na Etapa 1 do ciclo 2026–2028. "
                        "A lista-base reúne consultas aos catálogos do IFMG, FMC-PBH e Biblioteca Pública Estadual de Minas Gerais."
                    ),
                    "temas": etapa_1,
                    "icone": "📚",
                    "biblioteca_rede": "Catálogos IFMG / FMC-PBH / BPEMG",
                    "acesso_fisico": False,
                    "acesso_virtual": False,
                    "link": "https://www.record.com.br/products/o-quinze/",
                    "pagina_oficial": "https://www.record.com.br/products/o-quinze/",
                    "fonte": "UFMG / Editora José Olympio / catálogos de bibliotecas",
                    "exibicao_ativa": True,
                    "acervos": quinze_acervos,
                    "acervos_quantidade": len(quinze_acervos),
                    "registros_acervo_quantidade": sum(len(item["registros"]) for item in quinze_acervos),
                    "bibliotecas": [item["biblioteca"] for item in quinze_acervos],
                    "vestibular": vestibular_meta("2026-2028", 1, "Livro — romance"),
                },
                {
                    "id": "site:vestibular-ufmg:ideias-para-adiar-o-fim-do-mundo",
                    "tipo_conteudo": "livro",
                    "titulo": ideias_titulo,
                    "autor": ideias_autor,
                    "ano": 2019,
                    "imagem": f"{IMAGE_BASE}/ideias-para-adiar-o-fim-do-mundo.png",
                    "pergunta_curiosidade": "Obra obrigatória do Seriado UFMG 2026 — Etapa 1.",
                    "texto_apoio": (
                        "Ensaio de Ailton Krenak incluído na Etapa 1 do ciclo 2026–2028. "
                        "Há exemplar físico catalogado no IFMG Sabará e links de consulta também para FMC-PBH e Biblioteca Pública Estadual de Minas Gerais."
                    ),
                    "temas": etapa_1,
                    "icone": "📚",
                    "biblioteca_rede": "IFMG Sabará e outros acervos",
                    "codigo_acervo": "102547",
                    "exemplares_fisicos_catalogados": 1,
                    "acesso_fisico": True,
                    "acesso_virtual": False,
                    "link_fisico": "https://pergamum.ifmg.edu.br/acervo/102547",
                    "link": "https://pergamum.ifmg.edu.br/acervo/102547",
                    "tipo_link_principal": "fisico",
                    "pagina_oficial": "https://www.companhiadasletras.com.br/livro/9788535933581/ideias-para-adiar-o-fim-do-mundo-nova-edicao",
                    "fonte": "UFMG / IFMG Sabará / catálogos de bibliotecas",
                    "exibicao_ativa": True,
                    "acervos": ideias_acervos,
                    "acervos_quantidade": len(ideias_acervos),
                    "registros_acervo_quantidade": sum(len(item["registros"]) for item in ideias_acervos),
                    "bibliotecas": [item["biblioteca"] for item in ideias_acervos],
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
                    "imagem": f"{IMAGE_BASE}/bale-de-pe-no-chao.png",
                    "plataforma": "YouTube",
                    "pagina_oficial": "https://www.youtube.com/watch?v=x9CMU4aayjU",
                    "link": "https://www.youtube.com/watch?v=x9CMU4aayjU",
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
                    "autor": "Milton Nascimento",
                    "ano": 1990,
                    "generos": ["Álbum musical", "Música brasileira", "Obra para vestibular"],
                    "imagem": f"{IMAGE_BASE}/txai.png",
                    "plataforma": "Spotify",
                    "pagina_oficial": "https://open.spotify.com/intl-pt/album/37EITqrt8brFFMNvVDQmrR",
                    "link": "https://open.spotify.com/intl-pt/album/37EITqrt8brFFMNvVDQmrR",
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
                    "tipo": "acervos-e-links",
                    "id": "lista-base-vestibular-ufmg",
                    "confirmado": ["links IFMG", "links FMC-PBH", "links BPEMG", "BibliON", "MEC Livros"],
                    "observacao": (
                        "Os links de catálogos adicionais foram incorporados conforme a lista-base fornecida para a curadoria. "
                        "Links de pesquisa não são convertidos em afirmação de disponibilidade confirmada; o card os apresenta como consulta de catálogo."
                    ),
                },
            ],
            "pendencias_manuais": [
                {
                    "tipo": "modelo",
                    "id": "categoria-musica",
                    "campos": ["catalogo", "renderizador"],
                    "motivo": "Txai permanece provisoriamente na estrutura de filmes até futura implementação de música."
                }
            ],
        },
    }


def find_object_bounds(text: str, key_position: int) -> tuple[int, int]:
    start = text.rfind("{", 0, key_position)
    if start < 0:
        raise RuntimeError("Início do objeto da curadoria não encontrado")

    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return start, index
    raise RuntimeError("Fim do objeto da curadoria não encontrado")


def patch_curations() -> None:
    text = CURATIONS.read_text(encoding="utf-8")
    payload = curation_payload()
    rendered = textwrap.indent(json.dumps(payload, ensure_ascii=False, indent=2), "    ")
    key = f'"id": "{CURATION_ID}"'
    position = text.find(key)

    if position < 0:
        marker = "\n  ]\n}"
        if marker not in text:
            raise RuntimeError("Fechamento de curadorias-site.json não encontrado")
        head, tail = text.rsplit(marker, 1)
        CURATIONS.write_text(head + ",\n" + rendered + marker + tail, encoding="utf-8")
        return

    start, end = find_object_bounds(text, position)
    line_start = text.rfind("\n", 0, start) + 1
    updated = text[:line_start] + rendered + text[end + 1:]
    CURATIONS.write_text(updated, encoding="utf-8")


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
    block = f"""    }},
    {{
      id: 'vestibular-ufmg',
      label: 'Vestibular UFMG',
      description: 'Obras do Seriado UFMG 2026',
      swatch: 'is-default',
      panelProfile: 'vestibular-ufmg-seriado-2026',
      profileLabel: 'Vestibular UFMG',
      banner: {{
        src: '{BANNER_PATH}',
        alt: 'Obra para Vestibular — UFMG'
      }}
    }}
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
const expectedImages = new Map([
  ['São Bernardo', 'imagens/curadorias/vestibular-ufmg/sao-bernardo.png'],
  ['Sobrevivendo ao racismo: memórias, cartas e o cotidiano da discriminação no Brasil', 'imagens/curadorias/vestibular-ufmg/sobrevivendo-ao-racismo.png'],
  ['O quinze', 'imagens/curadorias/vestibular-ufmg/o-quinze.png'],
  ['Ideias para adiar o fim do mundo', 'imagens/curadorias/vestibular-ufmg/ideias-para-adiar-o-fim-do-mundo.png'],
  ['Balé de Pé no Chão — a dança afro de Mercedes Baptista', 'imagens/curadorias/vestibular-ufmg/bale-de-pe-no-chao.png'],
  ['Txai', 'imagens/curadorias/vestibular-ufmg/txai.png'],
]);

for (const item of allItems) {
  assert.ok(item.temas.includes('Vestibular UFMG'), `${item.titulo}: tema Vestibular UFMG ausente`);
  assert.equal(item.vestibular.instituicao, 'UFMG');
  assert.equal(item.vestibular.processo, 'Seriado UFMG');
  assert.equal(item.vestibular.ano_prova, 2026);
  assert.equal(item.vestibular.obrigatoria, true);
  assert.equal(item.imagem, expectedImages.get(item.titulo), `${item.titulo}: caminho de imagem inesperado`);
}

const books = new Map(curation.complementos.livros.map(item => [item.titulo, item]));
assert.equal(books.get('São Bernardo').acervos.length, 6);
assert.ok(books.get('São Bernardo').bibliotecas.includes('FMC-PBH'));
assert.ok(books.get('São Bernardo').bibliotecas.includes('Biblioteca Pública Estadual de Minas Gerais'));
assert.ok(books.get('São Bernardo').bibliotecas.includes('BibliON'));
assert.ok(books.get('São Bernardo').bibliotecas.includes('MEC Livros'));
assert.equal(books.get('Sobrevivendo ao racismo: memórias, cartas e o cotidiano da discriminação no Brasil').acervos.length, 2);
assert.equal(books.get('O quinze').acervos.length, 3);
assert.equal(books.get('Ideias para adiar o fim do mundo').acervos.length, 3);

const txai = curation.complementos.filmes.find(item => item.titulo === 'Txai');
assert.ok(txai, 'Txai ausente');
assert.equal(txai.tipo_conteudo_real, 'album_musical');
assert.equal(txai.representacao_temporaria, 'filmes');
assert.ok(txai.generos.includes('Álbum musical'));
assert.equal(txai.link, 'https://open.spotify.com/intl-pt/album/37EITqrt8brFFMNvVDQmrR');

assert.match(appSource, /'vestibular-ufmg-seriado-2026':\s*\{[\s\S]*theme: 'vestibular ufmg'/);
assert.match(themesSource, /id: 'vestibular-ufmg',[\s\S]*panelProfile: 'vestibular-ufmg-seriado-2026'/);
assert.match(themesSource, /src: 'imagens\/curadorias\/vestibular-ufmg-banner\.png'/);

// Protege os perfis já existentes contra remoção acidental.
assert.match(appSource, /'agosto-lilas-2026':/);
assert.match(appSource, /'setembro-amarelo-2026':/);
assert.match(themesSource, /panelProfile: 'agosto-lilas-2026'/);
assert.match(themesSource, /panelProfile: 'setembro-amarelo-2026'/);

// Links corrigidos e protegidos por regressão.
const baleLinkCheck = curation.complementos.filmes.find(item => item.id === 'site:vestibular-ufmg:bale-de-pe-no-chao');
assert.ok(baleLinkCheck, 'Balé de Pé no Chão ausente');
assert.equal(baleLinkCheck.plataforma, 'YouTube');
assert.equal(baleLinkCheck.link, 'https://www.youtube.com/watch?v=x9CMU4aayjU');
assert.equal(baleLinkCheck.pagina_oficial, 'https://www.youtube.com/watch?v=x9CMU4aayjU');

const quinzeLinkCheck = curation.complementos.livros.find(item => item.id === 'site:vestibular-ufmg:o-quinze');
assert.ok(quinzeLinkCheck, 'O quinze ausente');
const quinzeUrls = quinzeLinkCheck.acervos.flatMap(acervo => acervo.registros || []).map(registro => registro.link || registro.link_fisico || registro.link_virtual || '');
assert.ok(quinzeUrls.includes('https://pergamum.ifmg.edu.br/pesquisa_avancada?q=quinze&for=TITULO&condition=AND&q2=queiroz&for2=AUTOR&tipo_obra=49%252C&keyword_type=P&cr=N&orderBy=obra&direction=C'), 'Link avançado do IFMG para O quinze ausente');
assert.ok(quinzeUrls.includes('https://bibliotecasfmc.pbh.gov.br/pesquisa_avancada?q=quinze&for=TITULO&condition=AND&q2=queiroz&for2=AUTOR&keyword_type=P&cr=N&orderBy=obra&direction=C'), 'Link avançado da FMC-PBH para O quinze ausente');
assert.ok(quinzeUrls.includes('http://200.198.28.214/pesquisa_avancada?for=TITULO&q=quinze&condition=AND&for2=AUTOR&q2=queiroz&keyword_type=P'), 'Link avançado da BPEMG para O quinze ausente');

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
