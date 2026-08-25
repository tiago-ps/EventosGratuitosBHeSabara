#!/usr/bin/env python3
"""Aplica curadorias editoriais aos eventos do Mural Cultural.

A seleção é explícita e conservadora: somente IDs previamente revisados entram
nas curadorias. O script preserva temas existentes e pode ser reexecutado após
qualquer regeneração de eventos.json.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVENTOS_PATH = ROOT / "eventos.json"

CURADORIAS = {
    "Agosto Lilás": {
        "sympla-sabara-3520241",
    },
}


def aplicar() -> dict[str, list[str]]:
    dados = json.loads(EVENTOS_PATH.read_text(encoding="utf-8"))
    eventos = dados.get("eventos", [])
    if not isinstance(eventos, list):
        raise RuntimeError("eventos.json não contém uma lista em 'eventos'")

    por_id = {
        str(evento.get("id") or "").strip(): evento
        for evento in eventos
        if isinstance(evento, dict)
    }

    resultado: dict[str, list[str]] = {}
    for curadoria, ids in CURADORIAS.items():
        ausentes = sorted(evento_id for evento_id in ids if evento_id not in por_id)
        if ausentes:
            raise RuntimeError(
                f"Eventos da curadoria {curadoria!r} não encontrados: {', '.join(ausentes)}"
            )

        marcados: list[str] = []
        for evento_id in sorted(ids):
            evento = por_id[evento_id]
            temas = [
                str(tema).strip()
                for tema in (evento.get("temas") or [])
                if str(tema).strip()
            ]
            if curadoria not in temas:
                temas.append(curadoria)
            evento["temas"] = temas
            marcados.append(str(evento.get("titulo") or evento_id))
        resultado[curadoria] = marcados

    EVENTOS_PATH.write_text(
        json.dumps(dados, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return resultado


def validar(resultado: dict[str, list[str]]) -> None:
    dados = json.loads(EVENTOS_PATH.read_text(encoding="utf-8"))
    eventos = dados.get("eventos", [])
    por_id = {
        str(evento.get("id") or "").strip(): evento
        for evento in eventos
        if isinstance(evento, dict)
    }

    for curadoria, ids in CURADORIAS.items():
        for evento_id in ids:
            temas = por_id[evento_id].get("temas") or []
            if curadoria not in temas:
                raise RuntimeError(
                    f"Curadoria {curadoria!r} não aplicada a {evento_id}"
                )
        if len(resultado.get(curadoria, [])) != len(ids):
            raise RuntimeError(f"Contagem inconsistente na curadoria {curadoria!r}")


def main() -> None:
    resultado = aplicar()
    validar(resultado)
    for curadoria, titulos in resultado.items():
        print(f"{curadoria}: {len(titulos)} evento(s)")
        for titulo in titulos:
            print(f" - {titulo}")


if __name__ == "__main__":
    main()
