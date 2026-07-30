from pathlib import Path

path = Path("js/app.js")
if not path.exists():
    raise SystemExit("Execute este script na raiz do repositório EventosGratuitosBHeSabara.")
text = path.read_text(encoding="utf-8")

old = "  function eventEndDate(event) {\n    return safeDate(event.data_fim || event.data);\n  }\n\n  function filterAndSort(events) {\n    const today = todayAtMidnight();\n\n    return events\n      .filter(event => event && event.titulo && event.data)\n      .filter(event => {\n        const end = eventEndDate(event);\n        return !end || end >= today;\n      })\n      .sort((a, b) => {\n        const da = safeDate(a.data)?.getTime() || 0;\n        const db = safeDate(b.data)?.getTime() || 0;\n\n        return da - db ||\n          String(a.horario || '').localeCompare(\n            String(b.horario || ''),\n            'pt-BR'\n          );\n      });\n  }\n"
new = "  const CLOSED_ACCESS_STATUSES = new Set([\n    'encerrada', 'encerrada provavel', 'esgotado', 'indisponivel'\n  ]);\n\n  function displayCriterion(event) {\n    const value = normalizeText(event.criterio_exibicao);\n    return ['inscricao', 'acesso', 'manual', 'realizacao'].includes(value)\n      ? value\n      : 'realizacao';\n  }\n\n  function eventIsPublishable(event, today = todayAtMidnight()) {\n    const criterion = displayCriterion(event);\n    if (criterion === 'manual') return event.exibicao_ativa !== false;\n\n    if (criterion === 'inscricao' || criterion === 'acesso') {\n      const status = normalizeText(\n        criterion === 'inscricao' ? event.status_inscricao : event.status_acesso\n      ).replaceAll('_', ' ');\n      if (CLOSED_ACCESS_STATUSES.has(status)) return false;\n      const deadline = safeDate(\n        criterion === 'inscricao' ? event.inscricao_fim : event.acesso_fim\n      );\n      return !deadline || deadline >= today;\n    }\n\n    const end = safeDate(event.data_fim || event.data);\n    return !end || end >= today;\n  }\n\n  function eventSortKey(event) {\n    const criterion = displayCriterion(event);\n    const realization = safeDate(event.data)?.getTime() || Number.MAX_SAFE_INTEGER;\n    if (criterion === 'inscricao') {\n      const deadline = safeDate(event.inscricao_fim)?.getTime();\n      return [deadline ? 0 : 1, deadline || realization, realization];\n    }\n    if (criterion === 'acesso') {\n      const deadline = safeDate(event.acesso_fim)?.getTime();\n      return [deadline ? 0 : 1, deadline || realization, realization];\n    }\n    return [2, realization, realization];\n  }\n\n  function filterAndSort(events) {\n    const today = todayAtMidnight();\n\n    return events\n      .filter(event => event && event.titulo && event.data)\n      .filter(event => eventIsPublishable(event, today))\n      .sort((a, b) => {\n        const ka = eventSortKey(a);\n        const kb = eventSortKey(b);\n        return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] ||\n          String(a.horario || '').localeCompare(String(b.horario || ''), 'pt-BR') ||\n          String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');\n      });\n  }\n"
if old not in text:
    raise SystemExit("Bloco de validade/ordenação não encontrado. O app.js pode ter mudado.")
text = text.replace(old, new, 1)

old = '  function eventIntersectsPeriod(event, rangeStart, rangeEnd) {\n    const eventStart = parseCalendarDate(event.data);\n    const eventEnd = parseCalendarDate(event.data_fim || event.data, true);\n\n    if (!eventStart || !eventEnd) return false;\n\n    return eventStart <= rangeEnd && eventEnd >= rangeStart;\n  }\n'
new = "  function eventIntersectsPeriod(event, rangeStart, rangeEnd) {\n    const criterion = displayCriterion(event);\n    if (criterion === 'inscricao' || criterion === 'acesso') {\n      const startValue = criterion === 'inscricao'\n        ? (event.inscricao_inicio || event.data)\n        : (event.acesso_inicio || event.data);\n      const endValue = criterion === 'inscricao'\n        ? event.inscricao_fim\n        : event.acesso_fim;\n      const windowStart = parseCalendarDate(startValue);\n      // Prazo não informado + status disponível = janela aberta sem fim conhecido.\n      const windowEnd = endValue\n        ? parseCalendarDate(endValue, true)\n        : new Date(9999, 11, 31, 23, 59, 59, 999);\n      if (!windowStart || !windowEnd) return false;\n      return windowStart <= rangeEnd && windowEnd >= rangeStart;\n    }\n\n    const eventStart = parseCalendarDate(event.data);\n    const eventEnd = parseCalendarDate(event.data_fim || event.data, true);\n    if (!eventStart || !eventEnd) return false;\n    return eventStart <= rangeEnd && eventEnd >= rangeStart;\n  }\n"
if old not in text:
    raise SystemExit("Bloco do filtro de período não encontrado.")
text = text.replace(old, new, 1)

# Insere helpers da regra exclusiva da Escola Livre antes de applyUserFilters.
marker = '  function applyUserFilters(events) {\n'
helpers = "  function isSchoolEvent(event) {\n    return normalizeText(eventProgram(event)).includes(\n      'escola livre de artes arena da cultura'\n    );\n  }\n\n  function schoolProgramFilterIsActive() {\n    return normalizeText(state.filters.program).includes(\n      'escola livre de artes arena da cultura'\n    );\n  }\n\n  function eventsAvailableForCurrentFilters(events) {\n    // Somente o filtro explícito do programa libera todos os cursos individuais.\n    // Qualquer outro filtro atua sobre o mesmo lote reduzido do mural padrão.\n    return schoolProgramFilterIsActive() ? events : buildDefaultEvents(events);\n  }\n\n"
if marker not in text:
    raise SystemExit("Função applyUserFilters não encontrada.")
text = text.replace(marker, helpers + marker, 1)

# Substitui os usos mais comuns que liberavam todo o conjunto ao existir qualquer filtro.
replacements = [
    ("filterAndSort(applyUserFilters(state.allEvents))", "filterAndSort(applyUserFilters(eventsAvailableForCurrentFilters(state.allEvents)))"),
    ("applyUserFilters(state.allEvents)", "applyUserFilters(eventsAvailableForCurrentFilters(state.allEvents))"),
]
changed = False
for before, after in replacements:
    if before in text:
        text = text.replace(before, after)
        changed = True
if not changed:
    raise SystemExit("Não encontrei o ponto que aplica os filtros. Revise o app.js atual.")

path.write_text(text, encoding="utf-8")
print("Patch v48 aplicado em js/app.js.")
