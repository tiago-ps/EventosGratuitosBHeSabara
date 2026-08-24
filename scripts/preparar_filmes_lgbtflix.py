#!/usr/bin/env python3
"""Prepara o catálogo estático de filmes a partir de um commit do coletor."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_COLLECTOR = Path(r"C:\IFMG\Coletor-LGBTFlix")
DEFAULT_COMMIT = "2e52dba"
DEFAULT_RUN = "2026-08-24_181419"
MAX_AXIS = 800


def git_bytes(repository: Path, commit: str, path: str) -> bytes:
    command = [
        "git",
        "-c",
        f"safe.directory={repository.as_posix()}",
        "-C",
        str(repository),
        "show",
        f"{commit}:{path}",
    ]
    return subprocess.run(command, check=True, capture_output=True).stdout


def git_paths(repository: Path, commit: str, prefix: str) -> list[str]:
    command = [
        "git",
        "-c",
        f"safe.directory={repository.as_posix()}",
        "-C",
        str(repository),
        "ls-tree",
        "-r",
        "--name-only",
        commit,
        prefix,
    ]
    output = subprocess.run(command, check=True, capture_output=True, text=True).stdout
    return [line.strip() for line in output.splitlines() if line.strip()]


def compact_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def public_record(record: dict, image_public_path: str, width: int, height: int) -> dict:
    result = {
        "id": record["id"],
        "fonte_id": record["fonte_id"],
        "titulo": record["titulo"],
        "ano": record.get("ano"),
        "duracao_minutos": record.get("duracao_minutos"),
        "direcao": compact_list(record.get("direcao")),
        "sinopse": str(record.get("sinopse") or "").strip(),
        "classificacao": record.get("classificacao") or "Não informada",
        "generos": compact_list(record.get("generos")),
        "temas": compact_list(record.get("temas")),
        "letras": compact_list(record.get("letras")),
        "colecoes": compact_list(record.get("colecoes")),
        "alertas": compact_list(record.get("alertas")),
        "premios": compact_list(record.get("premios")),
        "imagem": image_public_path,
        "imagem_largura": width or None,
        "imagem_altura": height or None,
        "imagem_url_original": record.get("imagem_url_original"),
        "imagem_fonte": record.get("imagem_fonte") or "LGBTFlix",
        "imagem_pagina_origem": record.get("imagem_pagina_origem") or record["pagina_oficial"],
        "imagem_licenca": record.get("imagem_licenca") or "nao_verificada",
        "plataforma": record.get("plataforma") or "LGBTFlix",
        "tipo_acesso": record.get("acesso") or "gratuito_sem_cadastro",
        "pagina_oficial": record["pagina_oficial"],
        "video_plataforma": record.get("video_plataforma"),
        "status_manual": record.get("status_manual") or "revisar",
    }
    return {key: value for key, value in result.items() if value not in (None, "", [])}


def optimize_image(source: bytes, output: Path) -> tuple[int, int, bool]:
    if output.exists():
        with Image.open(output) as existing:
            existing.load()
            return existing.width, existing.height, True

    with Image.open(io.BytesIO(source)) as original:
        image = ImageOps.exif_transpose(original)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        image.thumbnail((MAX_AXIS, MAX_AXIS), Image.Resampling.LANCZOS)
        output.parent.mkdir(parents=True, exist_ok=True)
        image.save(output, "WEBP", quality=82, method=6, exact=True)
        return image.width, image.height, False


def prepare(repository: Path, commit: str, run: str) -> dict:
    prefix = f"dados/filmes_entrada/lgbtflix/{run}/filmes"
    json_paths = sorted(path for path in git_paths(repository, commit, prefix) if path.endswith(".json"))
    if not json_paths:
        raise RuntimeError(f"Nenhum filme encontrado em {prefix}")

    images_dir = ROOT / "imagens" / "filmes"
    records: list[dict] = []
    original_bytes = 0
    converted = 0
    reused = 0
    missing = 0

    for json_path in json_paths:
        record = json.loads(git_bytes(repository, commit, json_path).decode("utf-8"))
        image_path = str(record.get("imagem") or "")
        public_path = ""
        width = 0
        height = 0
        if image_path:
            source = git_bytes(repository, commit, image_path)
            original_bytes += len(source)
            source_hash = hashlib.sha256(source).hexdigest()[:12]
            filename = f"{record['fonte_id']}-{source_hash}.webp"
            output = images_dir / filename
            width, height, was_reused = optimize_image(source, output)
            public_path = f"imagens/filmes/{filename}"
            reused += int(was_reused)
            converted += int(not was_reused)
        else:
            missing += 1
        records.append(public_record(record, public_path, width, height))

    records.sort(key=lambda item: item["titulo"].casefold())
    output_json = ROOT / "filmes.json"
    payload = {
        "schema_versao": 1,
        "fonte": "LGBTFlix",
        "fonte_site": "https://flix.votelgbt.org/",
        "origem_commit": commit,
        "origem_execucao": run,
        "status_catalogo": "experimental_em_revisao",
        "filmes": records,
    }
    output_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    optimized_files = list(images_dir.glob("*.webp"))
    optimized_bytes = sum(path.stat().st_size for path in optimized_files)
    return {
        "filmes": len(records),
        "imagens_encontradas": len(records) - missing,
        "imagens_ausentes": missing,
        "imagens_convertidas": converted,
        "imagens_reutilizadas": reused,
        "bytes_originais": original_bytes,
        "bytes_otimizados": optimized_bytes,
        "reducao_percentual": round((1 - optimized_bytes / original_bytes) * 100, 2),
        "saida": str(output_json),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--coletor", type=Path, default=DEFAULT_COLLECTOR)
    parser.add_argument("--commit", default=DEFAULT_COMMIT)
    parser.add_argument("--execucao", default=DEFAULT_RUN)
    args = parser.parse_args()
    print(json.dumps(prepare(args.coletor.resolve(), args.commit, args.execucao), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
