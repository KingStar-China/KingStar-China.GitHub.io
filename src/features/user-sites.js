export function normalizeUserSiteDraft(draft) {
  const name = String(draft.name || "").trim();
  const url = normalizeHttpUrl(draft.url);

  if (!name || !url) {
    return null;
  }

  return {
    name,
    url,
    category: String(draft.category || "个人").trim() || "个人",
    tags: parseTags(draft.tags),
    icon: "",
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
    icon: String(site.icon || ""),
    description: String(site.description || "").trim() || "我的自定义站点",
    aliases: [],
    source: "user",
  };
}

function normalizeHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function parseTags(value) {
  return [...new Set(String(value || "")
    .split(/[,，、\s]+/g)
    .map((tag) => tag.trim())
    .filter(Boolean))]
    .slice(0, 8);
}
