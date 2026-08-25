#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "js" / "app.js"
INTEGRATOR = ROOT / "scripts" / "integrar_perfis_editoriais.py"
INDEX = ROOT / "index.html"
SW = ROOT / "service-worker.js"

OLD_FILTER = ".filter(editorialProfileIsVisible)"
NEW_FILTER = ".filter(profile => editorialProfileIsVisible(profile))"


def replace_filter(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if NEW_FILTER in text and OLD_FILTER not in text:
        return
    count = text.count(OLD_FILTER)
    if count != 1:
        raise RuntimeError(f"Esperava 1 ocorrência do filtro incorreto em {path}, encontrei {count}")
    path.write_text(text.replace(OLD_FILTER, NEW_FILTER, 1), encoding="utf-8")


def update_versions() -> None:
    index = INDEX.read_text(encoding="utf-8")
    index = re.sub(r'js/app\.js\?v=\d+', 'js/app.js?v=83', index)
    INDEX.write_text(index, encoding="utf-8")

    sw = SW.read_text(encoding="utf-8")
    sw = re.sub(
        r"const CACHE_VERSION = 'mural-cultural-v[^']+';",
        "const CACHE_VERSION = 'mural-cultural-v91-perfil-editorial-visivel';",
        sw,
        count=1,
    )
    sw = re.sub(r'\./js/app\.js\?v=\d+', './js/app.js?v=83', sw)
    SW.write_text(sw, encoding="utf-8")


def validate() -> None:
    app = APP.read_text(encoding="utf-8")
    integrator = INTEGRATOR.read_text(encoding="utf-8")
    index = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")

    assert OLD_FILTER not in app
    assert NEW_FILTER in app
    assert OLD_FILTER not in integrator
    assert NEW_FILTER in integrator
    assert "const BUILTIN_PANEL_PROFILES" in app
    assert "'agosto-lilas-2026'" in app
    assert "js/app.js?v=83" in index
    assert "mural-cultural-v91-perfil-editorial-visivel" in sw
    assert "./js/app.js?v=83" in sw
    assert "./imagens/curadorias/agosto-lilas-banner.png" in sw


if __name__ == "__main__":
    replace_filter(APP)
    replace_filter(INTEGRATOR)
    update_versions()
    validate()
    print("Filtro de visibilidade dos perfis editoriais corrigido.")
