const DEFAULT_RECENT_SITES_LIMIT = 20;

export function getCommandSections({
  state,
  sites,
  posts,
  siteMap,
  getSiteSearchScore,
  getPostSearchScore,
  commandResultLimit,
  getHost,
  formatShortDate,
}) {
  const query = state.commandQuery.trim();

  if (!query) {
    return getDefaultCommandSections({ state, posts, siteMap, getHost, formatShortDate });
  }

  const siteResults = sites
    .map((site) => ({ site, score: getSiteSearchScore(site, query) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.site.name.localeCompare(right.site.name, "zh-CN"))
    .slice(0, commandResultLimit)
    .map((entry) => createSiteCommandResult(entry.site, getHost));

  const postResults = posts
    .map((post) => ({ post, score: getPostSearchScore(post, query) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || new Date(right.post.publishedAt).getTime() - new Date(left.post.publishedAt).getTime())
    .slice(0, commandResultLimit)
    .map((entry) => createPostCommandResult(entry.post, formatShortDate));

  return [
    siteResults.length > 0 ? { title: "网站结果", items: siteResults } : null,
    postResults.length > 0 ? { title: "博客结果", items: postResults } : null,
  ].filter(Boolean);
}

export function getFlatCommandResults(deps) {
  return getCommandSections(deps).flatMap((section) => section.items);
}

export function runCommandResult(result, deps) {
  if (!result) {
    return;
  }

  const { siteMap, trackRecent, closeCommandPalette, render, openPost, resetNavFilters, state } = deps;

  if (result.kind === "site") {
    const site = siteMap.get(result.id);
    if (!site) {
      return;
    }

    const openedWindow = window.open("", "_blank");
    if (!openedWindow) {
      return;
    }

    try {
      openedWindow.opener = null;
    } catch {}

    trackRecent(site.id);
    closeCommandPalette();
    render();

    openedWindow.location.href = site.url;
    return;
  }

  if (result.kind === "post") {
    openPost(result.id);
    closeCommandPalette();
    render();
    return;
  }

  if (result.kind === "action") {
    runCommandAction(result.id, { resetNavFilters, state });
    closeCommandPalette();
    render();
  }
}

export function openCommandPalette(state) {
  state.commandOpen = true;
  state.commandIndex = 0;
}

export function closeCommandPalette(state) {
  state.commandOpen = false;
  state.commandQuery = "";
  state.commandIndex = 0;
}

function getDefaultCommandSections({ state, posts, siteMap, getHost, formatShortDate }) {
  const recentSites = state.recent
    .map((id) => siteMap.get(id))
    .filter(Boolean)
    .slice(0, DEFAULT_RECENT_SITES_LIMIT)
    .map((site) => createSiteCommandResult(site, getHost));

  const latestPosts = posts.slice(0, 4).map((post) => createPostCommandResult(post, formatShortDate));

  return [
    recentSites.length > 0 ? { title: "最近访问", items: recentSites } : null,
    latestPosts.length > 0 ? { title: "最新文章", items: latestPosts } : null,
  ].filter(Boolean);
}

function createSiteCommandResult(site, getHost) {
  return {
    kind: "site",
    id: site.id,
    badge: site.category || "网站",
    title: site.name,
    subtitle: site.description || site.url,
    meta: site.tags.slice(0, 3).join(" / ") || getHost(site.url),
  };
}

function createPostCommandResult(post, formatShortDate) {
  return {
    kind: "post",
    id: post.id,
    badge: "博客",
    title: post.title,
    subtitle: post.summary,
    meta: `${formatShortDate(post.publishedAt)} · ${post.tags.slice(0, 2).join(" / ") || "文章"}`,
  };
}

function runCommandAction(actionId, { resetNavFilters, state }) {
  if (actionId === "nav-home") {
    state.section = "nav";
    resetNavFilters();
    return;
  }

  if (actionId === "nav-favorites") {
    state.section = "nav";
    resetNavFilters();
    state.view = "favorites";
    return;
  }

  if (actionId === "nav-recent") {
    state.section = "nav";
    resetNavFilters();
    state.view = "recent";
    return;
  }

  if (actionId === "blog-list") {
    state.section = "blog-list";
  }
}
