export function normalizeUserSiteDraft(draft) {
  const name = String(draft.name || "").trim();
  const url = normalizeHttpUrl(draft.url);
  const category = String(draft.category || "").trim();

  if (!name || !url || !category) {
    return null;
  }

  return {
    name,
    url,
    category,
    tags: parseTags(draft.tags),
    aliases: parseTags(draft.aliases),
    icon: normalizeOptionalHttpUrl(draft.icon),
    description: String(draft.description || "").trim(),
  };
}

export function normalizeRemoteUserSite(site) {
  if (!site || typeof site !== "object") {
    return null;
  }

  const name = String(site.name || "").trim();
  const url = normalizeHttpUrl(site.url);
  const id = String(site.id || "").trim();

  if (!id || !name || !url) {
    return null;
  }

  return {
    id,
    name,
    url,
    category: String(site.category || "个人").trim() || "个人",
    tags: Array.isArray(site.tags) ? site.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    aliases: Array.isArray(site.aliases) ? site.aliases.map((alias) => String(alias).trim()).filter(Boolean) : [],
    icon: String(site.icon || ""),
    description: normalizeRemoteDescription(site.description),
    source: "user",
  };
}

function normalizeRemoteDescription(value) {
  const description = String(value || "").trim();
  return description === "我的自定义站点" ? "" : description;
}

function normalizeHttpUrl(value) {
  try {
    const rawValue = String(value || "").trim();
    const url = new URL(hasHttpProtocol(rawValue) ? rawValue : `https://${rawValue}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function normalizeOptionalHttpUrl(value) {
  const rawValue = String(value || "").trim();
  return rawValue ? normalizeHttpUrl(rawValue) : "";
}

function hasHttpProtocol(value) {
  return /^https?:\/\//i.test(value);
}

function parseTags(value) {
  return [...new Set(String(value || "")
    .split(/[,，、\s]+/g)
    .map((tag) => tag.trim())
    .filter(Boolean))]
    .slice(0, 8);
}
