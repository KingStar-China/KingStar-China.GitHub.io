export function normalizeQuery(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

const EMPTY_STRING_ARRAY = Object.freeze([]);
const siteSearchIndexCache = new WeakMap();
const postSearchIndexCache = new WeakMap();
let lastSearchQuerySource = null;
let lastSearchQueryIndex = { keyword: "", compactKeyword: "" };

export function getSiteSearchScore(site, query) {
  const { keyword, compactKeyword } = getSearchQueryIndex(query);
  if (!keyword) {
    return 0;
  }

  let score = 0;
  const {
    name,
    category,
    description,
    tags,
    aliases,
    compactName,
    compactCategory,
    compactDescription,
    compactTags,
    compactAliases,
    host,
    compactHost,
  } = getSiteSearchIndex(site);

  if (name === keyword) {
    score += 300;
  } else if (name.startsWith(keyword)) {
    score += 220;
  } else if (name.includes(keyword)) {
    score += 160;
  }

  if (category === keyword) {
    score += 120;
  } else if (category.includes(keyword)) {
    score += 80;
  }

  if (tags.some((tag) => tag === keyword)) {
    score += 140;
  } else if (tags.some((tag) => tag.includes(keyword))) {
    score += 100;
  }

  if (aliases.some((alias) => alias === keyword)) {
    score += 130;
  } else if (aliases.some((alias) => alias.includes(keyword))) {
    score += 90;
  }

  if (description.includes(keyword)) {
    score += 60;
  }

  if (host === keyword) {
    score += 220;
  } else if (host.startsWith(keyword)) {
    score += 160;
  } else if (host.includes(keyword)) {
    score += 120;
  }

  if (compactKeyword && compactKeyword !== keyword) {
    if (compactName === compactKeyword) {
      score += 180;
    } else if (compactName.startsWith(compactKeyword)) {
      score += 130;
    } else if (compactName.includes(compactKeyword)) {
      score += 90;
    }

    if (compactCategory === compactKeyword) {
      score += 70;
    } else if (compactCategory.includes(compactKeyword)) {
      score += 45;
    }

    if (compactTags.some((tag) => tag === compactKeyword)) {
      score += 90;
    } else if (compactTags.some((tag) => tag.includes(compactKeyword))) {
      score += 60;
    }

    if (compactAliases.some((alias) => alias === compactKeyword)) {
      score += 90;
    } else if (compactAliases.some((alias) => alias.includes(compactKeyword))) {
      score += 60;
    }

    if (compactHost === compactKeyword) {
      score += 120;
    } else if (compactHost.includes(compactKeyword)) {
      score += 80;
    }

    if (compactDescription.includes(compactKeyword)) {
      score += 35;
    }
  }

  return score;
}

export function getPostSearchScore(post, query) {
  const { keyword, compactKeyword } = getSearchQueryIndex(query);
  if (!keyword) {
    return 0;
  }

  let score = 0;
  const {
    title,
    summary,
    tags,
    content,
    compactTitle,
    compactSummary,
    compactTags,
    compactContent,
  } = getPostSearchIndex(post);

  if (title === keyword) {
    score += 300;
  } else if (title.startsWith(keyword)) {
    score += 230;
  } else if (title.includes(keyword)) {
    score += 170;
  }

  if (tags.some((tag) => tag === keyword)) {
    score += 130;
  } else if (tags.some((tag) => tag.includes(keyword))) {
    score += 90;
  }

  if (summary.includes(keyword)) {
    score += 70;
  }

  if (content.includes(keyword)) {
    score += 40;
  }

  if (compactKeyword && compactKeyword !== keyword) {
    if (compactTitle === compactKeyword) {
      score += 180;
    } else if (compactTitle.startsWith(compactKeyword)) {
      score += 130;
    } else if (compactTitle.includes(compactKeyword)) {
      score += 90;
    }

    if (compactTags.some((tag) => tag === compactKeyword)) {
      score += 85;
    } else if (compactTags.some((tag) => tag.includes(compactKeyword))) {
      score += 55;
    }

    if (compactSummary.includes(compactKeyword)) {
      score += 45;
    }

    if (compactContent.includes(compactKeyword)) {
      score += 25;
    }
  }

  return score;
}

export function matchesSiteQuery(site, query) {
  if (!query) {
    return true;
  }

  return getSiteSearchScore(site, query) > 0;
}

export function matchesPostQuery(post, query) {
  if (!query) {
    return true;
  }

  return getPostSearchScore(post, query) > 0;
}

function getSearchQueryIndex(value) {
  const source = String(value || "");
  if (source === lastSearchQuerySource) {
    return lastSearchQueryIndex;
  }

  const keyword = normalizeQuery(source);
  lastSearchQuerySource = source;
  lastSearchQueryIndex = {
    keyword,
    compactKeyword: compactNormalizedQuery(keyword),
  };
  return lastSearchQueryIndex;
}

function getSiteSearchIndex(site) {
  const tagsSource = Array.isArray(site.tags) ? site.tags : EMPTY_STRING_ARRAY;
  const aliasesSource = Array.isArray(site.aliases) ? site.aliases : EMPTY_STRING_ARRAY;
  const tagsKey = tagsSource.join("\u001f");
  const aliasesKey = aliasesSource.join("\u001f");
  const cached = siteSearchIndexCache.get(site);

  if (
    cached
    && cached.sources.name === site.name
    && cached.sources.category === site.category
    && cached.sources.description === site.description
    && cached.sources.tagsKey === tagsKey
    && cached.sources.aliasesKey === aliasesKey
    && cached.sources.url === site.url
  ) {
    return cached.index;
  }

  const name = normalizeQuery(site.name);
  const category = normalizeQuery(site.category);
  const description = normalizeQuery(site.description);
  const tags = normalizeStringArray(tagsSource);
  const aliases = normalizeStringArray(aliasesSource);
  const host = getNormalizedHost(site.url);
  const index = {
    name,
    category,
    description,
    tags,
    aliases,
    compactName: compactNormalizedQuery(name),
    compactCategory: compactNormalizedQuery(category),
    compactDescription: compactNormalizedQuery(description),
    compactTags: tags.map(compactNormalizedQuery).filter(Boolean),
    compactAliases: aliases.map(compactNormalizedQuery).filter(Boolean),
    host,
    compactHost: compactNormalizedQuery(host),
  };

  siteSearchIndexCache.set(site, {
    sources: {
      name: site.name,
      category: site.category,
      description: site.description,
      tagsKey,
      aliasesKey,
      url: site.url,
    },
    index,
  });
  return index;
}

function getPostSearchIndex(post) {
  const tagsSource = Array.isArray(post.tags) ? post.tags : EMPTY_STRING_ARRAY;
  const contentSource = post.content;
  const tagsKey = tagsSource.join("\u001f");
  const contentValue = Array.isArray(contentSource) ? contentSource.join(" ") : contentSource;
  const cached = postSearchIndexCache.get(post);

  if (
    cached
    && cached.sources.title === post.title
    && cached.sources.summary === post.summary
    && cached.sources.tagsKey === tagsKey
    && cached.sources.contentValue === contentValue
  ) {
    return cached.index;
  }

  const title = normalizeQuery(post.title);
  const summary = normalizeQuery(post.summary);
  const tags = normalizeStringArray(tagsSource);
  const content = normalizeQuery(contentValue);
  const index = {
    title,
    summary,
    tags,
    content,
    compactTitle: compactNormalizedQuery(title),
    compactSummary: compactNormalizedQuery(summary),
    compactTags: tags.map(compactNormalizedQuery).filter(Boolean),
    compactContent: compactNormalizedQuery(content),
  };

  postSearchIndexCache.set(post, {
    sources: {
      title: post.title,
      summary: post.summary,
      tagsKey,
      contentValue,
    },
    index,
  });
  return index;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeQuery(item));
}

function compactNormalizedQuery(value) {
  return value.replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

function getNormalizedHost(url) {
  try {
    return new URL(String(url || "").trim()).host.replace(/^www\./i, "").toLocaleLowerCase();
  } catch {
    return "";
  }
}
