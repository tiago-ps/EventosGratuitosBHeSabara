#!/usr/bin/env python3
"""Integra os assets visuais do Agosto Lilás ao site e ao cache do PWA."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SW = ROOT / "service-worker.js"

CSS_TAG = '  <link rel="stylesheet" href="css/curadoria-agosto-lilas.css?v=1">'
JS_TAG = '  <script src="js/curadoria-agosto-lilas.js?v=1" defer></script>'
CSS_ASSET = "  './css/curadoria-agosto-lilas.css?v=1',"
JS_ASSET = "  './js/curadoria-agosto-lilas.js?v=1',"
CACHE_VERSION = "mural-cultural-v83-agosto-lilas-visual"


def patch_index() -> None:
    text = INDEX.read_text(encoding="utf-8")

    if CSS_TAG not in text:
        anchor = '  <link rel="stylesheet" href="css/concursos-mural.css?v=2">'
        if anchor not in text:
            raise RuntimeError("Âncora CSS não encontrada em index.html")
        text = text.replace(anchor, f"{anchor}\n{CSS_TAG}", 1)

    if JS_TAG not in text:
        pattern = r'(  <script src="js/app\.js\?v=\d+" defer></script>)'
        if not re.search(pattern, text):
            raise RuntimeError("Âncora js/app.js não encontrada em index.html")
        text = re.sub(pattern, rf'\1\n{JS_TAG}', text, count=1)

    INDEX.write_text(text, encoding="utf-8")


def patch_service_worker() -> None:
    text = SW.read_text(encoding="utf-8")
    text = re.sub(
        r"const CACHE_VERSION = '[^']+';",
        f"const CACHE_VERSION = '{CACHE_VERSION}';",
        text,
        count=1,
    )

    if CSS_ASSET not in text:
        anchor = "  './css/concursos-mural.css?v=2',"
        if anchor not in text:
            raise RuntimeError("Âncora CSS não encontrada em service-worker.js")
        text = text.replace(anchor, f"{anchor}\n{CSS_ASSET}", 1)

    if JS_ASSET not in text:
        pattern = r"(  '\./js/app\.js\?v=\d+',)"
        if not re.search(pattern, text):
            raise RuntimeError("Âncora js/app.js não encontrada em service-worker.js")
        text = re.sub(pattern, rf'\1\n{JS_ASSET}', text, count=1)

    SW.write_text(text, encoding="utf-8")


def validate() -> None:
    index = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    css = (ROOT / "css" / "curadoria-agosto-lilas.css").read_text(encoding="utf-8")
    js = (ROOT / "js" / "curadoria-agosto-lilas.js").read_text(encoding="utf-8")

    required = [
        (CSS_TAG, index, "CSS no index"),
        (JS_TAG, index, "JS no index"),
        (CACHE_VERSION, sw, "versão do cache"),
        (CSS_ASSET, sw, "CSS no cache"),
        (JS_ASSET, sw, "JS no cache"),
        ("body.panel-mode.theme-agosto-lilas .slide", css, "fundo temático"),
        (".campaign-agosto-lilas-badge", css, "selo temático"),
        ("document.body.classList.toggle(BODY_CLASS, active)", js, "ativação condicional"),
    ]
    missing = [label for needle, haystack, label in required if needle not in haystack]
    if missing:
        raise RuntimeError(f"Integração visual incompleta: {missing}")


def main() -> None:
    patch_index()
    patch_service_worker()
    validate()
    print("Visual Agosto Lilás integrado: selo + degradê + cache PWA")


if __name__ == "__main__":
    main()
