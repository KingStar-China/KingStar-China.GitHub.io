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
