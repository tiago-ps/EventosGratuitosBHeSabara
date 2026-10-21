#!/usr/bin/env python3
"""Importar pontos conferidos na interface revisar-localizacoes.html.

Por segurança, imprime apenas uma prévia, a menos que --aplicar seja informado.
Nenhuma coordenada de item sem evento correspondente pode ser importada.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
GENERIC = re.compile(
    r"^(local informado|local a definir|a definir|unidades culturais|v[aá]rios espa[cç]os|"
    r"diversos locais|online|on-line|pontos de encontro|atividades itinerantes)", re.I)


def read(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"JSON inválido: {path}")
    return data


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFD", str(value or ""))
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def plan(root: Path, patch: dict) -> tuple[dict, dict, dict]:
    if patch.get("formato") != "tem-sim-uai-localizacoes-revisadas-v1":
        raise ValueError("Formato de revisão não reconhecido")
    reviews = patch.get("revisoes")
    if not isinstance(reviews, list) or not reviews:
        raise ValueError("Arquivo sem revisões conferidas")
    catalog = read(root / "eventos.json")
    events = {event["id"]: event for event in catalog["eventos"] if event.get("id")}
    spaces = {space["id"]: space for space in read(root / "espacos_culturais.json")["itens"]}
    coords = read(root / "coordenadas-espacos.json")
    extra = read(root / "coordenadas-conteudos.json")
    for key in ("locais_por_id", "locais_por_nome", "locais_por_endereco"):
        extra.setdefault(key, {})
    by_seen = set()
    summary = {"revisoes": 0, "eventos": set(), "espacos": set(), "enderecos": set(), "nomes": set(), "ids": set()}
    for review in reviews:
        if not isinstance(review, dict):
            raise ValueError("Revisão inválida")
        key = str(review.get("chave") or "")
        if not key or key in by_seen:
            raise ValueError(f"Chave duplicada/ausente: {key}")
        by_seen.add(key)
        lat, lon = review.get("latitude"), review.get("longitude")
        if not all(isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) for x in (lat, lon)):
            raise ValueError(f"Coordenadas inválidas: {key}")
        if not (-21 <= lat <= -18 and -45 <= lon <= -42):
            raise ValueError(f"Ponto fora da área de cobertura: {key}")
        source = str(review.get("fonte") or "")
        if urlparse(source).scheme not in ("http", "https") or not urlparse(source).netloc:
            raise ValueError(f"Sem fonte verificável: {key}")
        name = str(review.get("local") or "").strip()
        address = str(review.get("endereco") or "").strip()
        location_id = str(review.get("local_id") or "").strip()
        if GENERIC.match(name) or not (name or address):
            raise ValueError(f"Local genérico ou vazio: {key}")
        linked_ids = review.get("evento_ids")
        if not isinstance(linked_ids, list) or not linked_ids:
            raise ValueError(f"Sem eventos vinculados: {key}")
        for event_id in linked_ids:
            event = events.get(event_id)
            if event is None:
                raise ValueError(f"Evento não encontrado; exportação desatualizada: {event_id}")
            if address and normalize(event.get("endereco")) != normalize(address):
                raise ValueError(f"Endereço diferente do cadastro no evento {event_id}")
            summary["eventos"].add(event_id)
        point = {
            "latitude": round(lat, 7),
            "longitude": round(lon, 7),
            "fonte": source,
            "validacao": "conferido_editorialmente",
            "precisao": str(review.get("observacao") or "").strip(),
            "confirmado_em": str(review.get("confirmado_em") or "")
        }
        # Um espaço cadastrado com o mesmo ID e endereço exato pode receber
        # diretamente o ponto (beneficiando todos os seus subespaços).
        space = spaces.get(location_id)
        if space and address and normalize(space.get("endereco")) == normalize(address):
            coords.setdefault("pontos", {})[location_id] = point
            summary["espacos"].add(location_id)
        if address:
            extra["locais_por_endereco"][address] = point
            summary["enderecos"].add(address)
        # O mesmo endereço pode reunir subespaços com IDs distintos.
        # Não vincular toda a programação a um ID de outro equipamento.
        if location_id and all(str(events[event_id].get("local_id") or "") == location_id
                               for event_id in linked_ids):
            extra["locais_por_id"][location_id] = point
            summary["ids"].add(location_id)
        # Nomes só são aliases seguros quando TODOS os eventos do grupo
        # possuem a mesma identificação editorial.
        if name and all(normalize(events[event_id].get("local")) == normalize(name)
                        for event_id in linked_ids):
            extra["locais_por_nome"][normalize(name)] = point
            summary["nomes"].add(normalize(name))
        summary["revisoes"] += 1
    return coords, extra, {key: len(value) if isinstance(value, set) else value for key, value in summary.items()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("arquivo", type=Path, help="JSON exportado da revisão")
    parser.add_argument("--raiz", type=Path, default=ROOT)
    parser.add_argument("--aplicar", action="store_true", help="Gravar arquivos somente após validar o pacote")
    args = parser.parse_args()
    patch = read(args.arquivo)
    spaces, extra, summary = plan(args.raiz, patch)
    print("Prévia:", json.dumps(summary, ensure_ascii=False))
    if not args.aplicar:
        print("Nenhum arquivo alterado. Use --aplicar após revisão humana.")
        return
    for filename, data in (("coordenadas-espacos.json", spaces), ("coordenadas-conteudos.json", extra)):
        (args.raiz / filename).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Pontos atualizados na base de teste. Validar e publicar via workflows existentes.")


if __name__ == "__main__":
    main()
