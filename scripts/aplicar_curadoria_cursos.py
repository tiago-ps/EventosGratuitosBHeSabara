#!/usr/bin/env python3
"""Aplica o piloto Agosto Lilás aos cursos e integra cursos ao filtro temático."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CURSOS = ROOT / "cursos.json"
APP = ROOT / "js" / "app.js"
SW = ROOT / "service-worker.js"


def substituir_uma_vez(texto: str, antigo: str, novo: str, marcador: str) -> str:
    if novo in texto:
        return texto
    if antigo not in texto:
        raise RuntimeError(f"Trecho não localizado: {marcador}")
    return texto.replace(antigo, novo, 1)


def aplicar_cursos() -> list[tuple[str, str]]:
    dados = json.loads(CURSOS.read_text(encoding="utf-8"))
    cursos = dados.get("cursos", [])
    if not isinstance(cursos, list) or len(cursos) < 1000:
        raise RuntimeError(f"Catálogo de cursos inesperado: {len(cursos) if isinstance(cursos, list) else 0}")

    selecionados: list[tuple[str, str]] = []
    for curso in cursos:
        temas = [str(t).strip() for t in (curso.get("temas") or []) if str(t).strip()]
        if any(t.casefold() == "feminismo" for t in temas):
            if "Agosto Lilás" not in temas:
                temas.append("Agosto Lilás")
            curso["temas"] = temas
            selecionados.append((str(curso.get("id_fonte") or ""), str(curso.get("titulo") or "")))

    if len(selecionados) < 10:
        raise RuntimeError(f"Curadoria Feminismo insuficiente para o piloto: {len(selecionados)} cursos")

    CURSOS.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return selecionados


def integrar_app() -> None:
    app = APP.read_text(encoding="utf-8")

    app = substituir_uma_vez(
        app,
        '''  function bookMatchesTheme(book, theme) {
    if (!theme) return true;
    return (Array.isArray(book.temas) ? book.temas : [])
      .map(normalizeText)
      .some(value => value === theme || value.includes(theme));
  }

  function universalThemeOptions() {''',
        '''  function bookMatchesTheme(book, theme) {
    if (!theme) return true;
    return (Array.isArray(book.temas) ? book.temas : [])
      .map(normalizeText)
      .some(value => value === theme || value.includes(theme));
  }

  function courseMatchesTheme(course, theme) {
    if (!theme) return true;
    return (Array.isArray(course.temas) ? course.temas : [])
      .map(normalizeText)
      .some(value => value === theme || value.includes(theme));
  }

  function universalThemeOptions() {''',
        "courseMatchesTheme",
    )

    app = substituir_uma_vez(
        app,
        '''    for (const event of state.allEvents) eventThemeLabels(event).forEach(add);
    for (const book of state.allBooks) (Array.isArray(book.temas) ? book.temas : []).forEach(add);
    for (const movie of state.allFilms) (Array.isArray(movie.temas) ? movie.temas : []).forEach(add);''',
        '''    for (const event of state.allEvents) eventThemeLabels(event).forEach(add);
    for (const book of state.allBooks) (Array.isArray(book.temas) ? book.temas : []).forEach(add);
    for (const course of state.allCourses) (Array.isArray(course.temas) ? course.temas : []).forEach(add);
    for (const movie of state.allFilms) (Array.isArray(movie.temas) ? movie.temas : []).forEach(add);''',
        "universalThemeOptions/courses",
    )

    app = substituir_uma_vez(
        app,
        '''    const courses = coursesEnabled ? coursesContent.sampleForPanel(state.allCourses) : [];
    const contests = contestsEnabled ? contestsContent.sampleForPanel(state.allContests) : [];''',
        '''    const themedCourses = state.filters.theme
      ? state.allCourses.filter(course => courseMatchesTheme(course, state.filters.theme))
      : state.allCourses;
    const courses = coursesEnabled ? coursesContent.sampleForPanel(themedCourses) : [];
    const contests = contestsEnabled && !state.filters.theme
      ? contestsContent.sampleForPanel(state.allContests)
      : [];''',
        "rotação temática de cursos",
    )

    app = substituir_uma_vez(
        app,
        '''    return coursesContent.filter(state.allCourses)
      .filter(course => coursesContent.agendaQueryMatches(course, query, normalizeText));''',
        '''    return coursesContent.filter(state.allCourses)
      .filter(course => courseMatchesTheme(course, state.mobileTheme))
      .filter(course => coursesContent.agendaQueryMatches(course, query, normalizeText));''',
        "Agenda/cursos por tema",
    )

    app = substituir_uma_vez(
        app,
        '''  function agendaVisibleContests() {
    if (!['all', 'contests'].includes(state.mobileContent) || state.config?.modulos?.concursos === false) {
      return [];
    }''',
        '''  function agendaVisibleContests() {
    if (state.mobileTheme || !['all', 'contests'].includes(state.mobileContent) || state.config?.modulos?.concursos === false) {
      return [];
    }''',
        "Agenda/concursos durante tema",
    )

    app = substituir_uma_vez(
        app,
        '''    if (content === 'books') {
      for (const book of state.allBooks) (Array.isArray(book.temas) ? book.temas : []).forEach(add);
    }
    if (content === 'films') {''',
        '''    if (content === 'books') {
      for (const book of state.allBooks) (Array.isArray(book.temas) ? book.temas : []).forEach(add);
    }
    if (content === 'courses') {
      for (const course of state.allCourses) (Array.isArray(course.temas) ? course.temas : []).forEach(add);
    }
    if (content === 'films') {''',
        "agendaThemeOptions/courses",
    )

    app = substituir_uma_vez(
        app,
        "    if (!['events', 'books', 'films'].includes(state.mobileContent)) {",
        "    if (!['events', 'books', 'courses', 'films'].includes(state.mobileContent)) {",
        "normalização do tema móvel",
    )

    app = substituir_uma_vez(
        app,
        "    const themeMode = ['events', 'books', 'films'].includes(state.mobileContent);",
        "    const themeMode = ['events', 'books', 'courses', 'films'].includes(state.mobileContent);",
        "seletor de tema em cursos",
    )

    APP.write_text(app, encoding="utf-8")


def atualizar_cache() -> None:
    sw = SW.read_text(encoding="utf-8")
    sw = sw.replace("mural-cultural-v81-tela-brasil", "mural-cultural-v82-agosto-lilas")
    sw = sw.replace("./js/app.js?v=79", "./js/app.js?v=80")
    SW.write_text(sw, encoding="utf-8")


def validar(selecionados: list[tuple[str, str]]) -> None:
    dados = json.loads(CURSOS.read_text(encoding="utf-8"))
    cursos = dados.get("cursos", [])
    feminismo = [c for c in cursos if "Feminismo" in (c.get("temas") or [])]
    lilas = [c for c in cursos if "Agosto Lilás" in (c.get("temas") or [])]
    if len(lilas) != len(feminismo) or len(lilas) != len(selecionados):
        raise RuntimeError(
            f"Curadoria inconsistente: Feminismo={len(feminismo)} Agosto Lilás={len(lilas)} selecionados={len(selecionados)}"
        )

    app = APP.read_text(encoding="utf-8")
    obrigatorios = [
        "function courseMatchesTheme(course, theme)",
        "for (const course of state.allCourses)",
        "courseMatchesTheme(course, state.filters.theme)",
        "courseMatchesTheme(course, state.mobileTheme)",
        "contestsEnabled && !state.filters.theme",
        "if (state.mobileTheme || !['all', 'contests'].includes(state.mobileContent)",
        "if (content === 'courses')",
        "['events', 'books', 'courses', 'films'].includes(state.mobileContent)",
    ]
    ausentes = [trecho for trecho in obrigatorios if trecho not in app]
    if ausentes:
        raise RuntimeError(f"Integração incompleta em app.js: {ausentes}")

    sw = SW.read_text(encoding="utf-8")
    if "mural-cultural-v82-agosto-lilas" not in sw or "./js/app.js?v=80" not in sw:
        raise RuntimeError("Cache do PWA não foi atualizado")


def main() -> None:
    selecionados = aplicar_cursos()
    integrar_app()
    atualizar_cache()
    validar(selecionados)
    print(f"Agosto Lilás: {len(selecionados)} cursos")
    for curso_id, titulo in selecionados:
        print(f" - {curso_id}: {titulo}")


if __name__ == "__main__":
    main()
