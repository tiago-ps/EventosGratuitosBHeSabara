#!/usr/bin/env python3
"""Integra os assets visuais do Agosto Lilás ao site e ao cache do PWA."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SW = ROOT / "service-worker.js"

CSS_TAG = '  <link rel="stylesheet" href="css/curadoria-agosto-lilas.css?v=2">'
JS_TAG = '  <script src="js/curadoria-agosto-lilas.js?v=2" defer></script>'
CSS_ASSET = "  './css/curadoria-agosto-lilas.css?v=2',"
JS_ASSET = "  './js/curadoria-agosto-lilas.js?v=2',"
BANNER_ASSET = "  './imagens/curadorias/agosto-lilas-banner.svg',"
CACHE_VERSION = "mural-cultural-v84-agosto-lilas-banner"


def patch_index() -> None:
    text = INDEX.read_text(encoding="utf-8")

    css_pattern = r'  <link rel="stylesheet" href="css/curadoria-agosto-lilas\.css\?v=\d+">'
    if re.search(css_pattern, text):
        text = re.sub(css_pattern, CSS_TAG, text, count=1)
    else:
        anchor = '  <link rel="stylesheet" href="css/concursos-mural.css?v=2">'
        if anchor not in text:
            raise RuntimeError("Âncora CSS não encontrada em index.html")
        text = text.replace(anchor, f"{anchor}\n{CSS_TAG}", 1)

    js_pattern = r'  <script src="js/curadoria-agosto-lilas\.js\?v=\d+" defer></script>'
    if re.search(js_pattern, text):
        text = re.sub(js_pattern, JS_TAG, text, count=1)
    else:
        anchor_pattern = r'(  <script src="js/app\.js\?v=\d+" defer></script>)'
        if not re.search(anchor_pattern, text):
            raise RuntimeError("Âncora js/app.js não encontrada em index.html")
        text = re.sub(anchor_pattern, rf'\1\n{JS_TAG}', text, count=1)

    INDEX.write_text(text, encoding="utf-8")


def patch_service_worker() -> None:
    text = SW.read_text(encoding="utf-8")
    text = re.sub(
        r"const CACHE_VERSION = '[^']+';",
        f"const CACHE_VERSION = '{CACHE_VERSION}';",
        text,
        count=1,
    )

    css_pattern = r"  '\./css/curadoria-agosto-lilas\.css\?v=\d+',"
    if re.search(css_pattern, text):
        text = re.sub(css_pattern, CSS_ASSET, text, count=1)
    else:
        anchor = "  './css/concursos-mural.css?v=2',"
        if anchor not in text:
            raise RuntimeError("Âncora CSS não encontrada em service-worker.js")
        text = text.replace(anchor, f"{anchor}\n{CSS_ASSET}", 1)

    js_pattern = r"  '\./js/curadoria-agosto-lilas\.js\?v=\d+',"
    if re.search(js_pattern, text):
        text = re.sub(js_pattern, JS_ASSET, text, count=1)
    else:
        anchor_pattern = r"(  '\./js/app\.js\?v=\d+',)"
        if not re.search(anchor_pattern, text):
            raise RuntimeError("Âncora js/app.js não encontrada em service-worker.js")
        text = re.sub(anchor_pattern, rf'\1\n{JS_ASSET}', text, count=1)

    if BANNER_ASSET not in text:
        anchor = JS_ASSET
        if anchor not in text:
            raise RuntimeError("Âncora do JS da curadoria não encontrada em service-worker.js")
        text = text.replace(anchor, f"{anchor}\n{BANNER_ASSET}", 1)

    SW.write_text(text, encoding="utf-8")


def validate() -> None:
    index = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    css = (ROOT / "css" / "curadoria-agosto-lilas.css").read_text(encoding="utf-8")
    js = (ROOT / "js" / "curadoria-agosto-lilas.js").read_text(encoding="utf-8")
    banner = ROOT / "imagens" / "curadorias" / "agosto-lilas-banner.svg"

    required = [
        (CSS_TAG, index, "CSS v2 no index"),
        (JS_TAG, index, "JS v2 no index"),
        (CACHE_VERSION, sw, "versão do cache"),
        (CSS_ASSET, sw, "CSS v2 no cache"),
        (JS_ASSET, sw, "JS v2 no cache"),
        (BANNER_ASSET, sw, "banner no cache"),
        ("body.panel-mode.theme-agosto-lilas .slide", css, "fundo temático"),
        ("height: 14.285%", css, "proporção 1/7"),
        ("imagens/curadorias/agosto-lilas-banner.svg", js, "banner visual"),
        ("document.body.classList.toggle(BODY_CLASS, active)", js, "ativação condicional"),
    ]
    missing = [label for needle, haystack, label in required if needle not in haystack]
    if missing:
        raise RuntimeError(f"Integração visual incompleta: {missing}")
    if not banner.exists():
        raise RuntimeError("Banner SVG do Agosto Lilás não encontrado")


def main() -> None:
    patch_index()
    patch_service_worker()
    validate()
    print("Visual Agosto Lilás integrado: banner com laço + degradê + cache PWA")


if __name__ == "__main__":
    main()
