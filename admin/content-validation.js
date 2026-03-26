const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function isValidHttpUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }

  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidDateString(value) {
  const text = String(value || "").trim();
  if (!DATE_PATTERN.test(text)) {
    return false;
  }

  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

export function validateSitesPayload(sites) {
  if (!Array.isArray(sites)) {
    throw new Error("站点数据必须是数组");
  }

  const ids = new Set();
  for (const site of sites) {
    if (!site || typeof site !== "object") {
      throw new Error("站点条目格式不正确");
    }

    const id = assertString(site.id, "站点 id");
    assertString(site.name, "站点名称");
    const url = assertString(site.url, "站点链接");
    assertString(site.category, "站点分类");
    assertString(site.description, "站点描述");

    if (!isValidHttpUrl(url)) {
      throw new Error(`站点 ${id} 的链接格式无效，只支持 http/https`);
    }
    if (ids.has(id)) {
      throw new Error(`站点 id 重复: ${id}`);
    }

    ids.add(id);
    site.tags = normalizeStringArray(site.tags);
    site.aliases = normalizeStringArray(site.aliases);
    site.icon = typeof site.icon === "string" ? site.icon.trim() : "";
  }
}

export function validatePostsPayload(posts) {
  if (!Array.isArray(posts)) {
    throw new Error("文章数据必须是数组");
  }

  const ids = new Set();
  for (const post of posts) {
    if (!post || typeof post !== "object") {
      throw new Error("文章条目格式不正确");
    }

    const id = assertString(post.id, "文章 id");
    assertString(post.title, "文章标题");
    assertString(post.summary, "文章摘要");
    const publishedAt = assertString(post.publishedAt, "发布日期");

    if (!isValidDateString(publishedAt)) {
      throw new Error(`文章 ${id} 的发布日期无效，必须是 YYYY-MM-DD`);
    }
    if (ids.has(id)) {
      throw new Error(`文章 id 重复: ${id}`);
    }

    ids.add(id);
    post.tags = normalizeStringArray(post.tags);
    post.content = normalizeStringArray(post.content);
    if (post.content.length === 0) {
      throw new Error(`文章 ${id} 的正文不能为空`);
    }
  }
}

export function validateSearchEnginesPayload(searchEngines) {
  if (!Array.isArray(searchEngines)) {
    throw new Error("搜索引擎数据必须是数组");
  }

  const ids = new Set();
  for (const engine of searchEngines) {
    if (!engine || typeof engine !== "object") {
      throw new Error("搜索引擎条目格式不正确");
    }

    const id = assertString(engine.id, "搜索引擎 id");
    assertString(engine.label, "搜索引擎名称");
    assertString(engine.placeholder, "搜索提示词");
    const urlTemplate = assertString(engine.urlTemplate, "搜索链接模板");

    if (!isValidSearchUrlTemplate(urlTemplate)) {
      throw new Error(`搜索引擎 ${id} 的链接模板无效，必须是 http/https 且包含 {query}`);
    }
    if (ids.has(id)) {
      throw new Error(`搜索引擎 id 重复: ${id}`);
    }

    ids.add(id);
  }
}

export function isValidSearchUrlTemplate(value) {
  const text = String(value || "").trim();
  if (!text || !text.includes("{query}")) {
    return false;
  }

  const sample = text.replace(/{query}/g, "codex");
  return isValidHttpUrl(sample);
}

function assertString(value, label) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error(`${label}不能为空`);
  }

  return text;
}
