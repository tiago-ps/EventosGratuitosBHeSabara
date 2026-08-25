#!/usr/bin/env python3
"""Aplica a curadoria piloto Agosto Lilás aos livros já selecionados para feminismo."""
from __future__ import annotations

import json
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIVROS = ROOT / "livros.json"
TEMA = "Agosto Lilás"

TITULOS = {
    "Anseios : raça, gênero e políticas culturais",
    "Cinema vivido : raça, classe e sexo nas telas / 2023",
    "Comunhão : a busca das mulheres pelo amor / 2024",
    "Cultura fora da lei : representações de resistência / 2023",
    "Ensinando a transgredir : a educação como prática da liberdade",
    "Ensinando comunidade : uma pedagogia da esperança",
    "Ensinando pensamento crítico : sabedoria prática",
    "Erguer a voz : pensar como feminista, pensar como negra",
    "Escrever além da raça : teoria e prática",
    "Eu não sou uma mulher? : mulheres negras e feminismo",
    "Feminismo é para todo mundo : políticas arrebatadoras",
    "Gente é da hora : homens negros e masculinidade",
    "Irmãs do inhame : mulheres negras e autorrecuperação",
    "Mulheres, raça e classe",
    "Olhares negros : raça e representação",
    "Pertencimento : uma cultura do lugar",
    "Salvação : pessoas negras e o amor",
    "Teoria feminista : da margem ao centro",
    "Tudo sobre o amor : novas perspectivas",
    "A vontade de mudar : homens, masculinidades e amor",
}


def norm(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return " ".join(text.casefold().replace("/", " ").replace(":", " ").split())


def main() -> None:
    data = json.loads(LIVROS.read_text(encoding="utf-8"))
    livros = data.get("livros", [])
    wanted = {norm(t): t for t in TITULOS}
    encontrados = []

    for livro in livros:
        titulo_norm = norm(livro.get("titulo", ""))
        # tolera sufixos de ano e pequenas diferenças do catálogo
        alvo = next((key for key in wanted if titulo_norm == key or titulo_norm.startswith(key) or key.startswith(titulo_norm)), None)
        if not alvo:
            continue
        temas = [str(t).strip() for t in (livro.get("temas") or []) if str(t).strip()]
        if TEMA not in temas:
            temas.append(TEMA)
        livro["temas"] = temas
        encontrados.append(str(livro.get("titulo") or ""))

    if len(encontrados) != len(TITULOS):
        faltantes = sorted(TITULOS - set(encontrados))
        raise RuntimeError(f"Curadoria incompleta: encontrados={len(encontrados)} esperados={len(TITULOS)} faltantes={faltantes}")

    LIVROS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Agosto Lilás: {len(encontrados)} livros")
    for titulo in encontrados:
        print(f" - {titulo}")


if __name__ == "__main__":
    main()
