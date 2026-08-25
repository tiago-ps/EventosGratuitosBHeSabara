#!/usr/bin/env python3
"""Aplica a curadoria piloto Agosto Lilás aos livros já selecionados para feminismo."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIVROS = ROOT / "livros.json"
TEMA = "Agosto Lilás"
MARCADOR = "Seleção temática de feminismo para o piloto de 2026-08-25"
ESPERADOS = 20


def main() -> None:
    data = json.loads(LIVROS.read_text(encoding="utf-8"))
    livros = data.get("livros", [])
    selecionados = []

    for livro in livros:
        observacoes = str(livro.get("observacoes") or "")
        if MARCADOR not in observacoes:
            continue
        temas = [str(t).strip() for t in (livro.get("temas") or []) if str(t).strip()]
        if TEMA not in temas:
            temas.append(TEMA)
        livro["temas"] = temas
        selecionados.append(str(livro.get("titulo") or ""))

    if len(selecionados) != ESPERADOS:
        raise RuntimeError(
            f"Curadoria inesperada: selecionados={len(selecionados)} esperados={ESPERADOS}"
        )

    LIVROS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Agosto Lilás: {len(selecionados)} livros")
    for titulo in selecionados:
        print(f" - {titulo}")


if __name__ == "__main__":
    main()
