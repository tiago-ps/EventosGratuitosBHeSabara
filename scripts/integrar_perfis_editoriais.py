#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "js" / "app.js"
CONFIG = ROOT / "configuracao-mural.json"
INDEX = ROOT / "index.html"
SW = ROOT / "service-worker.js"

PROFILE_ID = "agosto-lilas-2026"
PROFILE_DATA = {
    "nome": "Agosto Lilás — curadoria do mês",
    "destaque": "Sugestão do mês",
    "ativo_de": "2026-08-01",
    "ativo_ate": "2026-08-31",
    "configuracao": {
        "modules": {
            "events": True,
            "books": True,
            "courses": True,
            "contests": False,
            "films": True,
        },
        "theme": "agosto lilas",
        "eventCities": [],
        "eventCategory": "",
        "eventProgram": "",
        "eventUnit": "",
        "bookCampuses": [],
        "bookAccess": "",
        "filmGenre": "",
        "filmRating": "",
        "filmDuration": "",
        "weights": {
            "events": 5,
            "books": 1,
            "courses": 1,
            "contests": 1,
            "films": 1,
        },
        "slideDuration": 0,
    },
}

OLD_PROFILE_HELPERS = '''  function configuredPanelProfiles() {
    const profiles = state.config?.perfis_painel;
    return profiles && typeof profiles === 'object' && !Array.isArray(profiles) ? profiles : {};
  }

  function findRequestedPanelProfile() {
    const requested = requestedPanelProfile();
    if (!requested) return null;
    const candidates = {
      ...configuredPanelProfiles(),
      ...readPanelProfiles()
    };
    for (const [name, settings] of Object.entries(candidates)) {
      if (panelProfileSlug(name) === requested) return settings;
    }
    return null;
  }
'''

NEW_PROFILE_HELPERS = '''  function configuredPanelProfiles() {
    const profiles = state.config?.perfis_painel;
    return profiles && typeof profiles === 'object' && !Array.isArray(profiles) ? profiles : {};
  }

  function configuredPanelProfileEntries() {
    return Object.entries(configuredPanelProfiles()).map(([id, raw]) => {
      const enriched = Boolean(
        raw && typeof raw === 'object' && !Array.isArray(raw) &&
        raw.configuracao && typeof raw.configuracao === 'object' && !Array.isArray(raw.configuracao)
      );
      const settings = enriched ? raw.configuracao : raw;
      return {
        id,
        name: String(enriched ? (raw.nome || id) : id).trim() || id,
        badge: String(enriched ? (raw.destaque || '') : '').trim(),
        start: String(enriched ? (raw.ativo_de || '') : '').trim(),
        end: String(enriched ? (raw.ativo_ate || '') : '').trim(),
        settings
      };
    });
  }

  function editorialProfileIsVisible(profile, today = todayAtMidnight()) {
    const start = parseCalendarDate(profile.start);
    const end = parseCalendarDate(profile.end, true);
    if (start && today < start) return false;
    if (end && today > end) return false;
    return true;
  }

  function editorialProfileById(id = '') {
    return configuredPanelProfileEntries().find(profile => profile.id === id) || null;
  }

  function profileOptionValue(source, key) {
    return `${source}:${key}`;
  }

  function parseProfileOptionValue(value = '') {
    const text = String(value || '');
    const separator = text.indexOf(':');
    if (separator < 0) return { source: '', key: '' };
    return {
      source: text.slice(0, separator),
      key: text.slice(separator + 1)
    };
  }

  function selectedProfileSettings(value = '') {
    const { source, key } = parseProfileOptionValue(value);
    if (source === 'editorial') return editorialProfileById(key)?.settings || null;
    if (source === 'personal') return readPanelProfiles()[key] || null;
    return null;
  }

  function findRequestedPanelProfile() {
    const requested = requestedPanelProfile();
    if (!requested) return null;

    for (const profile of configuredPanelProfileEntries()) {
      if (panelProfileSlug(profile.id) === requested || panelProfileSlug(profile.name) === requested) {
        return profile.settings;
      }
    }

    for (const [name, settings] of Object.entries(readPanelProfiles())) {
      if (panelProfileSlug(name) === requested) return settings;
    }
    return null;
  }
'''

OLD_POPULATE = '''  function populateProfileSelect(slide, selectedName = '') {
    const select = slide.querySelector('.panel-profile-select');
    if (!select) return;
    const profiles = readPanelProfiles();
    select.replaceChildren();
    const current = document.createElement('option');
    current.value = '';
    current.textContent = 'Configuração atual';
    select.append(current);
    Object.keys(profiles)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.append(option);
      });
    select.value = Object.hasOwn(profiles, selectedName) ? selectedName : '';
    const deleteButton = slide.querySelector('.panel-profile-delete');
    if (deleteButton) deleteButton.disabled = !select.value;
  }
'''

NEW_POPULATE = '''  function populateProfileSelect(slide, selectedValue = '') {
    const select = slide.querySelector('.panel-profile-select');
    if (!select) return;

    const editorials = configuredPanelProfileEntries()
      .filter(editorialProfileIsVisible)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const personals = readPanelProfiles();

    select.replaceChildren();
    const current = document.createElement('option');
    current.value = '';
    current.textContent = 'Configuração atual';
    select.append(current);

    if (editorials.length) {
      const group = document.createElement('optgroup');
      group.label = 'Sugestões do Mural';
      for (const profile of editorials) {
        const option = document.createElement('option');
        option.value = profileOptionValue('editorial', profile.id);
        option.textContent = `${profile.badge ? '★ ' : ''}${profile.name}`;
        if (profile.badge) option.title = profile.badge;
        group.append(option);
      }
      select.append(group);
    }

    const personalNames = Object.keys(personals)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (personalNames.length) {
      const group = document.createElement('optgroup');
      group.label = 'Meus perfis';
      for (const name of personalNames) {
        const option = document.createElement('option');
        option.value = profileOptionValue('personal', name);
        option.textContent = name;
        group.append(option);
      }
      select.append(group);
    }

    if ([...select.options].some(option => option.value === selectedValue)) {
      select.value = selectedValue;
    } else {
      select.value = '';
    }

    const deleteButton = slide.querySelector('.panel-profile-delete');
    if (deleteButton) {
      deleteButton.disabled = parseProfileOptionValue(select.value).source !== 'personal';
    }
  }
'''

OLD_SAVE_CALL = "      populateProfileSelect(slide, name);"
NEW_SAVE_CALL = "      populateProfileSelect(slide, profileOptionValue('personal', name));"

OLD_DELETE = '''  function deletePanelProfile(slide) {
    const select = slide.querySelector('.panel-profile-select');
    const name = select?.value || '';
    if (!name) return;
    const profiles = readPanelProfiles();
    delete profiles[name];
    writePanelProfiles(profiles);
    populateProfileSelect(slide, '');
  }
'''

NEW_DELETE = '''  function deletePanelProfile(slide) {
    const select = slide.querySelector('.panel-profile-select');
    const { source, key } = parseProfileOptionValue(select?.value || '');
    if (source !== 'personal' || !key) return;
    const profiles = readPanelProfiles();
    delete profiles[key];
    writePanelProfiles(profiles);
    populateProfileSelect(slide, '');
  }
'''

OLD_CHANGE = '''    slide.querySelector('.panel-profile-select')?.addEventListener('change', event => {
      const profiles = readPanelProfiles();
      const selected = event.target.value;
      if (selected && profiles[selected]) populateFilterPanel(slide, profiles[selected]);
      const deleteButton = slide.querySelector('.panel-profile-delete');
      if (deleteButton) deleteButton.disabled = !selected;
    });
'''

NEW_CHANGE = '''    slide.querySelector('.panel-profile-select')?.addEventListener('change', event => {
      const selected = event.target.value;
      const settings = selectedProfileSettings(selected);
      if (settings) populateFilterPanel(slide, settings);
      const deleteButton = slide.querySelector('.panel-profile-delete');
      if (deleteButton) {
        deleteButton.disabled = parseProfileOptionValue(selected).source !== 'personal';
      }
    });
'''


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if text.count(old) != 1:
        raise RuntimeError(f"Trecho inesperado em {label}: {text.count(old)} ocorrências")
    return text.replace(old, new, 1)


def update_config() -> None:
    data = json.loads(CONFIG.read_text(encoding="utf-8"))
    profiles = data.setdefault("perfis_painel", {})
    profiles[PROFILE_ID] = PROFILE_DATA
    CONFIG.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_app() -> None:
    text = APP.read_text(encoding="utf-8")
    text = replace_once(text, OLD_PROFILE_HELPERS, NEW_PROFILE_HELPERS, "helpers de perfil")
    text = replace_once(text, OLD_POPULATE, NEW_POPULATE, "seletor de perfis")
    text = replace_once(text, OLD_SAVE_CALL, NEW_SAVE_CALL, "salvamento de perfil")
    text = replace_once(text, OLD_DELETE, NEW_DELETE, "exclusão de perfil")
    text = replace_once(text, OLD_CHANGE, NEW_CHANGE, "troca de perfil")
    APP.write_text(text, encoding="utf-8")


def update_versions() -> None:
    index = INDEX.read_text(encoding="utf-8")
    index = re.sub(r'js/app\.js\?v=\d+', 'js/app.js?v=81', index)
    INDEX.write_text(index, encoding="utf-8")

    sw = SW.read_text(encoding="utf-8")
    sw = re.sub(
        r"const CACHE_VERSION = 'mural-cultural-v[^']+';",
        "const CACHE_VERSION = 'mural-cultural-v87-perfis-editoriais';",
        sw,
        count=1,
    )
    sw = re.sub(r'\./js/app\.js\?v=\d+', './js/app.js?v=81', sw)
    SW.write_text(sw, encoding="utf-8")


def validate() -> None:
    data = json.loads(CONFIG.read_text(encoding="utf-8"))
    profile = data.get("perfis_painel", {}).get(PROFILE_ID, {})
    settings = profile.get("configuracao", {})
    assert profile.get("nome") == "Agosto Lilás — curadoria do mês"
    assert profile.get("ativo_de") == "2026-08-01"
    assert profile.get("ativo_ate") == "2026-08-31"
    assert settings.get("theme") == "agosto lilas"
    assert settings.get("modules", {}).get("contests") is False
    assert all(settings.get("modules", {}).get(key) is True for key in ("events", "books", "courses", "films"))

    app = APP.read_text(encoding="utf-8")
    for required in (
        "Sugestões do Mural",
        "Meus perfis",
        "selectedProfileSettings",
        "editorialProfileIsVisible",
        "profileOptionValue('personal', name)",
    ):
        assert required in app, required

    assert "js/app.js?v=81" in INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert "mural-cultural-v87-perfis-editoriais" in sw
    assert "./js/app.js?v=81" in sw


if __name__ == "__main__":
    update_config()
    update_app()
    update_versions()
    validate()
    print("Perfil editorial integrado: Agosto Lilás — curadoria do mês")
