#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "js" / "app.js"
INDEX = ROOT / "index.html"
SW = ROOT / "service-worker.js"

BUILTIN = """  const BUILTIN_PANEL_PROFILES = Object.freeze({
    'agosto-lilas-2026': {
      nome: 'Agosto Lilás — curadoria do mês',
      destaque: 'Sugestão do mês',
      ativo_de: '2026-08-01',
      ativo_ate: '2026-08-31',
      configuracao: {
        modules: {
          events: true,
          books: true,
          courses: true,
          contests: false,
          films: true
        },
        theme: 'agosto lilas',
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
          events: 5,
          books: 1,
          courses: 1,
          contests: 1,
          films: 1
        },
        slideDuration: 0
      }
    }
  });
"""

OLD_CONFIGURED = """  function configuredPanelProfiles() {
    const profiles = state.config?.perfis_painel;
    return profiles && typeof profiles === 'object' && !Array.isArray(profiles) ? profiles : {};
  }
"""

NEW_CONFIGURED = """  function configuredPanelProfiles() {
    const configured = state.config?.perfis_painel;
    const profiles = configured && typeof configured === 'object' && !Array.isArray(configured)
      ? configured
      : {};
    return { ...BUILTIN_PANEL_PROFILES, ...profiles };
  }
"""


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if text.count(old) != 1:
        raise RuntimeError(f"Trecho inesperado em {label}: {text.count(old)} ocorrências")
    return text.replace(old, new, 1)


def update_app() -> None:
    text = APP.read_text(encoding="utf-8")
    anchor = "  const PANEL_PROFILES_KEY = 'mural-cultural-perfis-painel-v1';\n"
    if "const BUILTIN_PANEL_PROFILES" not in text:
        if text.count(anchor) != 1:
            raise RuntimeError("Âncora PANEL_PROFILES_KEY não encontrada")
        text = text.replace(anchor, anchor + BUILTIN, 1)
    text = replace_once(text, OLD_CONFIGURED, NEW_CONFIGURED, "configuredPanelProfiles")
    APP.write_text(text, encoding="utf-8")


def update_versions() -> None:
    index = INDEX.read_text(encoding="utf-8")
    index = re.sub(r'js/app\.js\?v=\d+', 'js/app.js?v=82', index)
    INDEX.write_text(index, encoding="utf-8")

    sw = SW.read_text(encoding="utf-8")
    sw = re.sub(
        r"const CACHE_VERSION = 'mural-cultural-v[^']+';",
        "const CACHE_VERSION = 'mural-cultural-v90-perfil-editorial-fallback';",
        sw,
        count=1,
    )
    sw = re.sub(r'\./js/app\.js\?v=\d+', './js/app.js?v=82', sw)
    SW.write_text(sw, encoding="utf-8")


def validate() -> None:
    app = APP.read_text(encoding="utf-8")
    assert "const BUILTIN_PANEL_PROFILES" in app
    assert "'agosto-lilas-2026'" in app
    assert "return { ...BUILTIN_PANEL_PROFILES, ...profiles };" in app
    assert "Agosto Lilás — curadoria do mês" in app
    assert "js/app.js?v=82" in INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert "mural-cultural-v90-perfil-editorial-fallback" in sw
    assert "./js/app.js?v=82" in sw


if __name__ == "__main__":
    update_app()
    update_versions()
    validate()
    print("Fallback editorial Agosto Lilás integrado e frontend versionado.")
