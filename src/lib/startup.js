export function runAfterFirstPaint(callback, windowRef = globalThis.window) {
  const run = () => callback();

  if (typeof windowRef?.requestIdleCallback === "function") {
    return windowRef.requestIdleCallback(run, { timeout: 1_500 });
  }

  return windowRef.setTimeout(run, 120);
}

export function hasSamePublicSites(leftSites = [], rightSites = []) {
  if (leftSites.length !== rightSites.length) {
    return false;
  }

  return leftSites.every((leftSite, index) => {
    const rightSite = rightSites[index];
    if (!rightSite) {
      return false;
    }

    return (
      leftSite.id === rightSite.id
      && leftSite.name === rightSite.name
      && leftSite.url === rightSite.url
      && leftSite.category === rightSite.category
      && leftSite.description === rightSite.description
      && leftSite.icon === rightSite.icon
      && String(leftSite.createdAt || "") === String(rightSite.createdAt || "")
      && JSON.stringify(leftSite.tags || []) === JSON.stringify(rightSite.tags || [])
      && JSON.stringify(leftSite.aliases || []) === JSON.stringify(rightSite.aliases || [])
    );
  });
}

export function normalizePublicSiteRows(rows, normalizeSite) {
  if (!Array.isArray(rows) || typeof normalizeSite !== "function") {
    return null;
  }

  return rows.map(normalizeSite).filter(Boolean);
}

export function normalizeCachedPublicSites(value, normalizeSite) {
  if (!value || typeof value !== "object" || !Array.isArray(value.sites)) {
    return null;
  }

  return normalizePublicSiteRows(value.sites, normalizeSite);
}
