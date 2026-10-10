#!/usr/bin/env python3
"""Geocodificação editorial pontual dos espaços, com cache e validação estrita.

Uso: python scripts/geocodificar_espacos.py
Uma única consulta ativa de cada vez; nunca geocodificar no navegador do visitante.
Confirme manualmente os resultados anotados em pendencias-coordenadas-espacos.json.
"""
from __future__ import annotations

import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPACES = ROOT / "espacos_culturais.json"
COORDINATES = ROOT / "coordenadas-espacos.json"
PENDING = ROOT / "pendencias-coordenadas-espacos.json"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "TemSimUaiEspacos/1.0 (+https://temsimuai.com.br/; contato: temsimuai@ifmg.edu.br)"
MIN_SECONDS_BETWEEN_REQUESTS = 1.5
REGION = (-20.25, -19.55, -44.45, -43.40)


def normalize(value):
    source = unicodedata.normalize("NFKD", str(value or ""))
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in source if not unicodedata.combining(c)).lower()).strip()


def target_number(address):
    match = re.search(r",\s*(\d{1,6})\b", str(address))
    return str(int(match.group(1))) if match else ""


def in_region(lat, lon):
    return REGION[0] <= lat <= REGION[1] and REGION[2] <= lon <= REGION[3]


def candidates_from_nominatim(query):
    params = urllib.parse.urlencode({
        "q": query + ", Brasil", "format": "jsonv2", "addressdetails": 1,
        "countrycodes": "br", "limit": 5, "accept-language": "pt-BR",
        "viewbox": "-44.45,-19.55,-43.40,-20.25", "bounded": 1
    })
    request = urllib.request.Request(NOMINATIM + "?" + params, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Referer": "https://temsimuai.com.br/"
    })
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return json.load(response)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        print("Aviso: consulta falhou para", query, type(error).__name__, flush=True)
        return []


def verify(candidate, space):
    try:
        lat, lon = float(candidate["lat"]), float(candidate["lon"])
        if not in_region(lat, lon):
            return None
    except (ValueError, TypeError, KeyError):
        return None
    data = candidate.get("address") or {}
    target_city = normalize(space.get("cidade"))
    city = normalize(data.get("city") or data.get("town") or data.get("municipality"))
    if target_city and city and target_city != city:
        return None
    if normalize(data.get("state")) not in ("", "minas gerais"):
        return None

    house = target_number(space.get("endereco"))
    found_house = re.sub(r"\D", "", str(data.get("house_number") or ""))
    source_road = normalize(str(space.get("endereco") or "").split(",")[0])
    returned_road = normalize(data.get("road") or data.get("pedestrian") or data.get("square") or data.get("place"))
    road_ok = bool(source_road and returned_road and
                   (source_road in returned_road or returned_road in source_road))
    # Ponto exato com número confirmado no mesmo logradouro, não o centro da rua.
    exact_address = bool(house and found_house == house and road_ok)
    # Um equipamento nomeado pode ser geocodificado sem número de porta.
    title = normalize(space.get("titulo"))
    displayed = normalize(candidate.get("name") or "")
    named_venue = bool(len(title) >= 8 and displayed and (title == displayed or
                       (len(title) > 14 and title in displayed)))
    if not (exact_address or named_venue):
        return None
    return {
        "latitude": round(lat, 7), "longitude": round(lon, 7),
        "fonte": "https://www.openstreetmap.org/" +
                 str(candidate.get("osm_type", "node")).lower().replace("relation", "relation").replace("way", "way") +
                 "/" + str(candidate.get("osm_id", "")),
        "validacao": "logradouro_numero" if exact_address else "equipamento_nomeado",
        "origem": "Nominatim OpenStreetMap"
    }


def main():
    spaces = json.loads(SPACES.read_text(encoding="utf-8")).get("itens", [])
    result = json.loads(COORDINATES.read_text(encoding="utf-8"))
    points = result.setdefault("pontos", {})
    address_points = {}
    for space in spaces:
        if space.get("id") in points and space.get("endereco"):
            address_points[normalize(space["endereco"])] = points[space["id"]]

    by_address = {}
    for space in spaces:
        if not space.get("id") or not space.get("endereco"):
            continue
        by_address.setdefault(normalize(space["endereco"]), []).append(space)
    pending = {}
    request_count = 0
    last_request = 0.0
    for address_key, group in by_address.items():
        if address_key in address_points:
            continue
        main_space = next((x for x in group if not re.search(
            r"galeria|auditorio|sala|piso|foyer|biblioteca|cafe|patio",
            normalize(x.get("titulo")), re.I)), group[0])
        query = str(main_space["endereco"]).strip()
        wait = MIN_SECONDS_BETWEEN_REQUESTS - (time.monotonic() - last_request)
        if wait > 0:
            time.sleep(wait)
        last_request = time.monotonic()
        request_count += 1
        matches = candidates_from_nominatim(query)
        confirmed = next((point for c in matches if (point := verify(c, main_space))), None)
        if confirmed:
            # Os subespaços compartilham o endereço; a interface os reúne.
            points[main_space["id"]] = confirmed
            address_points[address_key] = confirmed
            print("OK:", main_space.get("titulo"), flush=True)
        else:
            pending[address_key] = {
                "nome": main_space.get("titulo"), "endereco": query,
                "motivo": "Sem correspondência suficientemente precisa; revisão humana necessária",
                "candidatos": [{
                    "display_name": c.get("display_name"),
                    "latitude": c.get("lat"), "longitude": c.get("lon")
                } for c in matches[:3]]
            }
            print("PENDENTE:", main_space.get("titulo"), flush=True)

    COORDINATES.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PENDING.write_text(json.dumps({
        "versao": 1, "descricao": "Candidatos não publicados; confirmar localização antes de incorporar.",
        "pendencias": list(pending.values())
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Consultas:", request_count, "Pontos confirmados:", len(points), "Pendências:", len(pending))


if __name__ == "__main__":
    main()
