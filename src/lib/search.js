export function normalizeQuery(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

export function getSiteSearchScore(site, query) {
  const keyword = normalizeQuery(query);
  if (!keyword) {
    return 0;
  }

  let score = 0;
  const name = normalizeQuery(site.name);
  const category = normalizeQuery(site.category);
  const description = normalizeQuery(site.description);
  const tags = normalizeStringArray(site.tags);
  const aliases = normalizeStringArray(site.aliases);
  const compactKeyword = normalizeCompactQuery(keyword);
  const compactName = normalizeCompactQuery(site.name);
  const compactCategory = normalizeCompactQuery(site.category);
  const compactDescription = normalizeCompactQuery(site.description);
  const compactTags = normalizeCompactStringArray(site.tags);
  const compactAliases = normalizeCompactStringArray(site.aliases);
  const host = getNormalizedHost(site.url);
  const compactHost = normalizeCompactQuery(host);

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
  const keyword = normalizeQuery(query);
  if (!keyword) {
    return 0;
  }

  let score = 0;
  const title = normalizeQuery(post.title);
  const summary = normalizeQuery(post.summary);
  const tags = normalizeStringArray(post.tags);
  const content = normalizeQuery(Array.isArray(post.content) ? post.content.join(" ") : post.content);
  const compactKeyword = normalizeCompactQuery(keyword);
  const compactTitle = normalizeCompactQuery(post.title);
  const compactSummary = normalizeCompactQuery(post.summary);
  const compactTags = normalizeCompactStringArray(post.tags);
  const compactContent = normalizeCompactQuery(Array.isArray(post.content) ? post.content.join(" ") : post.content);

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

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeQuery(item));
}

function normalizeCompactStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeCompactQuery(item))
    .filter(Boolean);
}

function normalizeCompactQuery(value) {
  return normalizeQuery(value).replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

function getNormalizedHost(url) {
  try {
    return new URL(String(url || "").trim()).host.replace(/^www\./i, "").toLocaleLowerCase();
  } catch {
    return "";
  }
}
