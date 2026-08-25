#!/usr/bin/env python3
"""Reaplica curadorias editoriais aos cursos após regenerações do catálogo.

A seleção editorial não depende de ``temas`` vindos da fonte: os cursos do
piloto Agosto Lilás são identificados por ``id_fonte`` estável da EV.G.
Assim, uma atualização completa de ``cursos.json`` pode substituir os dados
sem apagar definitivamente a curadoria do Mural.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CURSOS = ROOT / "cursos.json"

# Seleção editorial validada no piloto de 2026-08-25.
# IDs estáveis da Escola Virtual de Governo (EV.G).
AGOSTO_LILAS_IDS = {
    "834",   # Água e Gênero
    "924",   # Inclusão de gênero na ponta da língua
    "1115",  # Prevenção e Enfrentamento do Assédio Sexual e Moral
    "1120",  # Mulheres na liderança
    "1163",  # Gestão e Implementação de Políticas Públicas para Mulheres
    "1189",  # O Protagonismo das Mulheres
    "1198",  # Mulheres no Mundo do trabalho
    "1204",  # Violência de gênero contra mulheres e meninas
    "1341",  # Escolas ON, Violências OFF
    "1430",  # Jornada da Diversidade: Inclusão em Ação
    "1440",  # Violência Baseada no Gênero: Qual a nossa Responsabilidade como Rede?
    "1452",  # Como prevenir o assédio e a violência contra a mulher
    "1511",  # Diversidade Social na Cidade
    "1518",  # Refletir para não Repetir: Grupos com Homens Autores de Violência
    "653",   # Gestão de Casos de Violência Baseada no Gênero
}

TEMAS_EDITORIAIS = ("Feminismo", "Agosto Lilás")


def aplicar_cursos() -> list[tuple[str, str]]:
    dados = json.loads(CURSOS.read_text(encoding="utf-8"))
    cursos = dados.get("cursos", [])
    if not isinstance(cursos, list) or len(cursos) < 1000:
        total = len(cursos) if isinstance(cursos, list) else 0
        raise RuntimeError(f"Catálogo de cursos inesperado: {total}")

    encontrados: dict[str, str] = {}

    for curso in cursos:
        curso_id = str(curso.get("id_fonte") or "").strip()
        if curso_id not in AGOSTO_LILAS_IDS:
            continue

        temas = [
            str(tema).strip()
            for tema in (curso.get("temas") or [])
            if str(tema).strip()
        ]
        existentes = {tema.casefold() for tema in temas}
        for tema in TEMAS_EDITORIAIS:
            if tema.casefold() not in existentes:
                temas.append(tema)
                existentes.add(tema.casefold())

        curso["temas"] = temas
        encontrados[curso_id] = str(curso.get("titulo") or "").strip()

    ausentes = sorted(AGOSTO_LILAS_IDS - encontrados.keys(), key=lambda x: int(x))
    if ausentes:
        raise RuntimeError(
            "Cursos da curadoria ausentes do catálogo atual: " + ", ".join(ausentes)
        )

    if len(encontrados) != 15:
        raise RuntimeError(f"Curadoria inesperada: {len(encontrados)} cursos encontrados")

    CURSOS.write_text(
        json.dumps(dados, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return sorted(encontrados.items(), key=lambda item: item[1].casefold())


def validar() -> None:
    dados = json.loads(CURSOS.read_text(encoding="utf-8"))
    cursos = dados.get("cursos", [])
    por_id = {str(c.get("id_fonte") or ""): c for c in cursos}

    for curso_id in AGOSTO_LILAS_IDS:
        curso = por_id.get(curso_id)
        if not curso:
            raise RuntimeError(f"Curso {curso_id} desapareceu após a gravação")
        temas = {str(t).strip().casefold() for t in (curso.get("temas") or [])}
        for tema in TEMAS_EDITORIAIS:
            if tema.casefold() not in temas:
                raise RuntimeError(f"Curso {curso_id} sem tema editorial {tema!r}")


def main() -> None:
    selecionados = aplicar_cursos()
    validar()
    print(f"Agosto Lilás: {len(selecionados)} cursos reaplicados por id_fonte")
    for curso_id, titulo in selecionados:
        print(f" - {curso_id}: {titulo}")


if __name__ == "__main__":
    main()
