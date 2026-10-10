#!/usr/bin/env python3
"""Geocodifica endereços físicos explícitos de eventos e atividades.

Complementa coordenadas-conteudos.json com pontos INDEPENDENTES de Google Maps.
Não usa cidades como local exato e não aproxima números de porta inexistentes.
Execução pontual com cache persistido, sem consultas no navegador do visitante.

Política aplicável: https://operations.osmfoundation.org/policies/nominatim/
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

from geocodificar_espacos import candidates_from_nominatim, normalize, verify

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "coordenadas-conteudos.json"
PENDING = ROOT / "pendencias-coordenadas-conteudos.json"
MAX_NEW_QUERIES = 70
INTERVAL_SECONDS = 1.5


def object_address(local):
    if not isinstance(local, dict) or not local.get("endereco"):
        return ""
    return ", ".join(str(local.get(field, "")).strip() for field
                     in ("endereco", "bairro", "cidade", "uf") if local.get(field))


def candidates():
    items = []
    events = json.loads((ROOT / "eventos.json").read_text(encoding="utf-8")).get("eventos", [])
    for event in events:
        address = str(event.get("endereco") or "").strip()
        if address:
            items.append({"titulo": event.get("local") or event.get("titulo"),
                          "endereco": address, "cidade": event.get("cidade") or "Belo Horizonte"})
    activities = json.loads((ROOT / "atividades-lazer.json").read_text(encoding="utf-8")).get("atividades", [])
    for item in activities:
        local = item.get("local")
        address = object_address(local)
        if address:
            items.append({"titulo": local.get("nome") or item.get("titulo"),
                          "endereco": address, "cidade": local.get("cidade", "")})
    return items


def main():
    existing = json.loads(SOURCE.read_text(encoding="utf-8"))
    locations = existing.setdefault("locais_por_endereco", {})
    prior = (json.loads(PENDING.read_text(encoding="utf-8")).get("pendencias", {})
             if PENDING.exists() else {})
    spaces = json.loads((ROOT / "espacos_culturais.json").read_text(encoding="utf-8")).get("itens", [])
    # Evita geocodificar outra vez o mesmo endereço de um espaço já localizado.
    geo = json.loads((ROOT / "coordenadas-espacos.json").read_text(encoding="utf-8")).get("pontos", {})
    known = {normalize(x.get("endereco")) for x in spaces if geo.get(x.get("id"))}
    visited = {normalize(x) for x in locations} | known
    seen = set()
    pending = dict(prior)
    requests = 0
    last_request = 0.0

    for item in candidates():
        address = item["endereco"]
        normalized = normalize(address)
        if not normalized or normalized in visited or normalized in seen:
            continue
        seen.add(normalized)
        if normalized in pending:
            continue  # apenas endereços novos; rever manualmente os pendentes
        if requests >= MAX_NEW_QUERIES:
            pending[normalized] = {
                "nome": item.get("titulo"), "endereco": address, "motivo": "Aguardando próximo lote"
            }
            continue
        delay = INTERVAL_SECONDS - (time.monotonic() - last_request)
        if delay > 0:
            time.sleep(delay)
        last_request = time.monotonic()
        requests += 1
        results = candidates_from_nominatim(address)
        match = next((valid for result in results if (valid := verify(result, item))), None)
        if match:
            locations[address] = match
            print("OK", address, flush=True)
        else:
            pending[normalized] = {"nome": item.get("titulo"), "endereco": address,
                "motivo": "Sem número/logradouro confirmado pelo geocodificador",
                "candidatos": [{"nome": result.get("display_name"),
                                "latitude": result.get("lat"), "longitude": result.get("lon")}
                               for result in results[:2]]}
            print("PENDENTE", address, flush=True)

    SOURCE.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PENDING.write_text(json.dumps({"versao": 1, "pendencias": pending},
                        ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Consultas: {requests}; novos locais: {len(locations)}; pendências: {len(pending)}")


if __name__ == "__main__":
    main()
