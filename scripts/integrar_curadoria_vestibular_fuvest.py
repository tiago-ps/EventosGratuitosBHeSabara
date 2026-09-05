from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import quote, quote_plus

ROOT = Path(__file__).resolve().parents[1]
CURATIONS = ROOT / "curadorias-site.json"
APP = ROOT / "js" / "app.js"
SW = ROOT / "service-worker.js"
TEST = ROOT / "testes" / "vestibular-fuvest-curadoria.test.cjs"

CID = "vestibular-fuvest-2027"
THEME = "Vestibular FUVEST"
IMG = "imagens/curadorias/vestibular-fuvest-2027"

LIB_NAMES = {
    "ifmg": "IFMG",
    "fmc": "FMC-PBH",
    "bpemg": "Biblioteca Pública Estadual de Minas Gerais",
    "biblion": "BibliON",
    "mec": "MEC Livros",
    "ufmg": "UFMG",
    "empbh": "Bibliotecas Escolares da PBH",
    "puc": "PUC Minas",
}


def catalog_url(code: str, title: str, author: str) -> str:
    t, a = quote(title, safe=""), quote(author, safe="")
    common = f"q={t}&for=TITULO&condition=AND&q2={a}&for2=AUTOR&keyword_type=P&cr=N&orderBy=obra&direction=C"
    if code == "ifmg":
        return f"https://pergamum.ifmg.edu.br/pesquisa_avancada?{common}"
    if code == "fmc":
        return f"https://bibliotecasfmc.pbh.gov.br/pesquisa_avancada?{common}"
    if code == "bpemg":
        return f"http://200.198.28.214/pesquisa_avancada?for=TITULO&q={t}&condition=AND&for2=AUTOR&q2={a}&keyword_type=P"
    if code == "biblion":
        return f"https://biblion.arvore.com.br/biblioteca/busca/%22{t}%22%22{a}%22"
    if code == "mec":
        return f"https://meclivros.mec.gov.br/search?search=%22{quote_plus(title)}%22%22{quote_plus(author)}%22"
    if code == "ufmg":
        return f"https://catalogobiblioteca.ufmg.br/pesquisa_avancada?q={t}&for=TITULO&q2={a}&for2=AUTOR&condition=AND&keyword_type=P&cr=N"
    if code == "empbh":
        return f"https://bibliotecaspbh.pbh.gov.br/pesquisa_avancada?{common}"
    if code == "puc":
        return f"https://bib.pucminas.br/pesquisa_avancada?q={t}&for=TITULO&q2={a}&for2=AUTOR&condition=AND&keyword_type=P&cr=N"
    raise ValueError(code)


def record(title, author, library, rid, *, link="", link_fisico="", link_virtual="",
           codigo="", chamada="", fisico=False, virtual=False, kind="consulta_catalogo", confirmed=False):
    out = {
        "registro_id": rid,
        "titulo_registro": title,
        "autor_registro": author,
        "biblioteca_rede": library,
        "unidade": "",
        "codigo_acervo": codigo,
        "numero_chamada": chamada,
        "acesso_fisico": fisico,
        "acesso_virtual": virtual,
        "tipo_registro": kind,
        "disponibilidade_confirmada": confirmed,
    }
    if link:
        out["link"] = link
    if link_fisico:
        out["link_fisico"] = link_fisico
    if link_virtual:
        out["link_virtual"] = link_virtual
    return out


def holding(name, records):
    return {
        "biblioteca": name,
        "biblioteca_rede": name,
        "unidade": "",
        "acesso_fisico": any(r.get("acesso_fisico") for r in records),
        "acesso_virtual": any(r.get("acesso_virtual") for r in records),
        "registros": records,
    }


BOOKS = [
    {
        "slug": "opusculo-humanitario", "title": "Opúsculo Humanitário", "author": "Nísia Floresta", "year": 1853,
        "libs": ["ifmg", "bpemg", "biblion", "mec", "ufmg", "puc"],
        "digital": ("Biblioteca Digital do Senado Federal", "senado:opusculo-humanitario",
                    "https://www2.senado.leg.br/bdsf/bitstream/handle/id/658727/Opusculo_humanitario_3.ed.pdf"),
    },
    {
        "slug": "nebulosas", "title": "Nebulosas", "author": "Narcisa Amália", "year": 1872,
        "libs": ["ifmg", "biblion", "mec"],
        "digital": ("Biblioteca Brasiliana Guita e José Mindlin — USP", "bbm:8413",
                    "https://digital.bbm.usp.br/handle/bbm/8413"),
    },
    {
        "slug": "memorias-de-martha", "title": "Memórias de Martha", "author": "Julia Lopes de Almeida", "year": 1899,
        "libs": ["ifmg", "biblion", "mec", "ufmg", "empbh", "puc"],
        "digital": ("Biblioteca Brasiliana Guita e José Mindlin — USP", "bbm:7037",
                    "https://digital.bbm.usp.br/handle/bbm/7037"),
    },
    {
        "slug": "caminho-de-pedras", "title": "Caminho de pedras", "author": "Rachel de Queiroz", "year": 1937,
        "libs": ["fmc", "bpemg", "biblion", "ufmg", "empbh", "puc"],
    },
    {
        "slug": "a-paixao-segundo-g-h", "title": "A paixão segundo G. H.", "author": "Clarice Lispector", "year": 1964,
        "libs": ["ifmg", "fmc", "bpemg", "biblion", "ufmg", "empbh", "puc"],
        "physical": ("109238", "821(81)-3 L771p 2020 (SB)"),
    },
    {
        "slug": "geografia", "title": "Geografia", "author": "Sophia de Mello Breyner Andresen", "year": 1967,
        "libs": ["bpemg", "ufmg"],
    },
    {
        "slug": "balada-de-amor-ao-vento", "title": "Balada de amor ao vento", "author": "Paulina Chiziane", "year": 1990,
        "libs": ["ifmg", "fmc", "biblion", "ufmg", "puc"],
    },
    {
        "slug": "cancao-para-ninar-menino-grande", "title": "Canção para ninar menino grande", "author": "Conceição Evaristo", "year": 2018,
        "libs": ["ifmg", "fmc", "bpemg", "biblion", "mec", "ufmg", "empbh", "puc"],
        "physical": ("108962", "821(81)-31 E92c 2024 (OB)"),
    },
    {
        "slug": "a-visao-das-plantas", "title": "A visão das plantas", "author": "Djaimilia Pereira de Almeida", "year": 2019,
        "libs": ["fmc", "biblion", "mec", "ufmg"],
    },
]


def make_book(spec):
    title, author = spec["title"], spec["author"]
    acervos = []
    if spec.get("digital"):
        name, rid, url = spec["digital"]
        acervos.append(holding(name, [record(
            title, author, name, rid, link_virtual=url, virtual=True,
            kind="acesso_integral_legal", confirmed=True
        )]))
    for code in spec["libs"]:
        name = LIB_NAMES[code]
        records = []
        if code == "ifmg" and spec.get("physical"):
            codigo, chamada = spec["physical"]
            records.append(record(
                title, author, "IFMG Sabará", f"ifmg:{codigo}",
                link_fisico=f"https://pergamum.ifmg.edu.br/acervo/{codigo}",
                codigo=codigo, chamada=chamada, fisico=True,
                kind="exemplar_fisico_confirmado", confirmed=True
            ))
        records.append(record(
            title, author, name, f"{code}:busca:{spec['slug']}",
            link=catalog_url(code, title, author)
        ))
        acervos.append(holding("IFMG Sabará" if code == "ifmg" and spec.get("physical") else name, records))
    digital = spec.get("digital")
    physical = spec.get("physical")
    if digital:
        primary, primary_type, virtual = digital[2], "virtual", True
    elif physical:
        primary, primary_type, virtual = f"https://pergamum.ifmg.edu.br/acervo/{physical[0]}", "fisico", False
    else:
        primary, primary_type, virtual = catalog_url(spec["libs"][0], title, author), "catalogo", False
    return {
        "id": f"site:vestibular-fuvest:{spec['slug']}",
        "tipo_conteudo": "livro",
        "titulo": title,
        "autor": author,
        "ano": spec["year"],
        "imagem": f"{IMG}/{spec['slug']}.png",
        "pergunta_curiosidade": "Leitura obrigatória do Vestibular FUVEST 2027.",
        "texto_apoio": (
            f"{title}, de {author}, integra a lista oficial de nove leituras obrigatórias "
            "do Vestibular FUVEST 2027. Os links distinguem acesso confirmado de consulta a catálogos."
        ),
        "temas": [THEME, "FUVEST 2027", "USP", "Leitura obrigatória"],
        "icone": "📚",
        "biblioteca_rede": "Diversos acervos e bibliotecas",
        "codigo_acervo": physical[0] if physical else "",
        "acesso_fisico": bool(physical),
        "acesso_virtual": virtual,
        "link": primary,
        "tipo_link_principal": primary_type,
        "fonte": "FUVEST / acervos de bibliotecas",
        "exibicao_ativa": True,
        "acervos": acervos,
        "acervos_quantidade": len(acervos),
        "registros_acervo_quantidade": sum(len(a["registros"]) for a in acervos),
        "bibliotecas": [a["biblioteca"] for a in acervos],
        "vestibular": {
            "instituicao": "FUVEST / USP",
            "processo": "Vestibular FUVEST 2027",
            "ano_vestibular": 2027,
            "ano_prova": 2026,
            "ciclo": "2027",
            "obrigatoria": True,
            "tipo_obra": "Livro",
        },
    }


def curation():
    return {
        "id": CID,
        "nome": "Vestibular FUVEST 2027 — Leituras obrigatórias",
        "ativo_de": "2026-08-17",
        "ativo_ate": "2026-12-07",
        "tema": THEME,
        "instituicao": "FUVEST / USP",
        "processo": "Vestibular FUVEST 2027",
        "ano_vestibular": 2027,
        "ano_prova": 2026,
        "titulo_editorial": "Obras para Vestibular — FUVEST 2027",
        "subtitulo_editorial": "As nove leituras obrigatórias do Vestibular da USP",
        "texto_introdutorio": (
            "Curadoria das nove leituras obrigatórias do Vestibular FUVEST 2027. "
            "Reúne exemplares confirmados, obras integrais em fontes institucionais "
            "e links de consulta a diferentes catálogos de bibliotecas."
        ),
        "banner": f"{IMG}/banner.png",
        "perfil_visual": None,
        "overlays": {"eventos": {}, "cursos": {}, "livros": {}, "filmes": {}},
        "complementos": {"eventos": [], "livros": [make_book(b) for b in BOOKS], "cursos": [], "filmes": []},
    }


def update_curations():
    payload = json.loads(CURATIONS.read_text(encoding="utf-8"))
    items = payload.setdefault("curadorias", [])
    new = curation()
    for i, item in enumerate(items):
        if item.get("id") == CID:
            items[i] = new
            break
    else:
        items.append(new)
    CURATIONS.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_app():
    src = APP.read_text(encoding="utf-8")
    if f"'{CID}':" in src:
        return
    anchor = "    }\n  });\n  const AGENDA_BATCH_SIZE = 24;"
    block = """    },
    'vestibular-fuvest-2027': {
      nome: 'Vestibular FUVEST 2027 — Leituras obrigatórias',
      destaque: 'Leituras obrigatórias',
      ativo_de: '2026-08-17',
      ativo_ate: '2026-12-07',
      configuracao: {
        modules: { events: false, books: true, courses: false, contests: false, films: false },
        theme: 'vestibular fuvest',
        eventCities: [], eventCategory: '', eventProgram: '', eventUnit: '',
        bookCampuses: [], bookAccess: '', filmGenre: '', filmRating: '', filmDuration: '',
        weights: { events: 1, books: 1, courses: 1, contests: 1, films: 1 },
        slideDuration: 0
      }
    }
  });
  const AGENDA_BATCH_SIZE = 24;"""
    if anchor not in src:
        raise SystemExit("Âncora de BUILTIN_PANEL_PROFILES não encontrada")
    APP.write_text(src.replace(anchor, block, 1), encoding="utf-8")


def update_sw():
    src = SW.read_text(encoding="utf-8")
    if "VESTIBULAR_FUVEST_IMAGE_PREFIX" in src:
        return
    src = src.replace(
        "const VESTIBULAR_UFMG_IMAGE_PREFIX = '/imagens/curadorias/vestibular-ufmg/';",
        "const VESTIBULAR_UFMG_IMAGE_PREFIX = '/imagens/curadorias/vestibular-ufmg/';\n"
        "const VESTIBULAR_FUVEST_IMAGE_PREFIX = '/imagens/curadorias/vestibular-fuvest-2027/';",
        1,
    )
    src = src.replace(
        "url.pathname.includes(VESTIBULAR_UFMG_IMAGE_PREFIX)\n  ) {",
        "url.pathname.includes(VESTIBULAR_UFMG_IMAGE_PREFIX) ||\n"
        "    url.pathname.includes(VESTIBULAR_FUVEST_IMAGE_PREFIX)\n  ) {",
        1,
    )
    SW.write_text(src, encoding="utf-8")


TEST_SOURCE = r"""'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'curadorias-site.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const c = data.curadorias.find(x => x.id === 'vestibular-fuvest-2027');
assert.ok(c); assert.equal(c.ativo_de, '2026-08-17'); assert.equal(c.ativo_ate, '2026-12-07');
assert.equal(c.perfil_visual, null); assert.equal(c.complementos.livros.length, 9);
const expected = [
['Opúsculo Humanitário','Nísia Floresta',1853,'opusculo-humanitario'],
['Nebulosas','Narcisa Amália',1872,'nebulosas'],
['Memórias de Martha','Julia Lopes de Almeida',1899,'memorias-de-martha'],
['Caminho de pedras','Rachel de Queiroz',1937,'caminho-de-pedras'],
['A paixão segundo G. H.','Clarice Lispector',1964,'a-paixao-segundo-g-h'],
['Geografia','Sophia de Mello Breyner Andresen',1967,'geografia'],
['Balada de amor ao vento','Paulina Chiziane',1990,'balada-de-amor-ao-vento'],
['Canção para ninar menino grande','Conceição Evaristo',2018,'cancao-para-ninar-menino-grande'],
['A visão das plantas','Djaimilia Pereira de Almeida',2019,'a-visao-das-plantas']];
const books = new Map(c.complementos.livros.map(x => [x.titulo,x]));
for (const [t,a,y,s] of expected) {
  const b=books.get(t); assert.ok(b,t); assert.equal(b.autor,a); assert.equal(b.ano,y);
  assert.equal(b.imagem,`imagens/curadorias/vestibular-fuvest-2027/${s}.png`);
  assert.equal(b.vestibular.instituicao,'FUVEST / USP'); assert.equal(b.vestibular.ano_vestibular,2027);
  assert.ok(b.acervos.length); for (const r of b.acervos.flatMap(x=>x.registros))
    if (r.tipo_registro==='consulta_catalogo') assert.equal(r.disponibilidade_confirmada,false);
}
assert.equal(books.get('Opúsculo Humanitário').link,'https://www2.senado.leg.br/bdsf/bitstream/handle/id/658727/Opusculo_humanitario_3.ed.pdf');
assert.equal(books.get('Nebulosas').link,'https://digital.bbm.usp.br/handle/bbm/8413');
assert.equal(books.get('Memórias de Martha').link,'https://digital.bbm.usp.br/handle/bbm/7037');
assert.equal(books.get('A paixão segundo G. H.').codigo_acervo,'109238');
assert.equal(books.get('Canção para ninar menino grande').codigo_acervo,'108962');
assert.match(app,/'vestibular-fuvest-2027':\s*\{[\s\S]*theme: 'vestibular fuvest'/);
assert.match(sw,/VESTIBULAR_FUVEST_IMAGE_PREFIX = '\/imagens\/curadorias\/vestibular-fuvest-2027\/'/);
console.log('Curadoria Vestibular FUVEST 2027 validada.');
"""


def main():
    update_curations()
    update_app()
    update_sw()
    TEST.write_text(TEST_SOURCE + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
