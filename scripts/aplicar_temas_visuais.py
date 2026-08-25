#!/usr/bin/env python3
"""Integra o sistema de temas visuais ao site e ao cache do PWA.

A aparência é deliberadamente independente do filtro editorial de conteúdo.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SW = ROOT / "service-worker.js"

CSS_TAG = '  <link rel="stylesheet" href="css/temas-visuais.css?v=1">'
BOOT_TAG = '  <script src="js/tema-visual-boot.js?v=1"></script>'
JS_TAG = '  <script src="js/temas-visuais.js?v=1" defer></script>'

CSS_ASSET = "  './css/temas-visuais.css?v=1',"
BOOT_ASSET = "  './js/tema-visual-boot.js?v=1',"
JS_ASSET = "  './js/temas-visuais.js?v=1',"
BANNER_ASSET = "  './imagens/curadorias/agosto-lilas-banner.svg',"
BANNER_PATH = "./imagens/curadorias/agosto-lilas-banner.svg"
CACHE_VERSION = "mural-cultural-v85-temas-visuais"

OLD_INDEX_PATTERNS = [
    r'^[ \t]*<link[^>]+curadoria-agosto-lilas\.css\?v=\d+[^>]*>[ \t]*\n?',
    r'^[ \t]*<script[^>]+curadoria-agosto-lilas\.js\?v=\d+[^>]*></script>[ \t]*\n?',
]
OLD_SW_PATTERN = r"^[ \t]*'\./(?:css|js)/curadoria-agosto-lilas\.(?:css|js)\?v=\d+',[ \t]*\n?"


def patch_index() -> None:
    text = INDEX.read_text(encoding="utf-8")

    for pattern in OLD_INDEX_PATTERNS:
        text = re.sub(pattern, "", text, flags=re.MULTILINE)

    # Remove versões anteriores do novo sistema para manter uma única referência.
    text = re.sub(r'^[ \t]*<link[^>]+css/temas-visuais\.css\?v=\d+[^>]*>[ \t]*\n?', '', text, flags=re.MULTILINE)
    text = re.sub(r'^[ \t]*<script[^>]+js/tema-visual-boot\.js\?v=\d+[^>]*></script>[ \t]*\n?', '', text, flags=re.MULTILINE)
    text = re.sub(r'^[ \t]*<script[^>]+js/temas-visuais\.js\?v=\d+[^>]*></script>[ \t]*\n?', '', text, flags=re.MULTILINE)

    css_anchor = '  <link rel="stylesheet" href="css/concursos-mural.css?v=2">'
    if css_anchor not in text:
        raise RuntimeError("Âncora CSS não encontrada em index.html")
    text = text.replace(css_anchor, f"{css_anchor}\n{CSS_TAG}\n{BOOT_TAG}", 1)

    js_pattern = r'(  <script src="js/app\.js\?v=\d+" defer></script>)'
    if not re.search(js_pattern, text):
        raise RuntimeError("Âncora js/app.js não encontrada em index.html")
    text = re.sub(js_pattern, rf'\1\n{JS_TAG}', text, count=1)

    # Mantém a indentação do bloco final mesmo após migrações antigas.
    text = re.sub(r'(?m)^[ \t]*<script src="js/eventos-manuais-ui\.js', '  <script src="js/eventos-manuais-ui.js', text)

    INDEX.write_text(text, encoding="utf-8")


def patch_service_worker() -> None:
    text = SW.read_text(encoding="utf-8")

    text = re.sub(
        r"const CACHE_VERSION = '[^']+';",
        f"const CACHE_VERSION = '{CACHE_VERSION}';",
        text,
        count=1,
    )

    text = re.sub(OLD_SW_PATTERN, '', text, flags=re.MULTILINE)
    for name in ('css/temas-visuais.css', 'js/tema-visual-boot.js', 'js/temas-visuais.js'):
        text = re.sub(
            rf"^[ \t]*'\./{re.escape(name)}\?v=\d+',[ \t]*\n?",
            '',
            text,
            flags=re.MULTILINE,
        )

    # O banner pode ter vindo do sistema anterior; remove todas as ocorrências
    # e insere exatamente uma no bloco de assets ativos.
    text = re.sub(
        r"^[ \t]*'\./imagens/curadorias/agosto-lilas-banner\.svg',[ \t]*\n?",
        '',
        text,
        flags=re.MULTILINE,
    )

    css_anchor = "  './css/concursos-mural.css?v=2',"
    if css_anchor not in text:
        raise RuntimeError("Âncora CSS não encontrada em service-worker.js")
    text = text.replace(css_anchor, f"{css_anchor}\n{CSS_ASSET}\n{BOOT_ASSET}", 1)

    app_pattern = r"^[ \t]*'\./js/app\.js\?v=\d+',[ \t]*$"
    app_match = re.search(app_pattern, text, flags=re.MULTILINE)
    if not app_match:
        raise RuntimeError("Âncora js/app.js não encontrada em service-worker.js")
    app_line = app_match.group(0).strip()
    text = text[:app_match.start()] + f"  {app_line}\n{JS_ASSET}" + text[app_match.end():]

    manifest_pattern = r"^[ \t]*'\./manifest\.webmanifest',[ \t]*$"
    manifest_match = re.search(manifest_pattern, text, flags=re.MULTILINE)
    if not manifest_match:
        raise RuntimeError("Âncora de manifest não encontrada em service-worker.js")
    manifest_line = manifest_match.group(0).strip()
    text = text[:manifest_match.start()] + f"{BANNER_ASSET}\n  {manifest_line}" + text[manifest_match.end():]

    # Corrige linhas de asset eventualmente desindentadas por migrações antigas.
    text = re.sub(r"(?m)^'\./", "  './", text)

    SW.write_text(text, encoding="utf-8")


def validate() -> None:
    index = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    css = (ROOT / 'css' / 'temas-visuais.css').read_text(encoding='utf-8')
    boot = (ROOT / 'js' / 'tema-visual-boot.js').read_text(encoding='utf-8')
    js = (ROOT / 'js' / 'temas-visuais.js').read_text(encoding='utf-8')

    required = [
        (CSS_TAG, index, 'CSS de temas visuais no index'),
        (BOOT_TAG, index, 'boot do tema no index'),
        (JS_TAG, index, 'gerenciador visual no index'),
        (CACHE_VERSION, sw, 'versão do cache'),
        (CSS_ASSET, sw, 'CSS de temas no cache'),
        (BOOT_ASSET, sw, 'boot no cache'),
        (JS_ASSET, sw, 'gerenciador no cache'),
        (BANNER_ASSET, sw, 'banner no cache'),
        ('data-visual-theme="agosto-lilas-glow"', css, 'tema Glow no CSS'),
        ("DEFAULT_THEME = 'agosto-lilas-glow'", boot, 'tema inicial'),
        ("STORAGE_KEY = 'mural:visual-theme'", js, 'persistência da aparência'),
        ("Muda somente o visual", js, 'separação visual/conteúdo'),
    ]
    missing = [label for needle, haystack, label in required if needle not in haystack]
    if missing:
        raise RuntimeError(f"Integração de temas visuais incompleta: {missing}")

    if sw.count(BANNER_PATH) != 1:
        raise RuntimeError(f'Banner deve aparecer uma vez no cache; encontrado {sw.count(BANNER_PATH)}')
    if 'curadoria-agosto-lilas.css' in index or 'curadoria-agosto-lilas.js' in index:
        raise RuntimeError('Módulo visual antigo ainda está carregado no index')
    if 'curadoria-agosto-lilas.css' in sw or 'curadoria-agosto-lilas.js' in sw:
        raise RuntimeError('Módulo visual antigo ainda está no cache ativo')


def main() -> None:
    patch_index()
    patch_service_worker()
    validate()
    print('Temas visuais integrados: Padrão + Agosto Lilás Glow')
    print('Tema visual e filtro de conteúdo permanecem independentes.')


if __name__ == '__main__':
    main()
