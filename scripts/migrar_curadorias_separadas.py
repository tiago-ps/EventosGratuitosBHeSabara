from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY = ROOT / "curadorias-site.json"
CURATIONS_DIR = ROOT / "curadorias"
INDEX = CURATIONS_DIR / "index.json"
APP = ROOT / "js" / "app.js"
SW = ROOT / "service-worker.js"
TESTS = ROOT / "testes"

ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]*$")


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def split_curations() -> list[dict]:
    if not LEGACY.exists():
        if INDEX.exists():
            index = json.loads(INDEX.read_text(encoding="utf-8"))
            return list(index.get("curadorias") or [])
        raise RuntimeError("curadorias-site.json não encontrado e a migração ainda não existe")

    payload = json.loads(LEGACY.read_text(encoding="utf-8"))
    if payload.get("schema") != 1 or payload.get("escopo") != "site-only":
        raise RuntimeError("Envelope legado de curadorias inválido")
    curations = payload.get("curadorias")
    if not isinstance(curations, list) or not curations:
        raise RuntimeError("Nenhuma curadoria encontrada no arquivo legado")

    seen: set[str] = set()
    entries: list[dict] = []
    for order, curation in enumerate(curations, start=1):
        if not isinstance(curation, dict):
            raise RuntimeError("Curadoria inválida: cada entrada deve ser um objeto")
        curation_id = str(curation.get("id") or "").strip()
        if not ID_RE.fullmatch(curation_id):
            raise RuntimeError(f"ID de curadoria inválido: {curation_id!r}")
        if curation_id in seen:
            raise RuntimeError(f"ID de curadoria duplicado: {curation_id}")
        seen.add(curation_id)

        file_path = CURATIONS_DIR / f"{curation_id}.json"
        write_json(file_path, curation)

        entry = {
            "id": curation_id,
            "arquivo": f"curadorias/{curation_id}.json",
            "nome": curation.get("nome") or curation.get("titulo_editorial") or curation_id,
            "ativo_de": curation.get("ativo_de"),
            "ativo_ate": curation.get("ativo_ate"),
            "tema": curation.get("tema"),
            "ordem": order * 10,
        }
        if "banner" in curation:
            entry["banner"] = curation.get("banner")
        if "perfil_visual" in curation:
            entry["perfil_visual"] = curation.get("perfil_visual")
        entries.append(entry)

    index_payload = {
        "schema": 1,
        "escopo": "site-only",
        "descricao": payload.get("descricao") or "Índice das curadorias disponíveis neste ambiente.",
        "curadorias": entries,
    }
    write_json(INDEX, index_payload)
    return entries


def patch_app() -> None:
    text = APP.read_text(encoding="utf-8")
    text = text.replace(
        "  const SITE_CURATIONS_URL = 'curadorias-site.json';",
        "  const SITE_CURATIONS_INDEX_URL = 'curadorias/index.json';",
    )

    old_anchor = """  async function loadOptionalJson(url, fallback) {
    try {
      const response = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return fallback;
      return await response.json();
    } catch (error) {
      console.warn(`Conteúdo opcional indisponível: ${url}`, error);
      return fallback;
    }
  }

  async function load() {
"""
    new_anchor = """  async function loadOptionalJson(url, fallback) {
    try {
      const response = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return fallback;
      return await response.json();
    } catch (error) {
      console.warn(`Conteúdo opcional indisponível: ${url}`, error);
      return fallback;
    }
  }

  async function loadSiteCurations() {
    const index = await loadOptionalJson(SITE_CURATIONS_INDEX_URL, null);
    if (!index || index.schema !== 1 || index.escopo !== 'site-only' || !Array.isArray(index.curadorias)) {
      console.warn('Índice de curadorias indisponível ou inválido.');
      return null;
    }

    const loaded = await Promise.all(index.curadorias.map(async entry => {
      const id = String(entry?.id || '').trim();
      const file = String(entry?.arquivo || '').trim();
      if (!id || !/^curadorias\/[a-z0-9][a-z0-9._-]*\.json$/i.test(file) || file.includes('..')) {
        console.warn(`Entrada inválida no índice de curadorias: ${id || '(sem id)'}`);
        return null;
      }
      const curation = await loadOptionalJson(file, null);
      if (!curation || typeof curation !== 'object' || String(curation.id || '') !== id) {
        console.warn(`Curadoria ${id} ausente, inválida ou com ID divergente.`);
        return null;
      }
      return curation;
    }));

    return {
      schema: 1,
      escopo: 'site-only',
      descricao: String(index.descricao || ''),
      curadorias: loaded.filter(Boolean)
    };
  }

  async function load() {
"""
    if "async function loadSiteCurations()" not in text:
        if old_anchor not in text:
            raise RuntimeError("Âncora para inserir loadSiteCurations não encontrada em js/app.js")
        text = text.replace(old_anchor, new_anchor, 1)

    text = text.replace("loadOptionalJson(SITE_CURATIONS_URL, null)", "loadSiteCurations()")
    if "SITE_CURATIONS_URL" in text or "curadorias-site.json" in text:
        raise RuntimeError("Referência legada a curadorias-site.json permaneceu em js/app.js")
    APP.write_text(text, encoding="utf-8")


def patch_service_worker() -> None:
    text = SW.read_text(encoding="utf-8")
    text = text.replace(
        "const CACHE_VERSION = 'mural-cultural-v96-vestibular-images';",
        "const CACHE_VERSION = 'mural-cultural-v97-curadorias-separadas';",
    )
    text = text.replace("  '/curadorias-site.json',", "  '/curadorias/index.json',")

    old = """  } else if (DATA_PATHS.some(path => url.pathname.endsWith(path))) {
    const fileName = url.pathname.split('/').pop();
    // Sempre consulta a rede sem reutilizar a resposta HTTP anterior. O Cache
    // Storage continua servindo como fallback somente quando a rede falha.
    const stableRequest = new Request(new URL(`./${fileName}`, self.registration.scope), {
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    });
    event.respondWith(networkFirst(stableRequest, DATA_CACHE, '', 'application/json'));
"""
    new = """  } else if (
    DATA_PATHS.some(path => url.pathname.endsWith(path)) ||
    (url.pathname.includes('/curadorias/') && url.pathname.endsWith('.json'))
  ) {
    const scopePath = new URL(self.registration.scope).pathname;
    const normalizedScope = scopePath.endsWith('/') ? scopePath : `${scopePath}/`;
    const relativePath = url.pathname.startsWith(normalizedScope)
      ? url.pathname.slice(normalizedScope.length)
      : url.pathname.replace(/^\\/+/, '');
    // Sempre consulta a rede sem reutilizar a resposta HTTP anterior. O Cache
    // Storage continua servindo como fallback somente quando a rede falha.
    const stableRequest = new Request(new URL(`./${relativePath}`, self.registration.scope), {
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    });
    event.respondWith(networkFirst(stableRequest, DATA_CACHE, '', 'application/json'));
"""
    if old not in text and "url.pathname.includes('/curadorias/')" not in text:
        raise RuntimeError("Âncora de dados do service worker não encontrada")
    if old in text:
        text = text.replace(old, new, 1)
    if "'/curadorias-site.json'" in text:
        raise RuntimeError("Referência legada permaneceu em service-worker.js")
    SW.write_text(text, encoding="utf-8")


def patch_test_file(path: Path, replacements: list[tuple[str, str]]) -> None:
    text = path.read_text(encoding="utf-8")
    for old, new in replacements:
        if old in text:
            text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")


def patch_tests() -> None:
    curations_test = TESTS / "curadorias-site.test.cjs"
    patch_test_file(curations_test, [
        (
            "const payload = readJson('curadorias-site.json');",
            "const curationIndex = readJson('curadorias/index.json');\nconst payload = {\n  schema: curationIndex.schema,\n  escopo: curationIndex.escopo,\n  descricao: curationIndex.descricao,\n  curadorias: curationIndex.curadorias.map(item => readJson(item.arquivo))\n};",
        ),
        (
            "assert.match(appSource, /loadOptionalJson\\(SITE_CURATIONS_URL, null\\)/);",
            "assert.match(appSource, /loadSiteCurations\\(\\)/);\nassert.match(appSource, /SITE_CURATIONS_INDEX_URL = 'curadorias\\/index\\.json'/);",
        ),
        (
            "assert.doesNotMatch(appSource, /(?:write|post|put).*curadorias-site\\.json/i);",
            "assert.doesNotMatch(appSource, /curadorias-site\\.json/i);",
        ),
    ])

    september_test = TESTS / "apoio-painel-setembro.test.cjs"
    patch_test_file(september_test, [
        (
            "const payload = JSON.parse(fs.readFileSync(path.join(root, 'curadorias-site.json'), 'utf8'));",
            "const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));\nconst curationIndex = readJson('curadorias/index.json');\nconst payload = {\n  schema: curationIndex.schema,\n  escopo: curationIndex.escopo,\n  descricao: curationIndex.descricao,\n  curadorias: curationIndex.curadorias.map(item => readJson(item.arquivo))\n};",
        ),
    ])

    ufmg_test = TESTS / "vestibular-ufmg-curadoria.test.cjs"
    patch_test_file(ufmg_test, [
        (
            "const payload = JSON.parse(fs.readFileSync(path.join(root, 'curadorias-site.json'), 'utf8'));",
            "const curation = JSON.parse(fs.readFileSync(path.join(root, 'curadorias', 'vestibular-ufmg-seriado-2026.json'), 'utf8'));",
        ),
        (
            "const curation = payload.curadorias.find(item => item.id === 'vestibular-ufmg-seriado-2026');\n",
            "",
        ),
    ])

    fuvest_test = TESTS / "vestibular-fuvest-curadoria.test.cjs"
    patch_test_file(fuvest_test, [
        (
            "const data = JSON.parse(fs.readFileSync(path.join(root, 'curadorias-site.json'), 'utf8'));",
            "const c = JSON.parse(fs.readFileSync(path.join(root, 'curadorias', 'vestibular-fuvest-2027.json'), 'utf8'));",
        ),
        (
            "const c = data.curadorias.find(x => x.id === 'vestibular-fuvest-2027');\n",
            "",
        ),
    ])

    sw_test = TESTS / "service-worker-cache.test.cjs"
    patch_test_file(sw_test, [
        (
            "assert.equal(sw.CACHE_VERSION, 'mural-cultural-v96-vestibular-images');",
            "assert.equal(sw.CACHE_VERSION, 'mural-cultural-v97-curadorias-separadas');",
        ),
        (
            "assert.ok(sw.DATA_PATHS.includes('/curadorias-site.json'));",
            "assert.ok(sw.DATA_PATHS.includes('/curadorias/index.json'));",
        ),
        (
            "assert.equal(sw.CORE_ASSETS.some(asset => /(?:cursos|concursos|filmes|curadorias-site)\\.json/.test(asset)), false);",
            "assert.equal(sw.CORE_ASSETS.some(asset => /(?:cursos|concursos|filmes|curadorias)\\.json/.test(asset)), false);",
        ),
        (
            "assert.match(appSource, /loadOptionalJson\\(SITE_CURATIONS_URL, null\\)/);",
            "assert.match(appSource, /loadSiteCurations\\(\\)/);\n  assert.match(appSource, /SITE_CURATIONS_INDEX_URL = 'curadorias\\/index\\.json'/);",
        ),
    ])

    text = sw_test.read_text(encoding="utf-8")
    marker = """  const uncachedOptional = await dispatch('fetch', {
    request: new Request('http://localhost:8765/cursos.json?v=789')
  });
  assert.equal(uncachedOptional.type, 'error');

"""
    nested = """  const uncachedOptional = await dispatch('fetch', {
    request: new Request('http://localhost:8765/cursos.json?v=789')
  });
  assert.equal(uncachedOptional.type, 'error');

  fetchImplementation = async request => new CacheableResponse(`curadoria:${request.url}`);
  const curationOnline = await dispatch('fetch', {
    request: new Request('http://localhost:8765/curadorias/vestibular-fuvest-2027.json?v=1')
  });
  assert.equal(curationOnline.ok, true);
  const stableCurationUrl = 'http://localhost:8765/curadorias/vestibular-fuvest-2027.json';
  assert.ok(stores.get(sw.DATA_CACHE).has(stableCurationUrl));

  fetchImplementation = async () => { throw new Error('offline'); };
  const curationOffline = await dispatch('fetch', {
    request: new Request('http://localhost:8765/curadorias/vestibular-fuvest-2027.json?v=2')
  });
  assert.equal(curationOffline.body, `curadoria:${stableCurationUrl}`);

"""
    if marker in text and "stableCurationUrl" not in text:
        text = text.replace(marker, nested, 1)
    sw_test.write_text(text, encoding="utf-8")


def write_migration_test(entries: list[dict]) -> None:
    expected_ids = [entry["id"] for entry in entries]
    content = f"""'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const index = readJson('curadorias/index.json');
const expectedIds = {json.dumps(expected_ids, ensure_ascii=False)};

assert.equal(index.schema, 1);
assert.equal(index.escopo, 'site-only');
assert.deepEqual(index.curadorias.map(item => item.id), expectedIds);
assert.equal(new Set(index.curadorias.map(item => item.id)).size, index.curadorias.length);
for (const entry of index.curadorias) {{
  assert.equal(entry.arquivo, `curadorias/${{entry.id}}.json`);
  const curation = readJson(entry.arquivo);
  assert.equal(curation.id, entry.id);
  assert.equal(curation.nome || curation.titulo_editorial, entry.nome);
  assert.equal(curation.ativo_de, entry.ativo_de);
  assert.equal(curation.ativo_ate, entry.ativo_ate);
}}
assert.equal(fs.existsSync(path.join(root, 'curadorias-site.json')), false, 'Arquivo monolítico legado deve ter sido removido');

const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
assert.match(app, /SITE_CURATIONS_INDEX_URL = 'curadorias\\/index\\.json'/);
assert.match(app, /async function loadSiteCurations\\(\\)/);
assert.match(app, /loadSiteCurations\\(\\)/);
assert.doesNotMatch(app, /curadorias-site\\.json/);
assert.ok(sw.includes("'/curadorias/index.json'"));
assert.match(sw, /url\\.pathname\\.includes\\('\/curadorias\/'\\)/);
assert.doesNotMatch(sw, /curadorias-site\\.json/);

console.log('Arquitetura de uma curadoria por JSON validada.');
"""
    (TESTS / "curadorias-separadas.test.cjs").write_text(content, encoding="utf-8")


def ensure_tests_no_legacy_reference() -> None:
    offenders = []
    for path in TESTS.glob("*.cjs"):
        if "curadorias-site.json" in path.read_text(encoding="utf-8"):
            offenders.append(path.name)
    if offenders:
        raise RuntimeError(f"Testes ainda referenciam o arquivo legado: {', '.join(offenders)}")


def main() -> None:
    entries = split_curations()
    patch_app()
    patch_service_worker()
    patch_tests()
    write_migration_test(entries)
    ensure_tests_no_legacy_reference()
    if LEGACY.exists():
        LEGACY.unlink()
    print("Curadorias separadas:")
    for entry in entries:
        print(f"- {entry['id']} -> {entry['arquivo']}")


if __name__ == "__main__":
    main()
