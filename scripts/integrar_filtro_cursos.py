#!/usr/bin/env python3
"""Versiona o módulo de cursos após correções de filtragem temática."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SW = ROOT / "service-worker.js"
COURSES_JS = ROOT / "js" / "conteudos" / "cursos.js"

COURSES_VERSION = 2
CACHE_VERSION = "mural-cultural-v86-cursos-tema"


def atualizar_index() -> None:
    texto = INDEX.read_text(encoding="utf-8")
    novo, quantidade = re.subn(
        r'js/conteudos/cursos\.js\?v=\d+',
        f'js/conteudos/cursos.js?v={COURSES_VERSION}',
        texto,
    )
    if quantidade < 1:
        raise RuntimeError("Referência de cursos.js não encontrada em index.html")
    INDEX.write_text(novo, encoding="utf-8")


def atualizar_service_worker() -> None:
    texto = SW.read_text(encoding="utf-8")
    texto, cursos = re.subn(
        r"\./js/conteudos/cursos\.js\?v=\d+",
        f"./js/conteudos/cursos.js?v={COURSES_VERSION}",
        texto,
    )
    if cursos < 1:
        raise RuntimeError("Referência de cursos.js não encontrada no service worker")

    texto, cache = re.subn(
        r"const CACHE_VERSION = '[^']+';",
        f"const CACHE_VERSION = '{CACHE_VERSION}';",
        texto,
        count=1,
    )
    if cache != 1:
        raise RuntimeError("CACHE_VERSION não localizado no service worker")

    SW.write_text(texto, encoding="utf-8")


def validar() -> None:
    index = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    modulo = COURSES_JS.read_text(encoding="utf-8")

    esperado = f"js/conteudos/cursos.js?v={COURSES_VERSION}"
    obrigatorios = [
        (esperado, index, "cursos.js v2 no index"),
        (f"./{esperado}", sw, "cursos.js v2 no cache"),
        (CACHE_VERSION, sw, "nova versão do cache"),
        ("function matchesTheme(course, theme = '')", modulo, "matchesTheme no módulo"),
        (".filter(course => matchesTheme(course, theme))", modulo, "filtro temático no módulo"),
        ("matchesTheme,", modulo, "exportação de matchesTheme"),
    ]
    ausentes = [nome for trecho, texto, nome in obrigatorios if trecho not in texto]
    if ausentes:
        raise RuntimeError(f"Integração temática incompleta: {ausentes}")


def main() -> None:
    atualizar_index()
    atualizar_service_worker()
    validar()
    print(f"Cursos: módulo v{COURSES_VERSION}; cache {CACHE_VERSION}")


if __name__ == "__main__":
    main()
