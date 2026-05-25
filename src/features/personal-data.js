export function createPersonalDataSnapshot(state, validSiteIds, recentLimit) {
  return {
    favorites: [...state.favorites].filter((id) => validSiteIds.has(id)),
    recent: state.recent.filter((id) => validSiteIds.has(id)).slice(0, recentLimit),
    workbenchNote: state.workbenchNote,
    workbenchTodos: normalizeTodoItems(state.workbenchTodos),
  };
}

export function mergePersonalData(localSnapshot, remotePayload, validSiteIds, recentLimit) {
  const remote = normalizePersonalData(remotePayload, validSiteIds, recentLimit);
  const local = normalizePersonalData(localSnapshot, validSiteIds, recentLimit);

  return {
    favorites: [...new Set([...local.favorites, ...remote.favorites])],
    recent: mergeRecentIds(local.recent, remote.recent, validSiteIds, recentLimit),
    workbenchNote: local.workbenchNote || remote.workbenchNote,
    workbenchTodos: mergeTodoItems(local.workbenchTodos, remote.workbenchTodos),
  };
}

export function normalizePersonalData(value, validSiteIds, recentLimit) {
  const payload = value && typeof value === "object" ? value : {};

  return {
    favorites: normalizeIdArray(payload.favorites, validSiteIds),
    recent: normalizeIdArray(payload.recent, validSiteIds).slice(0, recentLimit),
    workbenchNote: String(payload.workbenchNote || ""),
    workbenchTodos: normalizeTodoItems(payload.workbenchTodos),
  };
}

function normalizeIdArray(value, validSiteIds) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((id) => String(id)).filter((id) => validSiteIds.has(id)))];
}

function normalizeTodoItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      id: String(item.id || `todo-${Date.now()}`),
      text: String(item.text || "").trim(),
      done: Boolean(item.done),
    }))
    .filter((item) => item.text)
    .slice(0, 12);
}

function mergeRecentIds(localIds, remoteIds, validSiteIds, recentLimit) {
  return [...new Set([...localIds, ...remoteIds])]
    .filter((id) => validSiteIds.has(id))
    .slice(0, recentLimit);
}

function mergeTodoItems(localItems, remoteItems) {
  const items = new Map();

  for (const item of remoteItems) {
    items.set(item.id, item);
  }

  for (const item of localItems) {
    items.set(item.id, item);
  }

  return [...items.values()].slice(0, 12);
}
