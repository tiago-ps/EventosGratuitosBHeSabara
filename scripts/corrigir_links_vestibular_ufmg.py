from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CURATIONS = ROOT / "curadorias-site.json"
INTEGRATION = ROOT / "scripts" / "integrar_curadoria_vestibular_ufmg.py"
TEST = ROOT / "testes" / "vestibular-ufmg-curadoria.test.cjs"

YOUTUBE = "https://www.youtube.com/watch?v=x9CMU4aayjU"
IFMG_QUINZE = "https://pergamum.ifmg.edu.br/pesquisa_avancada?q=quinze&for=TITULO&condition=AND&q2=queiroz&for2=AUTOR&tipo_obra=49%252C&keyword_type=P&cr=N&orderBy=obra&direction=C"
FMC_QUINZE = "https://bibliotecasfmc.pbh.gov.br/pesquisa_avancada?q=quinze&for=TITULO&condition=AND&q2=queiroz&for2=AUTOR&keyword_type=P&cr=N&orderBy=obra&direction=C"
BPEMG_QUINZE = "http://200.198.28.214/pesquisa_avancada?for=TITULO&q=quinze&condition=AND&for2=AUTOR&q2=queiroz&keyword_type=P"

REPLACEMENTS = {
    '"plataforma": "TV Câmara"': '"plataforma": "YouTube"',
    "https://www.camara.leg.br/tv/401867-bale-de-pe-no-chao-a-danca-afro-de-mercedes-baptista/": YOUTUBE,
    "https://pergamum.ifmg.edu.br/pesquisa_geral?for=INDICE_1&q=O%2520quinze&page=1&perPage=20&orderBy=obra&direction=C": IFMG_QUINZE,
    "https://bibliotecasfmc.pbh.gov.br/pesquisa_geral?for=INDICE_1&q=O%2520quinze&page=1&perPage=20&orderBy=obra&direction=C": FMC_QUINZE,
    "http://200.198.28.214/?q=O%20quinze&for=INDICE_1": BPEMG_QUINZE,
}

TEST_MARKER = "// Links corrigidos e protegidos por regressão."
TEST_BLOCK = f"""
{TEST_MARKER}
const baleLinkCheck = curation.complementos.filmes.find(item => item.id === 'site:vestibular-ufmg:bale-de-pe-no-chao');
assert.ok(baleLinkCheck, 'Balé de Pé no Chão ausente');
assert.equal(baleLinkCheck.plataforma, 'YouTube');
assert.equal(baleLinkCheck.link, '{YOUTUBE}');
assert.equal(baleLinkCheck.pagina_oficial, '{YOUTUBE}');

const quinzeLinkCheck = curation.complementos.livros.find(item => item.id === 'site:vestibular-ufmg:o-quinze');
assert.ok(quinzeLinkCheck, 'O quinze ausente');
const quinzeUrls = quinzeLinkCheck.acervos.flatMap(acervo => acervo.registros || []).map(registro => registro.link || registro.link_fisico || registro.link_virtual || '');
assert.ok(quinzeUrls.includes('{IFMG_QUINZE}'), 'Link avançado do IFMG para O quinze ausente');
assert.ok(quinzeUrls.includes('{FMC_QUINZE}'), 'Link avançado da FMC-PBH para O quinze ausente');
assert.ok(quinzeUrls.includes('{BPEMG_QUINZE}'), 'Link avançado da BPEMG para O quinze ausente');
""".strip()


def replace_links(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    original = text
    for old, new in REPLACEMENTS.items():
        if old in text:
            text = text.replace(old, new)
        elif new not in text:
            raise RuntimeError(f"Nem valor antigo nem novo encontrado em {path.name}: {old}")
    if text != original:
        path.write_text(text, encoding="utf-8")


def protect_test(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if TEST_MARKER in text:
        return
    marker = "console.log('Curadoria Vestibular UFMG 2026 validada.');"
    if marker not in text:
        raise RuntimeError(f"Marcador final do teste não encontrado em {path}")
    text = text.replace(marker, f"{TEST_BLOCK}\n\n{marker}", 1)
    path.write_text(text, encoding="utf-8")


def main() -> None:
    replace_links(CURATIONS)
    replace_links(INTEGRATION)
    protect_test(TEST)
    protect_test(INTEGRATION)


if __name__ == "__main__":
    main()
