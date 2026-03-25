import { sites as rawSites } from "./data/sites.js";

/**
 * @typedef {Object} SiteItem
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {string} category
 * @property {string[]} tags
 * @property {string} icon
 * @property {string} description
 * @property {string[]=} aliases
 */

/**
 * @typedef {Object} AppFilters
 * @property {string} query
 * @property {string} category
 * @property {string} tag
 * @property {"all"|"favorites"|"recent"} view
 */

const STORAGE_KEYS = {
  theme: "nav-tool.theme",
  favorites: "nav-tool.favorites",
  recent: "nav-tool.recent",
};

/** @type {SiteItem[]} */
const sites = rawSites.map((site) => ({
  ...site,
  tags: Array.isArray(site.tags) ? site.tags : [],
  aliases: Array.isArray(site.aliases) ? site.aliases : [],
}));

const categoryOrder = [...new Set(sites.map((site) => site.category))];
const siteIds = new Set(sites.map((site) => site.id));
const siteMap = new Map(sites.map((site) => [site.id, site]));

/** @type {AppFilters & { favorites: Set<string>, recent: string[], theme: string }} */
const state = {
  query: "",
  category: "all",
  tag: "all",
  view: "all",
  favorites: loadIdSet(STORAGE_KEYS.favorites),
  recent: loadIdList(STORAGE_KEYS.recent),
  theme: document.documentElement.dataset.theme || "dark",
};

const root = document.querySelector("#app");
const refs = {};

init();

function init() {
  root.innerHTML = createShell();

  refs.themeToggle = root.querySelector('[data-role="theme-toggle"]');
  refs.searchInput = root.querySelector('[data-role="search"]');
  refs.summary = root.querySelector('[data-role="summary"]');
  refs.stats = root.querySelector('[data-role="stats"]');
  refs.viewFilters = root.querySelector('[data-role="view-filters"]');
  refs.categoryFilters = root.querySelector('[data-role="category-filters"]');
  refs.tagFilters = root.querySelector('[data-role="tag-filters"]');
  refs.activeState = root.querySelector('[data-role="active-state"]');
  refs.sections = root.querySelector('[data-role="sections"]');
  refs.footerMeta = root.querySelector('[data-role="footer-meta"]');

  root.addEventListener("input", handleInput);
  root.addEventListener("click", handleClick);

  syncTheme(state.theme);
  render();
}

function createShell() {
  return `
    <div class="app-shell">
      <header class="panel hero">
        <div class="hero__copy">
          <p class="eyebrow">PERSONAL START PAGE</p>
          <h1>少昊导航台</h1>
          <p class="hero__summary" data-role="summary"></p>
        </div>
        <div class="hero__aside">
          <button class="theme-toggle" type="button" data-action="toggle-theme" data-role="theme-toggle"></button>
          <div class="stats-grid" data-role="stats"></div>
        </div>
      </header>

      <section class="panel toolbar">
        <label class="search-field">
          <span class="field-label">即时搜索</span>
          <input
            data-role="search"
            type="search"
            inputmode="search"
            autocomplete="off"
            spellcheck="false"
            placeholder="搜站点名、标签、描述，例如 GPT / 文档 / 视频"
          >
        </label>

        <div class="filter-stack">
          <div class="filter-row">
            <span class="filter-label">视图</span>
            <div class="chip-group" data-role="view-filters"></div>
          </div>

          <div class="filter-row">
            <span class="filter-label">分类</span>
            <div class="chip-group" data-role="category-filters"></div>
          </div>

          <div class="filter-row">
            <span class="filter-label">标签</span>
            <div class="chip-group chip-group--dense" data-role="tag-filters"></div>
          </div>
        </div>

        <div class="toolbar__footer">
          <div class="active-state" data-role="active-state"></div>
        </div>
      </section>

      <main class="content" data-role="sections"></main>

      <footer class="footer">
        <span>由 GitHub Pages 托管</span>
        <span data-role="footer-meta"></span>
      </footer>
    </div>
  `;
}

function handleInput(event) {
  if (event.target.matches('[data-role="search"]')) {
    state.query = event.target.value.trim();
    render();
  }
}

function handleClick(event) {
  const actionButton = event.target.closest("button[data-action]");
  const siteLink = event.target.closest("a[data-site-id]");

  if (actionButton) {
    const { action, value, siteId } = actionButton.dataset;

    if (action === "toggle-theme") {
      syncTheme(state.theme === "dark" ? "light" : "dark");
      render();
      return;
    }

    if (action === "set-view") {
      state.view = value;
      render();
      return;
    }

    if (action === "set-category") {
      state.category = value;
      if (value !== "all" && state.tag !== "all") {
        const allowedTags = new Set(getTagCounts().map((entry) => entry.tag));
        if (!allowedTags.has(state.tag)) {
          state.tag = "all";
        }
      }
      render();
      return;
    }

    if (action === "set-tag") {
      state.tag = value;
      render();
      return;
    }

    if (action === "reset-filters") {
      state.query = "";
      state.category = "all";
      state.tag = "all";
      state.view = "all";
      refs.searchInput.value = "";
      render();
      return;
    }

    if (action === "toggle-favorite" && siteId) {
      toggleFavorite(siteId);
      render();
    }
  }

  if (siteLink) {
    trackRecent(siteLink.dataset.siteId);
    render();
  }
}

function render() {
  refs.searchInput.value = state.query;
  refs.themeToggle.textContent = state.theme === "dark" ? "切换到浅色" : "切换到深色";
  refs.summary.textContent = buildSummary();
  refs.stats.innerHTML = renderStats();
  refs.viewFilters.innerHTML = renderViewFilters();
  refs.categoryFilters.innerHTML = renderCategoryFilters();
  refs.tagFilters.innerHTML = renderTagFilters();
  refs.activeState.innerHTML = renderActiveState();
  refs.sections.innerHTML = renderSections();
  refs.footerMeta.textContent = `数据源：src/data/sites.json · 共 ${sites.length} 个站点`;
}

function renderStats() {
  const visibleSites = getVisibleSites();
  const favoriteCount = sites.filter((site) => state.favorites.has(site.id)).length;
  const recentCount = state.recent.filter((id) => siteIds.has(id)).length;

  return [
    createStatCard("总数", String(sites.length)),
    createStatCard("当前结果", String(visibleSites.length)),
    createStatCard("收藏", String(favoriteCount)),
    createStatCard("最近访问", String(recentCount)),
  ].join("");
}

function renderViewFilters() {
  const recentCount = state.recent.filter((id) => siteIds.has(id)).length;
  const favoriteCount = sites.filter((site) => state.favorites.has(site.id)).length;
  const items = [
    { value: "all", label: "全部", count: sites.length },
    { value: "favorites", label: "收藏", count: favoriteCount },
    { value: "recent", label: "最近访问", count: recentCount },
  ];

  return items.map((item) => renderChip("set-view", item.value, item.label, item.count, state.view === item.value)).join("");
}

function renderCategoryFilters() {
  const counts = new Map(getCategoryCounts().map((entry) => [entry.category, entry.count]));
  const totalVisible = getVisibleSites({ ignoreCategory: true }).length;
  const items = [{ value: "all", label: "全部分类", count: totalVisible }];

  for (const category of categoryOrder) {
    items.push({
      value: category,
      label: category,
      count: counts.get(category) || 0,
    });
  }

  return items.map((item) => renderChip("set-category", item.value, item.label, item.count, state.category === item.value)).join("");
}

function renderTagFilters() {
  const entries = getTagCounts();
  const items = [{ value: "all", label: "全部标签", count: getVisibleSites({ ignoreTag: true }).length }];

  for (const entry of entries) {
    items.push({
      value: entry.tag,
      label: entry.tag,
      count: entry.count,
    });
  }

  return items
    .filter((item) => item.value === "all" || item.count > 0 || item.value === state.tag)
    .map((item) => renderChip("set-tag", item.value, item.label, item.count, state.tag === item.value))
    .join("");
}

function renderActiveState() {
  const parts = [];

  if (state.view !== "all") {
    parts.push(`<span class="state-pill">${escapeHTML(state.view === "favorites" ? "收藏视图" : "最近访问")}</span>`);
  }
  if (state.category !== "all") {
    parts.push(`<span class="state-pill">${escapeHTML(state.category)}</span>`);
  }
  if (state.tag !== "all") {
    parts.push(`<span class="state-pill">${escapeHTML(state.tag)}</span>`);
  }
  if (state.query) {
    parts.push(`<span class="state-pill">搜索: ${escapeHTML(state.query)}</span>`);
  }

  if (parts.length === 0) {
    return `<span class="active-state__hint">当前显示全部站点。先搜关键词，或者直接切到收藏/最近访问。</span>`;
  }

  return `
    ${parts.join("")}
    <button type="button" class="inline-reset" data-action="reset-filters">清空筛选</button>
  `;
}

function renderSections() {
  const visibleSites = getVisibleSites();

  if (visibleSites.length === 0) {
    return `
      <section class="panel empty-state">
        <h2>没有匹配结果</h2>
        <p>${escapeHTML(getEmptyMessage())}</p>
        <button type="button" class="empty-state__button" data-action="reset-filters">恢复全部站点</button>
      </section>
    `;
  }

  const groups = getGroupedSites(visibleSites);
  return groups
    .map(
      (group) => `
        <section class="category-block">
          <div class="section-head">
            <div>
              <p class="section-head__eyebrow">${escapeHTML(group.label)}</p>
              <h2>${escapeHTML(group.title)}</h2>
            </div>
            <span class="section-count">${group.sites.length}</span>
          </div>
          <div class="site-grid">
            ${group.sites.map((site) => renderSiteCard(site)).join("")}
          </div>
        </section>
      `,
    )
    .join("");
}

function renderSiteCard(site) {
  const isFavorite = state.favorites.has(site.id);
  const iconMarkup = renderIcon(site);

  return `
    <article class="panel site-card">
      <div class="site-card__top">
        ${iconMarkup}
        <button
          type="button"
          class="favorite-button ${isFavorite ? "is-active" : ""}"
          data-action="toggle-favorite"
          data-site-id="${escapeHTML(site.id)}"
          aria-label="${isFavorite ? "取消收藏" : "收藏站点"}"
        >
          ${isFavorite ? "已收藏" : "收藏"}
        </button>
      </div>
      <div class="site-card__body">
        <div class="site-card__meta">
          <span class="site-card__category">${escapeHTML(site.category)}</span>
        </div>
        <h3>${escapeHTML(site.name)}</h3>
        <p>${escapeHTML(site.description)}</p>
        <div class="tag-list">
          ${site.tags.map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}
        </div>
      </div>
      <div class="site-card__actions">
        <a
          class="site-card__link"
          href="${escapeHTML(site.url)}"
          target="_blank"
          rel="noreferrer noopener"
          data-site-id="${escapeHTML(site.id)}"
        >
          打开站点
        </a>
      </div>
    </article>
  `;
}

function renderIcon(site) {
  if (site.icon) {
    const src = resolveAsset(site.icon);
    return `
      <div class="site-icon">
        <img src="${escapeHTML(src)}" alt="${escapeHTML(site.name)}" loading="lazy">
      </div>
    `;
  }

  const initials = getInitials(site.name);
  const hue = getHue(site.id);

  return `
    <div class="site-icon site-icon--fallback" style="--icon-hue: ${hue};">
      <span>${escapeHTML(initials)}</span>
    </div>
  `;
}

function createStatCard(label, value) {
  return `
    <div class="stat-card">
      <span class="stat-card__label">${escapeHTML(label)}</span>
      <strong class="stat-card__value">${escapeHTML(value)}</strong>
    </div>
  `;
}

function renderChip(action, value, label, count, isActive) {
  return `
    <button
      type="button"
      class="chip ${isActive ? "is-active" : ""}"
      data-action="${escapeHTML(action)}"
      data-value="${escapeHTML(value)}"
    >
      <span>${escapeHTML(label)}</span>
      <small>${escapeHTML(String(count))}</small>
    </button>
  `;
}

function getVisibleSites(options = {}) {
  const baseSites = getViewScopedSites();

  return baseSites.filter((site) => {
    if (!options.ignoreCategory && state.category !== "all" && site.category !== state.category) {
      return false;
    }

    if (!options.ignoreTag && state.tag !== "all" && !site.tags.includes(state.tag)) {
      return false;
    }

    if (!matchesQuery(site, state.query)) {
      return false;
    }

    return true;
  });
}

function getViewScopedSites() {
  if (state.view === "favorites") {
    return sites.filter((site) => state.favorites.has(site.id));
  }

  if (state.view === "recent") {
    return state.recent.map((id) => siteMap.get(id)).filter(Boolean);
  }

  return sites;
}

function getCategoryCounts() {
  const scopedSites = getVisibleSites({ ignoreCategory: true });
  const counts = new Map();

  for (const site of scopedSites) {
    counts.set(site.category, (counts.get(site.category) || 0) + 1);
  }

  return categoryOrder.map((category) => ({
    category,
    count: counts.get(category) || 0,
  }));
}

function getTagCounts() {
  const scopedSites = getVisibleSites({ ignoreTag: true });
  const counts = new Map();

  for (const site of scopedSites) {
    for (const tag of site.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => left.tag.localeCompare(right.tag, "zh-CN"));
}

function getGroupedSites(visibleSites) {
  if (state.view === "recent") {
    return [
      {
        label: "LAST OPENED",
        title: "最近访问",
        sites: visibleSites,
      },
    ];
  }

  const grouped = categoryOrder
    .map((category) => ({
      label: "CATEGORY",
      title: category,
      sites: visibleSites.filter((site) => site.category === category),
    }))
    .filter((group) => group.sites.length > 0);

  if (state.category !== "all") {
    return grouped.filter((group) => group.title === state.category);
  }

  return grouped;
}

function matchesQuery(site, query) {
  if (!query) {
    return true;
  }

  const source = [
    site.name,
    site.description,
    site.category,
    ...site.tags,
    ...(site.aliases || []),
  ]
    .join(" ")
    .toLocaleLowerCase();

  return source.includes(query.toLocaleLowerCase());
}

function buildSummary() {
  const filteredCount = getVisibleSites().length;

  if (!state.query && state.category === "all" && state.tag === "all" && state.view === "all") {
    return "把常用网站集中成一个可搜索、可筛选、可沉淀习惯的个人起始台。";
  }

  return `当前命中 ${filteredCount} 个站点。你可以继续按分类、标签或收藏状态继续收窄范围。`;
}

function getEmptyMessage() {
  if (state.view === "favorites") {
    return "收藏列表还是空的。先从常用站点里标记几个，后面会越用越顺手。";
  }

  if (state.view === "recent") {
    return "最近访问还没有记录。打开任意站点后，这里会自动形成你的短期工作台。";
  }

  return "当前关键词或筛选条件太严格了。清空筛选后会恢复全部站点。";
}

function toggleFavorite(siteId) {
  if (!siteIds.has(siteId)) {
    return;
  }

  if (state.favorites.has(siteId)) {
    state.favorites.delete(siteId);
  } else {
    state.favorites.add(siteId);
  }

  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify([...state.favorites]));
}

function trackRecent(siteId) {
  if (!siteIds.has(siteId)) {
    return;
  }

  state.recent = [siteId, ...state.recent.filter((id) => id !== siteId)].slice(0, 8);
  localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(state.recent));
}

function syncTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

function loadIdSet(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(value)) {
      return new Set();
    }

    return new Set(value.filter((id) => siteIds.has(id)));
  } catch {
    return new Set();
  }
}

function loadIdList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((id) => siteIds.has(id));
  } catch {
    return [];
  }
}

function resolveAsset(path) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${import.meta.env.BASE_URL}${path}`;
}

function getInitials(name) {
  const cleaned = name.replace(/[^A-Za-z0-9\u4E00-\u9FFF]/g, "");

  if (!cleaned) {
    return "?";
  }

  return cleaned.slice(0, 2).toUpperCase();
}

function getHue(value) {
  let hash = 0;

  for (const char of value) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  }

  return Math.abs(hash) % 360;
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


