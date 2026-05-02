import { sites as rawSites } from "./data/sites.js";
import { posts as rawPosts } from "./data/posts.js";
import { siteMeta } from "./data/site.js";
import { searchEngines as rawSearchEngines } from "./data/search-engines.js";
import { themes } from "./data/themes.js";
import { getPostSearchScore, getSiteSearchScore, matchesPostQuery, matchesSiteQuery } from "./lib/search.js";
import { formatPostReadingTime, getAdjacentPosts, getRelatedPosts } from "./lib/blog.js";
import { getCommandSections as getCommandSectionsState, getFlatCommandResults as getFlatCommandResultsState, runCommandResult as executeCommandResult, openCommandPalette as openCommandPaletteState, closeCommandPalette as closeCommandPaletteState } from "./lib/command-palette.js";
import { renderOverviewDeck as renderOverviewSection } from "./lib/overview.js";

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
 * @typedef {Object} BlogPost
 * @property {string} id
 * @property {string} title
 * @property {string} summary
 * @property {string} publishedAt
 * @property {string[]} tags
 * @property {string} content
 * @property {string=} contentHtml
 * @property {number=} blockCount
 * @property {{id: string, text: string, depth: number}[]=} toc
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
  themePreset: "nav-tool.themePreset",
  favorites: "nav-tool.favorites",
  recent: "nav-tool.recent",
  workbenchNote: "nav-tool.workbench.note",
  workbenchTodos: "nav-tool.workbench.todos",
  searchEngine: "nav-tool.search.engine",
  overviewCollapsed: "nav-tool.overview.collapsed",
};

const searchEngines = rawSearchEngines
  .map((engine) => ({
    id: String(engine.id || "").trim(),
    label: String(engine.label || "").trim(),
    priority: normalizeSearchEnginePriority(engine.priority),
    placeholder: String(engine.placeholder || "").trim(),
    urlTemplate: String(engine.urlTemplate || "").trim(),
    buildUrl: (query) => String(engine.urlTemplate || "").replace(/{query}/g, encodeURIComponent(query)),
  }))
  .filter((engine) => engine.id && engine.label && engine.urlTemplate && Number.isInteger(engine.priority))
  .sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label, "zh-CN"));

const defaultSearchEngine = searchEngines[0]?.id || "baidu";

const POSTS_PER_PAGE = 5;
const COMMAND_RESULT_LIMIT = 8;
const RECENT_HISTORY_LIMIT = 20;

/** @type {SiteItem[]} */
const sites = rawSites.map((site) => ({
  ...site,
  tags: Array.isArray(site.tags) ? site.tags : [],
  aliases: Array.isArray(site.aliases) ? site.aliases : [],
}));

/** @type {BlogPost[]} */
const posts = rawPosts
  .map((post) => ({
    ...post,
    tags: Array.isArray(post.tags) ? post.tags : [],
    content: typeof post.content === "string" ? post.content : String(post.content || ""),
    contentHtml: typeof post.contentHtml === "string" ? post.contentHtml : "",
    blockCount: Number.isFinite(post.blockCount) ? post.blockCount : getMarkdownBlockCount(post.content),
    toc: Array.isArray(post.toc) ? post.toc : [],
  }))
  .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime());

const categoryOrder = [...new Set(sites.map((site) => site.category))];
const siteIds = new Set(sites.map((site) => site.id));
const siteMap = new Map(sites.map((site) => [site.id, site]));
const postMap = new Map(posts.map((post) => [post.id, post]));
const themeMap = new Map(themes.map((theme) => [theme.id, theme]));
const categoryDescriptions = {
  AI: "把高频模型、检索和内容生成入口压到同一层，减少来回切换。",
  学习: "课程、资料、文档和知识型工具的集中区，适合连续阅读。",
  翻墙: "网络、线路和连接工具入口，优先保证进入主工作流的速度。",
};

const state = {
  section: "nav",
  query: "",
  category: "all",
  tag: "all",
  view: "all",
  favorites: loadIdSet(STORAGE_KEYS.favorites),
  recent: loadIdList(STORAGE_KEYS.recent),
  theme: document.documentElement.dataset.theme || "dark",
  themePreset: getThemePresetId(loadStoredText(STORAGE_KEYS.themePreset)),
  themeShelfExpanded: false,
  themeShowcaseIndex: 0,
  workbenchNote: loadStoredText(STORAGE_KEYS.workbenchNote),
  workbenchTodos: loadTodoList(STORAGE_KEYS.workbenchTodos),
  workbenchTodoDraft: "",
  now: Date.now(),
  engineQuery: "",
  searchEngine: loadStoredText(STORAGE_KEYS.searchEngine) || defaultSearchEngine,
  blogQuery: "",
  blogTag: "all",
  blogPage: 1,
  selectedPostId: posts[0]?.id || "",
  postsPerPage: POSTS_PER_PAGE,
  commandOpen: false,
  commandQuery: "",
  commandIndex: 0,
  nextRouteMode: "replace",
  activeHeadingId: "",
  overviewCollapsed: loadOverviewCollapsedState(),
  pendingScrollTop: false,
};

const root = document.querySelector("#app");
const refs = {};
let commandFocusRetryId = 0;

init();

function init() {
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  root.innerHTML = createShell();

  refs.sectionTabs = root.querySelector('[data-role="section-tabs"]');
  refs.themeShelf = root.querySelector('[data-role="theme-shelf"]');
  refs.summary = root.querySelector('[data-role="summary"]');
  refs.heroSearch = root.querySelector('[data-role="hero-search"]');
  refs.stats = root.querySelector('[data-role="stats"]');
  refs.toolbar = root.querySelector('[data-role="toolbar"]');
  refs.content = root.querySelector('[data-role="content"]');
  refs.commandPalette = root.querySelector('[data-role="command-palette"]');

  root.addEventListener("input", handleInput);
  root.addEventListener("pointerdown", handlePointerDown, true);
  root.addEventListener("click", handleClick);
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("popstate", handlePopState);
  window.addEventListener("hashchange", handlePopState);
  window.addEventListener("scroll", handleScroll, { passive: true });

  hydrateFromLocation();
  syncTheme(state.theme);
  startWorkbenchClock();
  render();
}
function createShell() {
  return `
    <div class="app-shell">
      <header class="panel hero">
        <div class="hero__copy">
          <p class="eyebrow">PERSONAL START PAGE</p>
          <div class="hero__title-row">
            <h1>少昊导航</h1>
            <div class="hero__controls">
              <button type="button" class="command-bar" data-action="open-command" data-role="command-bar">
                <span class="command-bar__label">全站搜索</span>
                <span class="command-bar__hint">Ctrl + K</span>
              </button>
              <div class="section-tabs" data-role="section-tabs"></div>
            </div>
          </div>
          <p class="hero__summary" data-role="summary"></p>
          <div class="hero__search" data-role="hero-search"></div>
        </div>
        <div class="hero__aside">
          <div class="theme-shelf" data-role="theme-shelf"></div>
          <div class="stats-grid" data-role="stats"></div>
        </div>
      </header>

      <section class="panel toolbar" data-role="toolbar"></section>

      <main class="content" data-role="content"></main>

      <div class="scroll-action-group" aria-label="页面滚动快捷按钮">
        <button type="button" class="scroll-action-button" data-action="scroll-bottom">直达底部</button>
        <button type="button" class="scroll-action-button" data-action="scroll-top">回到顶部</button>
      </div>
    </div>

    <div data-role="command-palette"></div>
  `;
}

function handleInput(event) {
  if (event.target.matches('[data-role="engine-search"]')) {
    state.engineQuery = event.target.value;
    return;
  }

  if (event.target.matches('[data-role="search"]')) {
    state.query = event.target.value;
    renderNavSearchState();
    return;
  }

  if (event.target.matches('[data-role="blog-search"]')) {
    state.blogQuery = event.target.value;
    state.blogPage = 1;
    renderBlogSearchState();
    return;
  }

  if (event.target.matches('[data-role="workbench-note"]')) {
    state.workbenchNote = event.target.value;
    localStorage.setItem(STORAGE_KEYS.workbenchNote, state.workbenchNote);
    return;
  }

  if (event.target.matches('[data-role="workbench-todo-input"]')) {
    state.workbenchTodoDraft = event.target.value;
    return;
  }

  if (event.target.matches('[data-role="command-search"]')) {
    state.commandQuery = event.target.value;
    state.commandIndex = 0;
    syncCommandPaletteResults({ maintainFocus: true });
  }
}
function handlePointerDown(event) {
  const actionButton = event.target.closest("button[data-action]");

  if (!actionButton) {
    return;
  }

  const { action, commandKind, commandId } = actionButton.dataset;

  if (action === "open-command") {
    event.preventDefault();
    event.stopPropagation();
    openCommandPalette();
    syncCommandPaletteResults({ maintainFocus: true });
    return;
  }

  if (action !== "run-command") {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  runCommandResult({ kind: commandKind, id: commandId });
}
function handleClick(event) {
  const actionButton = event.target.closest("button[data-action]");
  const routeLink = event.target.closest("a[data-route-kind]");
  const siteLink = event.target.closest("a[data-site-id]");

  if (actionButton) {
    const { action, value, siteId, postId, commandKind, commandId } = actionButton.dataset;

    if (action === "open-command") {
      if (event.detail !== 0) {
        return;
      }

      openCommandPalette();
      syncCommandPaletteResults({ maintainFocus: true });
      return;
    }
    if (action === "set-search-engine") {
      state.searchEngine = getSearchEngineId(value);
      localStorage.setItem(STORAGE_KEYS.searchEngine, state.searchEngine);
      refs.heroSearch.innerHTML = renderHeroSearch();
      refs.engineSearchInput = refs.heroSearch.querySelector('[data-role="engine-search"]');
      syncHeroSearchBox();
      return;
    }

    if (action === "scroll-bottom") {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      return;
    }

    if (action === "scroll-top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (action === "submit-engine-search") {
      submitEngineSearch();
      return;
    }

    if (action === "close-command") {
      closeCommandPalette();
      renderCommandPaletteState();
      return;
    }


    if (action === "toggle-theme") {
      syncTheme(state.theme === "dark" ? "light" : "dark");
      render();
      return;
    }

    if (action === "toggle-theme-shelf") {
      syncThemeShelfExpanded(!state.themeShelfExpanded);
      render();
      return;
    }

    if (action === "set-theme-preset" && value) {
      syncThemePreset(value);
      render();
      return;
    }

    if (action === "prev-theme-showcase") {
      shiftThemeShowcase(-1);
      render();
      return;
    }

    if (action === "next-theme-showcase") {
      shiftThemeShowcase(1);
      render();
      return;
    }

    if (action === "set-theme-showcase" && value) {
      syncThemeShowcase(value);
      render();
      return;
    }

    if (action === "set-section") {
      state.section = value === "nav" ? "nav" : "blog-list";
      state.nextRouteMode = "push";
      render();
      scrollPageTop();
      return;
    }

    if (action === "toggle-overview-card" && value) {
      state.overviewCollapsed = !state.overviewCollapsed;
      localStorage.setItem(STORAGE_KEYS.overviewCollapsed, JSON.stringify(state.overviewCollapsed));
      render();
      return;
    }

    if (action === "jump-category" && value) {
      const target = Array.from(refs.content.querySelectorAll("[data-category-anchor]"))
        .find((element) => element.dataset.categoryAnchor === value);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (action === "jump-workbench") {
      refs.content.querySelector('[data-section-anchor="workbench"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
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

    if (action === "set-blog-tag") {
      state.blogTag = value;
      state.blogPage = 1;
      state.section = "blog-list";
      state.nextRouteMode = "push";
      render();
      scrollPageTop();
      return;
    }

    if (action === "reset-filters") {
      resetNavFilters();
      render();
      return;
    }

    if (action === "reset-blog-filters") {
      resetBlogFilters();
      state.section = "blog-list";
      state.nextRouteMode = "push";
      render();
      scrollPageTop();
      return;
    }

    if (action === "add-workbench-todo") {
      if (addWorkbenchTodo()) {
        render();
        focusWorkbenchTodoInput();
      }
      return;
    }

    if (action === "toggle-workbench-todo") {
      toggleWorkbenchTodo(value);
      render();
      return;
    }

    if (action === "remove-workbench-todo") {
      removeWorkbenchTodo(value);
      render();
      return;
    }

    if (action === "clear-workbench-done") {
      clearCompletedWorkbenchTodos();
      render();
      return;
    }

    if (action === "toggle-favorite" && siteId) {
      toggleFavorite(siteId);
      render();
      return;
    }

    if (action === "open-post" && postId && postMap.has(postId)) {
      openPost(postId);
      render();
      scrollPageTop();
      return;
    }

    if (action === "back-to-blog") {
      state.section = "blog-list";
      state.nextRouteMode = "push";
      render();
      scrollPageTop();
      return;
    }

    if (action === "set-blog-page") {
      state.blogPage = clampPage(Number(value));
      state.section = "blog-list";
      state.nextRouteMode = "push";
      render();
      scrollPageTop();
      return;
    }

    if (action === "jump-heading" && value) {
      state.activeHeadingId = value;
      syncActiveTocLink();
      document.getElementById(value)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (action === "copy-post-link") {
      copyCurrentPostLink().catch(() => {
        setTransientStatus("复制文章链接失败，请手动复制地址。");
      });
      return;
    }
  }

  if (routeLink) {
    return;
  }

  if (siteLink) {
    trackRecent(siteLink.dataset.siteId);
    if (state.commandOpen) {
      closeCommandPalette();
    }
    render();
  }
}

function handleKeydown(event) {
  if (event.target.matches('[data-role="engine-search"]') && event.key === "Enter") {
    event.preventDefault();
    submitEngineSearch();
    return;
  }

  if (event.target.matches('[data-role="workbench-todo-input"]') && event.key === "Enter") {
    event.preventDefault();
    if (addWorkbenchTodo()) {
      render();
      focusWorkbenchTodoInput();
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommandPalette();
    syncCommandPaletteResults({ maintainFocus: true });
    return;
  }

  if (!state.commandOpen) {
    return;
  }

  if (event.isComposing) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeCommandPalette();
    renderCommandPaletteState();
    return;
  }

  const commandResults = getFlatCommandResults();
  if (commandResults.length === 0) {
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.commandIndex = (state.commandIndex + 1) % commandResults.length;
    syncCommandPaletteResults({ maintainFocus: true });
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.commandIndex = (state.commandIndex - 1 + commandResults.length) % commandResults.length;
    syncCommandPaletteResults({ maintainFocus: true });
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    runCommandResult(commandResults[state.commandIndex]);
  }
}
function render() {
  state.blogPage = clampPage(state.blogPage);
  root.querySelector(".app-shell")?.classList.toggle("is-article-view", state.section === "blog-detail");
  refs.themeShelf.classList.toggle("is-expanded", state.themeShelfExpanded);
  refs.themeShelf.innerHTML = renderThemeShelf();
  refs.themeToggle = refs.themeShelf.querySelector('[data-role="theme-toggle"]');
  refs.themeToggle.textContent = state.theme === "dark" ? "浅色底" : "深色底";
  refs.sectionTabs.innerHTML = renderSectionTabs();
  refs.summary.textContent = buildSummary();
  refs.heroSearch.innerHTML = state.section === "nav" || state.section === "blog-list" ? renderHeroSearch() : "";
  refs.stats.innerHTML = state.section === "nav" ? renderNavStats() : renderBlogStats();
  refs.toolbar.innerHTML = renderToolbar();
  refs.content.innerHTML = renderContent();
  renderCommandPaletteState({ maintainFocus: state.commandOpen });

  refs.searchInput = refs.toolbar.querySelector('[data-role="search"]');
  if (refs.searchInput) {
    refs.searchInput.value = state.query;
  }

  refs.blogSearchInput = refs.toolbar.querySelector('[data-role="blog-search"]');
  if (refs.blogSearchInput) {
    refs.blogSearchInput.value = state.blogQuery;
  }

  refs.engineSearchInput = refs.heroSearch.querySelector('[data-role="engine-search"]');
  syncHeroSearchBox();

  refs.workbenchTodoInput = refs.content.querySelector('[data-role="workbench-todo-input"]');
  if (refs.workbenchTodoInput) {
    refs.workbenchTodoInput.value = state.workbenchTodoDraft;
  }

  syncActiveHeading();
  syncActiveTocLink();
  syncWorkbenchClock();
  syncRoute(state.nextRouteMode);
  state.nextRouteMode = "replace";
  updateSeo();

  if (state.pendingScrollTop) {
    state.pendingScrollTop = false;
    scrollToCurrentSectionTop();
  }
}

function renderCommandPaletteState({ maintainFocus = false } = {}) {
  refs.commandPalette.innerHTML = renderCommandPalette();
  syncCommandScrollLock();

  refs.commandInput = refs.commandPalette.querySelector('[data-role="command-search"]');
  if (!state.commandOpen || !refs.commandInput) {
    return;
  }

  refs.commandInput.value = state.commandQuery;

  if (!maintainFocus) {
    return;
  }

  focusCommandInput();
}

function syncCommandPaletteResults({ maintainFocus = false } = {}) {
  if (!state.commandOpen) {
    renderCommandPaletteState();
    return;
  }

  refs.commandInput = refs.commandPalette.querySelector('[data-role="command-search"]');
  const resultsNode = refs.commandPalette.querySelector('.command-results');
  if (!refs.commandInput || !resultsNode) {
    renderCommandPaletteState({ maintainFocus });
    return;
  }

  const { flatResults, markup } = buildCommandResultsMarkup();
  resultsNode.classList.toggle("is-empty", flatResults.length === 0);
  resultsNode.innerHTML = markup;
  refs.commandInput.value = state.commandQuery;

  if (!maintainFocus) {
    return;
  }

  focusCommandInput();
}
function focusCommandInput() {
  clearCommandFocusRetry();

  const deadline = performance.now() + 400;

  const applyFocus = () => {
    const input = refs.commandPalette.querySelector('[data-role="command-search"]');
    if (!state.commandOpen || !input) {
      clearCommandFocusRetry();
      return;
    }

    refs.commandInput = input;
    if (document.activeElement !== input) {
      input.focus({ preventScroll: true });
    }
    input.setSelectionRange(state.commandQuery.length, state.commandQuery.length);
    refs.commandPalette.querySelector('.command-item.is-active')?.scrollIntoView({ block: 'nearest' });

    if (document.activeElement === input || performance.now() >= deadline) {
      clearCommandFocusRetry();
      return;
    }

    commandFocusRetryId = window.setTimeout(applyFocus, 16);
  };

  requestAnimationFrame(applyFocus);
}

function clearCommandFocusRetry() {
  if (!commandFocusRetryId) {
    return;
  }

  window.clearTimeout(commandFocusRetryId);
  commandFocusRetryId = 0;
}
function renderSectionTabs() {
  const items = [
    { value: "nav", label: "导航" },
    { value: "blog-list", label: "博客" },
  ];

  return items
    .map(
      (item) => `
        <a
          class="section-tab ${isSectionActive(item.value) ? "is-active" : ""}"
          href="${escapeHTML(getSectionHref(item.value))}"
        >
          ${escapeHTML(item.label)}
        </a>
      `,
    )
    .join("");
}

function renderNavStats() {
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

function renderBlogStats() {
  const filteredPosts = getFilteredPosts();
  const totalPages = getTotalBlogPages(filteredPosts);
  const uniqueTags = new Set(posts.flatMap((post) => post.tags)).size;
  const latestDate = posts[0] ? formatShortDate(posts[0].publishedAt) : "--";

  return [
    createStatCard("文章", String(posts.length)),
    createStatCard("标签", String(uniqueTags)),
    createStatCard("分页", `${state.blogPage}/${totalPages}`),
    createStatCard("最新发布", latestDate),
  ].join("");
}

function renderThemePalette() {
  return getThemeShelfThemes()
    .map((theme) => `
      <button
        type="button"
        class="theme-thumb ${getShowcaseTheme()?.id === theme.id ? "is-active" : ""}"
        data-action="set-theme-showcase"
        data-value="${escapeHTML(theme.id)}"
        aria-pressed="${getShowcaseTheme()?.id === theme.id ? "true" : "false"}"
      >
        <span
          class="theme-thumb__preview"
          style="--theme-card-preview: ${escapeHTML(theme.preview)}; --theme-card-glow: ${escapeHTML(theme.previewGlow)};"
          aria-hidden="true"
        ></span>
        <span class="theme-thumb__body">
          <strong>${escapeHTML(theme.label)}</strong>
          <small>${escapeHTML(theme.badge)}</small>
        </span>
      </button>
    `)
    .join("");
}

function renderFeaturedThemeCard(theme) {
  return `
    <article class="theme-feature">
      <div
        class="theme-feature__preview"
        style="--theme-card-preview: ${escapeHTML(theme.preview)}; --theme-card-glow: ${escapeHTML(theme.previewGlow)};"
        aria-hidden="true"
      >
        <span class="theme-feature__badge">${escapeHTML(theme.badge)}</span>
        <span class="theme-feature__status">当前使用</span>
        <span class="theme-feature__sticker">${escapeHTML(theme.sticker)}</span>
        <span class="theme-feature__charm">${escapeHTML(theme.charm)}</span>
        <span class="theme-feature__spark theme-feature__spark--a"></span>
        <span class="theme-feature__spark theme-feature__spark--b"></span>
      </div>
      <div class="theme-feature__body">
        <div class="theme-feature__head">
          <div>
            <p class="theme-feature__eyebrow">精选主题</p>
            <h3>${escapeHTML(theme.label)}</h3>
          </div>
          <span class="theme-feature__mood">${escapeHTML(theme.mood)}</span>
        </div>
        <p class="theme-feature__summary">${escapeHTML(theme.summary)}</p>
        <div class="theme-feature__meta">
          <span>支持浅色 / 深色底</span>
          <span>即时切换</span>
          <span>首页头图联动</span>
        </div>
      </div>
    </article>
  `;
}

function renderThemeShowcase() {
  const theme = getShowcaseTheme();
  const shelfThemes = getThemeShelfThemes();

  if (!theme || shelfThemes.length === 0) {
    return "";
  }

  return `
    <section class="theme-showcase">
      <div class="theme-showcase__head">
        <div>
          <p class="theme-showcase__eyebrow">本周上新</p>
          <strong>${escapeHTML(theme.label)}</strong>
        </div>
        <div class="theme-showcase__controls">
          <button type="button" class="theme-nav" data-action="prev-theme-showcase" aria-label="查看上一个皮肤">‹</button>
          <span class="theme-showcase__count">${state.themeShowcaseIndex + 1} / ${shelfThemes.length}</span>
          <button type="button" class="theme-nav" data-action="next-theme-showcase" aria-label="查看下一个皮肤">›</button>
        </div>
      </div>
      <div class="theme-spotlight">
        <div
          class="theme-spotlight__preview"
          style="--theme-card-preview: ${escapeHTML(theme.preview)}; --theme-card-glow: ${escapeHTML(theme.previewGlow)};"
          aria-hidden="true"
        >
          <span class="theme-card__badge">${escapeHTML(theme.badge)}</span>
          <span class="theme-card__sticker">${escapeHTML(theme.sticker)}</span>
          <span class="theme-card__spark theme-card__spark--a"></span>
          <span class="theme-card__spark theme-card__spark--b"></span>
        </div>
        <div class="theme-spotlight__body">
          <div class="theme-spotlight__title">
            <div>
              <h4>${escapeHTML(theme.label)}</h4>
              <p>${escapeHTML(theme.mood)}</p>
            </div>
            <span class="theme-feature__mood">${escapeHTML(theme.charm)}</span>
          </div>
          <p class="theme-spotlight__summary">${escapeHTML(theme.summary)}</p>
          <div class="theme-spotlight__meta">
            <span>${escapeHTML(theme.sticker)}</span>
            <span>${escapeHTML(theme.charm)}</span>
            <span>主题头图联动</span>
          </div>
          <button type="button" class="theme-spotlight__apply" data-action="set-theme-preset" data-value="${escapeHTML(theme.id)}">
            立即换成 ${escapeHTML(theme.label)}
          </button>
        </div>
      </div>
      <div class="theme-palette">${renderThemePalette()}</div>
    </section>
  `;
}

function renderThemeShelf() {
  const preset = getThemePreset();
  const [swatchStart = "#98d5d2", swatchEnd = "#ddeff6"] = preset.swatch || [];
  const otherThemesCount = getThemeShelfThemes().length;

  return `
    <button
      type="button"
      class="theme-shelf__trigger"
      data-action="toggle-theme-shelf"
      aria-expanded="${state.themeShelfExpanded ? "true" : "false"}"
    >
      <div class="theme-shelf__title">
        <span>空间皮肤</span>
        <strong>首页换肤</strong>
      </div>
      <div class="theme-shelf__meta">
        <span class="theme-shelf__current">
          <span
            class="theme-shelf__swatch"
            style="--swatch-start: ${escapeHTML(swatchStart)}; --swatch-end: ${escapeHTML(swatchEnd)};"
            aria-hidden="true"
          ></span>
          ${escapeHTML(preset.label)}
        </span>
        <span class="theme-shelf__caret" aria-hidden="true"></span>
      </div>
    </button>
    <div class="theme-shelf__body" ${state.themeShelfExpanded ? "" : "hidden"}>
      <div class="theme-shelf__toolbar">
        <div class="theme-shelf__copy">
          <span class="theme-shelf__badge">主题库 ${themes.length} 套</span>
          <p class="theme-shelf__summary">当前启用 ${escapeHTML(preset.label)} · ${escapeHTML(preset.mood)}，点击卡片立即切换。</p>
        </div>
        <button class="theme-toggle" type="button" data-action="toggle-theme" data-role="theme-toggle"></button>
      </div>
      ${renderFeaturedThemeCard(preset)}
      ${otherThemesCount > 0 ? `
        <div class="theme-palette-shell">
          <div class="theme-palette__head">
            <strong>更多皮肤</strong>
            <span>${otherThemesCount} 套在橱窗轮播</span>
          </div>
          ${renderThemeShowcase()}
        </div>
      ` : ""}
    </div>
  `;
}

function renderHeroSearch() {
  const activeEngine = getActiveSearchEngine();

  return `
    <section class="hero-search-panel">
      <div class="hero-search-panel__field">
        <input
          type="search"
          data-role="engine-search"
          class="hero-search-panel__input"
          inputmode="search"
          autocomplete="off"
              spellcheck="false"
          placeholder="${escapeHTML(activeEngine.placeholder)}"
        >
        <button type="button" class="hero-search-panel__submit" data-action="submit-engine-search">搜索</button>
      </div>
      <div class="hero-search-panel__engines">
        ${searchEngines.map((engine) => `
          <button
            type="button"
            class="engine-chip ${state.searchEngine === engine.id ? "is-active" : ""}"
            data-action="set-search-engine"
            data-value="${escapeHTML(engine.id)}"
          >
            ${escapeHTML(engine.label)}
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function syncHeroSearchBox() {
  if (!refs.engineSearchInput) {
    return;
  }

  refs.engineSearchInput.value = state.engineQuery;
  refs.engineSearchInput.placeholder = getActiveSearchEngine().placeholder;
}

function renderToolbar() {
  if (state.section === "nav") {
    return renderNavToolbar();
  }

  if (state.section === "blog-list") {
    return renderBlogToolbar();
  }

  return renderBlogDetailToolbar();
}

function renderNavToolbar() {
  return `
    <div class="toolbar-shell">
      <div class="toolbar__heading toolbar__heading--compact">
        <span class="field-label">NAV TOOLKIT</span>
        <h2>导航工具台</h2>
      </div>

      <div class="toolbar__tools">
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

      </div>
    </div>

    <div class="filter-stack" data-role="nav-filters">
      <div class="filter-row">
        <span class="filter-label">视图</span>
        <div class="chip-group">${renderViewFilters()}</div>
      </div>

      <div class="filter-row">
        <span class="filter-label">分类</span>
        <div class="chip-group">${renderCategoryFilters()}</div>
      </div>

      <div class="filter-row">
        <span class="filter-label">标签</span>
        <div class="chip-group chip-group--dense">${renderTagFilters()}</div>
      </div>
    </div>

    <div class="toolbar__footer">
      <div class="active-state" data-role="nav-active-state">${renderActiveState()}</div>
    </div>
  `;
}
function renderNavFilterRows() {
  return `
    <div class="filter-row">
      <span class="filter-label">视图</span>
      <div class="chip-group">${renderViewFilters()}</div>
    </div>

    <div class="filter-row">
      <span class="filter-label">分类</span>
      <div class="chip-group">${renderCategoryFilters()}</div>
    </div>

    <div class="filter-row">
      <span class="filter-label">标签</span>
      <div class="chip-group chip-group--dense">${renderTagFilters()}</div>
    </div>
  `;
}

function renderNavSearchState() {
  if (state.section !== "nav") {
    render();
    return;
  }

  refs.summary.textContent = buildSummary();
  refs.stats.innerHTML = renderNavStats();
  refs.toolbar.querySelector('[data-role="nav-filters"]')?.replaceChildren();
  const navFilters = refs.toolbar.querySelector('[data-role="nav-filters"]');
  if (navFilters) {
    navFilters.innerHTML = renderNavFilterRows();
  }
  const activeState = refs.toolbar.querySelector('[data-role="nav-active-state"]');
  if (activeState) {
    activeState.innerHTML = renderActiveState();
  }
  refs.content.innerHTML = renderNavContent();
  syncRoute();
  updateSeo();
}

function renderBlogSearchState() {
  if (state.section !== "blog-list") {
    render();
    return;
  }

  state.blogPage = clampPage(state.blogPage);
  refs.summary.textContent = buildSummary();
  refs.stats.innerHTML = renderBlogStats();
  refs.toolbar.innerHTML = renderBlogToolbar();
  refs.content.innerHTML = renderBlogList();
  syncRoute();
  updateSeo();

  refs.blogSearchInput = refs.toolbar.querySelector('[data-role="blog-search"]');
  if (refs.blogSearchInput) {
    refs.blogSearchInput.value = state.blogQuery;
    requestAnimationFrame(() => {
      refs.blogSearchInput.focus();
      refs.blogSearchInput.setSelectionRange(state.blogQuery.length, state.blogQuery.length);
    });
  }
}

function renderBlogToolbar() {
  const filteredPosts = getFilteredPosts();

  return `
    <div class="toolbar--blog">
      <div class="toolbar-shell">
        <div class="toolbar__heading">
          <span class="field-label">BLOG</span>
          <h2>博客搜索与分页</h2>
        </div>
        <div class="toolbar__tools">
          <label class="search-field search-field--blog">
            <span class="field-label">搜索文章</span>
            <input
              data-role="blog-search"
              type="search"
              inputmode="search"
              autocomplete="off"
              spellcheck="false"
              placeholder="搜标题、摘要、正文、标签，例如 Cloudflare / GitHub Pages / 工作流"
            >
          </label>
        </div>
      </div>
      <div class="filter-row">
        <span class="filter-label">博客标签</span>
        <div class="chip-group chip-group--dense">${renderBlogTagFilters()}</div>
      </div>
      <div class="toolbar__footer">
        <div class="active-state">
          ${renderBlogActiveState(filteredPosts.length)}
        </div>
      </div>
    </div>
  `;
}

function renderBlogDetailToolbar() {
  const post = getSelectedPost();

  if (!post) {
    return renderBlogToolbar();
  }

  const pageSource = getPostPageSource(post.id);
  const currentPage = getBlogPageForPost(post.id, pageSource);
  const sourceLabel = pageSource === posts ? "总列表视图" : "当前筛选视图";

  return `
    <div class="toolbar--detail">
      <div class="toolbar__heading">
        <span class="field-label">BLOG POST</span>
        <h2>${escapeHTML(post.title)}</h2>
        <p>${escapeHTML(post.summary)}</p>
      </div>
      <div class="active-state">
        <span class="state-pill">${formatDate(post.publishedAt)}</span>
        <span class="state-pill">${formatPostReadingTime(post)}</span>
        <span class="state-pill">第 ${currentPage} / ${getTotalBlogPages(pageSource)} 页</span>
        <span class="state-pill">${sourceLabel}</span>
        <button type="button" class="inline-reset" data-action="open-command">全站搜 Ctrl + K</button>
      </div>
    </div>
  `;
}
function renderContent() {
  if (state.section === "nav") {
    return renderNavContent();
  }

  if (state.section === "blog-list") {
    return renderBlogList();
  }

  return renderBlogDetail();
}

function renderWorkbench() {
  const pendingCount = state.workbenchTodos.filter((item) => !item.done).length;
  const doneCount = state.workbenchTodos.length - pendingCount;
  const favoriteCount = sites.filter((site) => state.favorites.has(site.id)).length;
  const recentCount = state.recent.filter((id) => siteIds.has(id)).length;

  return `
    <section class="workbench">
      <article class="panel workbench-card workbench-card--time">
        <p class="section-head__eyebrow">WORKBENCH</p>
        <div class="workbench-time" data-role="workbench-time">--:--</div>
        <div class="workbench-date" data-role="workbench-date">--</div>
        <div class="workbench-metrics">
          <span class="state-pill">待办 ${pendingCount}</span>
          <span class="state-pill">已完成 ${doneCount}</span>
          <span class="state-pill">收藏 ${favoriteCount}</span>
          <span class="state-pill">最近访问 ${recentCount}</span>
        </div>
      </article>

      <article class="panel workbench-card workbench-card--todo">
        <div class="workbench-card__head">
          <div>
            <p class="section-head__eyebrow">TODAY</p>
            <h2>待办清单</h2>
          </div>
          <span class="section-count">${pendingCount}</span>
        </div>
        <div class="workbench-todo-form">
          <input
            type="text"
            data-role="workbench-todo-input"
            class="workbench-input"
            placeholder="写下当前最重要的一件事"
            value="${escapeHTML(state.workbenchTodoDraft)}"
          >
          <button type="button" class="workbench-button" data-action="add-workbench-todo">添加</button>
        </div>
        <div class="workbench-todo-list">
          ${renderWorkbenchTodoItems()}
        </div>
        <div class="workbench-card__foot">
          <span class="workbench-helper">回车也可以直接添加待办。</span>
          ${doneCount > 0 ? '<button type="button" class="inline-reset" data-action="clear-workbench-done">清理已完成</button>' : ''}
        </div>
      </article>

      <article class="panel workbench-card workbench-card--note">
        <div class="workbench-card__head">
          <div>
            <p class="section-head__eyebrow">SCRATCHPAD</p>
            <h2>快速便签</h2>
          </div>
          <span class="section-count">${state.workbenchNote.trim().length}</span>
        </div>
        <textarea
          class="workbench-note"
          data-role="workbench-note"
          placeholder="记灵感、记临时命令、记今天要查的内容..."
        >${escapeHTML(state.workbenchNote)}</textarea>
        <div class="workbench-card__foot">
          <span class="workbench-helper">只保存在当前浏览器，不会写入项目文件。</span>
        </div>
      </article>
    </section>
  `;
}
function renderOverviewDeck(visibleSites) {
  void visibleSites;
  return renderOverviewSection({
    favorites: state.favorites,
    recent: state.recent,
    posts,
    siteMap,
    escapeHTML,
    formatShortDate,
    getPostHref,
    collapsed: state.overviewCollapsed,
  });
}
function renderSectionRail(groups) {
  const pendingCount = state.workbenchTodos.filter((item) => !item.done).length;

  return `
    <section class="panel section-rail">
      <div class="section-rail__head">
        <div>
          <p class="section-head__eyebrow">CATEGORIES</p>
          <h2>网站分类</h2>
        </div>
      </div>
      <div class="section-rail__chips">
        ${groups
          .map(
            (group) => `
              <button
                type="button"
                class="section-jump"
                data-action="jump-category"
                data-value="${escapeHTML(group.title)}"
              >
                <strong>${escapeHTML(group.title)}</strong>
                <small>${group.sites.length} 个</small>
              </button>
            `,
          )
          .join("")}
        <button type="button" class="section-jump section-jump--secondary" data-action="jump-workbench">
          <strong>工作台</strong>
          <small>${pendingCount > 0 ? `${pendingCount} 件待办` : "个人层"}</small>
        </button>
      </div>
    </section>
  `;
}

function renderWorkbenchSection() {
  const pendingCount = state.workbenchTodos.filter((item) => !item.done).length;

  return `
    <section class="panel personal-layer" data-section-anchor="workbench">
      <div class="section-head personal-layer__head">
        <div>
          <p class="section-head__eyebrow">PERSONAL LAYER</p>
          <h2>个人工作台</h2>
        </div>
        <span class="section-count">${pendingCount}</span>
      </div>
      ${renderWorkbench()}
    </section>
  `;
}

function renderNavContent() {
  const visibleSites = getVisibleSites();
  const groups = getGroupedSites(visibleSites);
  const overview = renderOverviewDeck(visibleSites);
  const sectionRail = groups.length > 1 ? renderSectionRail(groups) : "";
  const workbench = renderWorkbenchSection();

  if (visibleSites.length === 0) {
    return `${overview}
      <section class="panel empty-state">
        <h2>没有匹配结果</h2>
        <p>${escapeHTML(getEmptyMessage())}</p>
        <button type="button" class="empty-state__button" data-action="reset-filters">恢复全部站点</button>
      </section>
      ${workbench}
    `;
  }

  const groupsMarkup = groups
    .map(
      (group) => `
        <section class="panel category-block" data-category-anchor="${escapeHTML(group.title)}">
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

  return `${overview}${sectionRail}${groupsMarkup}${workbench}`;
}
function renderBlogList() {
  if (posts.length === 0) {
    return `
      <section class="panel empty-state">
        <h2>博客还没有内容</h2>
      </section>
    `;
  }

  const filteredPosts = getFilteredPosts();
  if (filteredPosts.length === 0) {
    return `
      <section class="panel empty-state">
        <h2>没有匹配文章</h2>
        <button type="button" class="empty-state__button" data-action="reset-blog-filters">恢复全部文章</button>
      </section>
    `;
  }

  const currentPosts = getCurrentPosts(filteredPosts);
  return `
    <section class="blog-list">
      <div class="blog-grid">
        ${currentPosts.map((post) => renderBlogCard(post)).join("")}
      </div>
      ${renderPagination(filteredPosts)}
    </section>
  `;
}

function renderBlogCard(post) {
  return `
    <article class="panel blog-card">
      <div class="blog-card__meta">
        <span class="blog-card__date">${formatDate(post.publishedAt)}</span>
      </div>
      <div class="blog-card__body">
        <h3>${escapeHTML(post.title)}</h3>
        <p>${escapeHTML(post.summary)}</p>
        <div class="tag-list">
          ${post.tags.map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}
        </div>
      </div>
      <div class="blog-card__actions">
        <a class="site-card__link blog-card__button" href="${escapeHTML(getPostHref(post.id))}" data-route-kind="post" data-post-id="${escapeHTML(post.id)}">
          阅读全文
        </a>
      </div>
    </article>
  `;
}

function renderPagination(sourcePosts = getFilteredPosts()) {
  const totalPages = getTotalBlogPages(sourcePosts);

  if (totalPages <= 1) {
    return "";
  }

  const pageButtons = Array.from({ length: totalPages }, (_, index) => index + 1)
    .map(
      (page) => `
        <button
          type="button"
          class="page-button ${page === state.blogPage ? "is-active" : ""}"
          data-action="set-blog-page"
          data-value="${page}"
        >
          ${page}
        </button>
      `,
    )
    .join("");

  return `
    <div class="panel pagination">
      <div class="pagination__summary">
        <strong>分页</strong>
        <span>当前第 ${state.blogPage} 页，共 ${totalPages} 页，命中 ${sourcePosts.length} 篇</span>
      </div>
      <div class="pagination__controls">
        <button
          type="button"
          class="page-button"
          data-action="set-blog-page"
          data-value="${state.blogPage - 1}"
          ${state.blogPage === 1 ? "disabled" : ""}
        >
          上一页
        </button>
        <div class="pagination__numbers">${pageButtons}</div>
        <button
          type="button"
          class="page-button"
          data-action="set-blog-page"
          data-value="${state.blogPage + 1}"
          ${state.blogPage === totalPages ? "disabled" : ""}
        >
          下一页
        </button>
      </div>
    </div>
  `;
}

function renderBlogDetail() {
  const post = getSelectedPost();

  if (!post) {
    return `
      <section class="panel empty-state">
        <h2>文章不存在</h2>
        <a class="empty-state__button" href="${escapeHTML(getHomeHref())}" data-route-kind="home">返回主页</a>
        <a class="empty-state__button" href="${escapeHTML(getBlogListHref())}" data-route-kind="blog-list">返回博客列表</a>
      </section>
    `;
  }

  const pageSource = getPostPageSource(post.id);
  const sourceLabel = pageSource === posts ? "来自博客总列表" : "来自当前筛选列表";
  const { previousPost, nextPost } = getAdjacentPosts(post.id, pageSource);
  const relatedPosts = getRelatedPosts(post.id);
  const hasArticleNav = Boolean(previousPost || nextPost);
  const hasArticleFooter = hasArticleNav || relatedPosts.length > 0;

  return `
    <article class="panel article">
      <div class="article__header">
        <div class="article-back-group">
          <a class="article-back" href="${escapeHTML(getHomeHref())}" data-route-kind="home">返回主页</a>
          <a class="article-back" href="${escapeHTML(getBlogListHref())}" data-route-kind="blog-list">返回博客列表</a>
        </div>
        <p class="section-head__eyebrow">BLOG POST</p>
        <h2>${escapeHTML(post.title)}</h2>
        <div class="article__meta">
          <span>${formatDate(post.publishedAt)}</span>
          <span>${formatPostReadingTime(post)}</span>
          <span>${post.blockCount} 个内容块</span>
          <span>${sourceLabel}</span>
        </div>
        <div class="tag-list">
          ${post.tags.map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}
        </div>
      </div>
      <div class="article__main">
        <div class="article__body">
          ${renderPostBody(post)}
        </div>
      </div>
      ${
        hasArticleFooter
          ? `
            <div class="article__footer">
              ${
                hasArticleNav
                  ? `
                    <div class="article__nav">
                      ${
                        previousPost
                          ? `
                            <a class="article__nav-link" href="${escapeHTML(getPostHref(previousPost.id))}" data-route-kind="post" data-post-id="${escapeHTML(previousPost.id)}">
                              <span class="article__nav-label">上一篇</span>
                              <strong class="article__nav-title">${escapeHTML(previousPost.title)}</strong>
                            </a>
                          `
                          : '<div class="article__nav-placeholder" aria-hidden="true"></div>'
                      }
                      ${
                        nextPost
                          ? `
                            <a class="article__nav-link article__nav-link--next" href="${escapeHTML(getPostHref(nextPost.id))}" data-route-kind="post" data-post-id="${escapeHTML(nextPost.id)}">
                              <span class="article__nav-label">下一篇</span>
                              <strong class="article__nav-title">${escapeHTML(nextPost.title)}</strong>
                            </a>
                          `
                          : '<div class="article__nav-placeholder" aria-hidden="true"></div>'
                      }
                    </div>
                  `
                  : ""
              }
              ${
                relatedPosts.length > 0
                  ? `
                    <section class="article__related" aria-label="相关文章">
                      <div class="article__related-head">
                        <strong>相关文章</strong>
                        <span>按标签相关度推荐</span>
                      </div>
                      <div class="article__related-list">
                        ${relatedPosts
                          .map(
                            (relatedPost) => `
                              <a
                                class="article__related-card"
                                href="${escapeHTML(getPostHref(relatedPost.id))}"
                                data-route-kind="post"
                                data-post-id="${escapeHTML(relatedPost.id)}"
                              >
                                <span class="article__related-date">${formatDate(relatedPost.publishedAt)}</span>
                                <strong class="article__related-title">${escapeHTML(relatedPost.title)}</strong>
                                <span class="article__related-summary">${escapeHTML(relatedPost.summary)}</span>
                              </a>
                            `,
                          )
                          .join("")}
                      </div>
                    </section>
                  `
                  : ""
              }
            </div>
          `
          : ""
      }
    </article>
  `;
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

function renderCommandPalette() {
  if (!state.commandOpen) {
    return "";
  }

  const { flatResults, markup } = buildCommandResultsMarkup();

  return `
    <div class="command-overlay">
      <button type="button" class="command-overlay__backdrop" data-action="close-command" aria-label="关闭全站搜索"></button>
      <div class="panel command-palette" role="dialog" aria-modal="true" aria-label="全站搜索">
        <div class="command-palette__head">
          <div class="command-search-wrap">
            <span class="command-search__icon">⌘</span>
            <input
              type="search"
              data-role="command-search"
              class="command-search"
              autocomplete="off"
              spellcheck="false"
              autofocus
              placeholder="搜网站、文章、标签、分类，例如 GPT / Cloudflare / 博客"
            >
          </div>
          <button type="button" class="command-close" data-action="close-command">关闭</button>
        </div>
        <div class="command-palette__meta">
          <span>网站和博客统一入口</span>
          <span class="command-palette__meta-highlight">再按 Ctrl + K 把焦点移到输入框</span>
          <span>↑ ↓ 选择</span>
          <span>Enter 打开</span>
          <span>Esc 关闭</span>
        </div>
        <div class="command-results ${flatResults.length === 0 ? "is-empty" : ""}">
          ${markup}
        </div>
      </div>
    </div>
  `;
}

function buildCommandResultsMarkup() {
  const sections = getCommandSections();
  const flatResults = sections.flatMap((section) => section.items);
  state.commandIndex = flatResults.length === 0 ? 0 : Math.min(state.commandIndex, flatResults.length - 1);

  if (flatResults.length === 0) {
    return {
      flatResults,
      markup: renderCommandEmptyState(),
    };
  }

  let offset = 0;
  const markup = sections
    .map((section) => {
      const sectionMarkup = renderCommandSection(section, offset);
      offset += section.items.length;
      return sectionMarkup;
    })
    .join("");

  return { flatResults, markup };
}
function renderCommandSection(section, startIndex) {
  return `
    <section class="command-group">
      <div class="command-group__head">
        <span>${escapeHTML(section.title)}</span>
        <small>${section.items.length}</small>
      </div>
      <div class="command-group__list">
        ${section.items.map((item, index) => renderCommandItem(item, startIndex + index)).join("")}
      </div>
    </section>
  `;
}

function renderCommandItem(item, absoluteIndex) {
  const isActive = state.commandIndex === absoluteIndex;
  const badgeClass = item.kind === "site" ? "is-site" : item.kind === "post" ? "is-post" : "is-action";

  if (item.kind === "site") {
    const site = siteMap.get(item.id);
    if (!site) {
      return "";
    }

    return `
      <a
        class="command-item ${isActive ? "is-active" : ""}"
        href="${escapeHTML(site.url)}"
        target="_blank"
        rel="noreferrer noopener"
        data-site-id="${escapeHTML(site.id)}"
      >
        <span class="command-item__badge ${badgeClass}">${escapeHTML(item.badge)}</span>
        <div class="command-item__body">
          <strong>${escapeHTML(item.title)}</strong>
          <span>${escapeHTML(item.subtitle)}</span>
        </div>
        <span class="command-item__meta">${escapeHTML(item.meta)}</span>
      </a>
    `;
  }

  return `
    <button
      type="button"
      class="command-item ${isActive ? "is-active" : ""}"
      data-action="run-command"
      data-command-kind="${escapeHTML(item.kind)}"
      data-command-id="${escapeHTML(item.id)}"
    >
      <span class="command-item__badge ${badgeClass}">${escapeHTML(item.badge)}</span>
      <div class="command-item__body">
        <strong>${escapeHTML(item.title)}</strong>
        <span>${escapeHTML(item.subtitle)}</span>
      </div>
      <span class="command-item__meta">${escapeHTML(item.meta)}</span>
    </button>
  `;
}

function renderCommandEmptyState() {
  const query = state.commandQuery.trim();

  if (!query) {
    return `
      <div class="command-empty">
        <strong>输入关键词开始搜索。</strong>
      </div>
    `;
  }

  return `
    <div class="command-empty">
      <strong>没有找到“${escapeHTML(query)}”</strong>
      <span>试试站点名、博客标题、标签、分类或别名。</span>
    </div>
  `;
}

function renderIcon(site) {
  const initials = getInitials(site.name);
  const hue = getHue(site.id);
  const src = site.icon ? resolveAsset(site.icon) : getSiteFaviconUrl(site.url);

  if (src) {
    return `
      <div class="site-icon">
        <img
          src="${escapeHTML(src)}"
          alt="${escapeHTML(site.name)}"
          loading="lazy"
          onerror="handleIconError(this)"
        >
        <span class="site-icon__fallback" hidden style="--icon-hue: ${hue};">${escapeHTML(initials)}</span>
      </div>
    `;
  }

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
    return "";
  }

  return `
    ${parts.join("")}
    <button type="button" class="inline-reset" data-action="reset-filters">清空筛选</button>
  `;
}

function renderBlogTagFilters() {
  const entries = getBlogTagCounts();
  const items = [{ value: "all", label: "全部标签", count: getFilteredPosts({ ignoreTag: true }).length }];

  for (const entry of entries) {
    items.push({
      value: entry.tag,
      label: entry.tag,
      count: entry.count,
    });
  }

  return items
    .filter((item) => item.value === "all" || item.count > 0 || item.value === state.blogTag)
    .map((item) => renderChip("set-blog-tag", item.value, item.label, item.count, state.blogTag === item.value))
    .join("");
}

function renderBlogActiveState(count) {
  const parts = [
    `<span class="state-pill">共 ${posts.length} 篇文章</span>`,
    `<span class="state-pill">命中 ${count} 篇</span>`,
    `<span class="state-pill">第 ${state.blogPage} / ${getTotalBlogPages(getFilteredPosts())} 页</span>`,
  ];

  if (state.blogTag !== "all") {
    parts.push(`<span class="state-pill">标签: ${escapeHTML(state.blogTag)}</span>`);
  }
  if (state.blogQuery) {
    parts.push(`<span class="state-pill">搜索: ${escapeHTML(state.blogQuery)}</span>`);
  }

  if (!state.blogQuery && state.blogTag === "all") {
    return parts.join("");
  }

  return `
    ${parts.join("")}
    <button type="button" class="inline-reset" data-action="reset-blog-filters">清空博客筛选</button>
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

    if (!matchesSiteQuery(site, state.query)) {
      return false;
    }

    return true;
  });
}

function getFilteredPosts(options = {}) {
  return posts.filter((post) => {
    if (!options.ignoreTag && state.blogTag !== "all" && !post.tags.includes(state.blogTag)) {
      return false;
    }

    if (!matchesPostQuery(post, state.blogQuery)) {
      return false;
    }

    return true;
  });
}

function getPostPageSource(postId) {
  const filteredPosts = getFilteredPosts();
  return filteredPosts.some((post) => post.id === postId) ? filteredPosts : posts;
}

function getThemePresetId(value) {
  return themeMap.has(value) ? value : themes[0]?.id || "mist";
}

function getThemePreset() {
  return themeMap.get(getThemePresetId(state.themePreset)) || themes[0];
}

function getThemeShelfThemes() {
  return themes.filter((theme) => theme.id !== state.themePreset);
}

function getShowcaseTheme() {
  const shelfThemes = getThemeShelfThemes();

  if (shelfThemes.length === 0) {
    return null;
  }

  const index = ((state.themeShowcaseIndex % shelfThemes.length) + shelfThemes.length) % shelfThemes.length;
  return shelfThemes[index];
}

function renderPostBody(post) {
  if (post.contentHtml) {
    return post.contentHtml;
  }

  return normalizePostMarkdown(post.content)
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`)
    .join("");
}

function renderPostToc(post) {
  if (!Array.isArray(post.toc) || post.toc.length === 0) {
    return "";
  }

  return `
    <nav class="article__side-card article__toc" aria-label="文章目录">
      <div class="article__side-head article__toc-head">
        <strong>目录</strong>
        <span>${post.toc.length} 个小节</span>
      </div>
      <div class="article__toc-list">
        ${post.toc
          .map(
            (item) => `
              <button
                type="button"
                class="article__toc-link article__toc-link--depth-${item.depth} ${state.activeHeadingId === item.id ? "is-active" : ""}"
                data-action="jump-heading"
                data-value="${escapeHTML(item.id)}"
              >
                ${escapeHTML(item.text)}
              </button>
            `,
          )
          .join("")}
      </div>
    </nav>
  `;
}

async function copyCurrentPostLink() {
  const post = getSelectedPost();
  if (!post) {
    return;
  }

  const url = new URL(getPostHref(post.id), window.location.origin).toString();
  await navigator.clipboard.writeText(url);
  setTransientStatus("文章链接已复制。");
}

function setTransientStatus(text) {
  const statusNode = root.querySelector('[data-role="summary"]');
  if (!statusNode) {
    return;
  }

  const original = statusNode.textContent;
  statusNode.textContent = text;
  window.setTimeout(() => {
    if (statusNode.textContent === text) {
      statusNode.textContent = original;
    }
  }, 1800);
}

function handleScroll() {
  if (state.section !== "blog-detail") {
    return;
  }

  syncActiveHeading();
  syncActiveTocLink();
}

function syncActiveHeading() {
  const post = getSelectedPost();
  if (!post || !Array.isArray(post.toc) || post.toc.length === 0) {
    state.activeHeadingId = "";
    return;
  }

  const headings = post.toc
    .map((item) => ({
      id: item.id,
      element: document.getElementById(item.id),
    }))
    .filter((item) => item.element);

  if (headings.length === 0) {
    state.activeHeadingId = "";
    return;
  }

  const triggerTop = 156;
  let activeId = headings[0].id;

  for (const heading of headings) {
    const top = heading.element.getBoundingClientRect().top;
    if (top <= triggerTop) {
      activeId = heading.id;
      continue;
    }
    break;
  }

  state.activeHeadingId = activeId;
}

function syncActiveTocLink() {
  const links = refs.content?.querySelectorAll(".article__toc-link");
  if (!links || links.length === 0) {
    return;
  }

  let activeLink = null;
  links.forEach((link) => {
    const isActive = link.dataset.value === state.activeHeadingId;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      activeLink = link;
    }
  });

  activeLink?.scrollIntoView({ block: "nearest" });
}

function getMarkdownBlockCount(content) {
  return normalizePostMarkdown(content)
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .length;
}

function normalizePostMarkdown(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
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

function getBlogTagCounts() {
  const scopedPosts = getFilteredPosts({ ignoreTag: true });
  const counts = new Map();

  for (const post of scopedPosts) {
    for (const tag of post.tags) {
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

function getCommandPaletteDeps() {
  return {
    state,
    sites,
    posts,
    siteMap,
    getSiteSearchScore,
    getPostSearchScore,
    commandResultLimit: COMMAND_RESULT_LIMIT,
    getHost,
    formatShortDate,
  };
}

function getCommandSections() {
  return getCommandSectionsState(getCommandPaletteDeps());
}

function getFlatCommandResults() {
  return getFlatCommandResultsState(getCommandPaletteDeps());
}

function runCommandResult(result) {
  executeCommandResult(result, {
    ...getCommandPaletteDeps(),
    trackRecent,
    closeCommandPalette,
    render,
    getPostHref,
    resetNavFilters,
  });
}

function openCommandPalette() {
  openCommandPaletteState(state);
}

function closeCommandPalette() {
  clearCommandFocusRetry();
  closeCommandPaletteState(state);
}

function openPost(postId) {
  if (!postMap.has(postId)) {
    return;
  }

  const pageSource = getPostPageSource(postId);
  state.selectedPostId = postId;
  state.blogPage = getBlogPageForPost(postId, pageSource);
  state.section = "blog-detail";
  state.nextRouteMode = "push";
  state.pendingScrollTop = true;
}

function getBlogPageForPost(postId, sourcePosts = posts) {
  const postIndex = sourcePosts.findIndex((post) => post.id === postId);
  if (postIndex < 0) {
    return 1;
  }

  return Math.floor(postIndex / state.postsPerPage) + 1;
}

function getHost(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function buildSummary() {
  if (state.section === "blog-list") {
    return "";
  }

  if (state.section === "blog-detail") {
    const post = getSelectedPost();
    return post ? post.summary : "当前文章不存在，你可以返回博客列表重新选择。";
  }

  return "";
}

function getEmptyMessage() {
  if (state.view === "favorites") {
    return "收藏列表为空。";
  }

  if (state.view === "recent") {
    return "最近访问暂无记录。";
  }

  return "没有匹配站点。";
}

function getTotalBlogPages(sourcePosts = getFilteredPosts()) {
  return Math.max(1, Math.ceil(sourcePosts.length / state.postsPerPage));
}

function clampPage(value, totalPages = getTotalBlogPages()) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(Math.max(1, value), totalPages);
}

function getCurrentPosts(sourcePosts = getFilteredPosts()) {
  const start = (state.blogPage - 1) * state.postsPerPage;
  return sourcePosts.slice(start, start + state.postsPerPage);
}

function getSelectedPost() {
  return postMap.get(state.selectedPostId) || posts[0] || null;
}

function isSectionActive(value) {
  if (value === "blog-list") {
    return state.section === "blog-list" || state.section === "blog-detail";
  }

  return state.section === value;
}

function resetNavFilters() {
  state.query = "";
  state.category = "all";
  state.tag = "all";
  state.view = "all";
}

function resetBlogFilters() {
  state.blogQuery = "";
  state.blogTag = "all";
  state.blogPage = 1;
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

  state.recent = [siteId, ...state.recent.filter((id) => id !== siteId)].slice(0, RECENT_HISTORY_LIMIT);
  localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(state.recent));
}

function getSearchEngineId(value) {
  return searchEngines.some((engine) => engine.id === value) ? value : defaultSearchEngine;
}

function normalizeSearchEnginePriority(value) {
  const priority = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isInteger(priority) || priority < 1 || priority > 99) {
    return null;
  }

  return priority;
}

function getActiveSearchEngine() {
  return searchEngines.find((engine) => engine.id === state.searchEngine) || searchEngines[0];
}

function submitEngineSearch() {
  const query = state.engineQuery.trim();
  if (!query) {
    refs.engineSearchInput?.focus();
    return;
  }

  const engine = getActiveSearchEngine();
  window.open(engine.buildUrl(query), "_blank", "noopener,noreferrer");
}

function renderWorkbenchTodoItems() {
  if (state.workbenchTodos.length === 0) {
    return '<div class="workbench-empty">还没有待办。</div>';
  }

  return state.workbenchTodos
    .map(
      (item) => `
        <div class="todo-item ${item.done ? "is-done" : ""}">
          <button
            type="button"
            class="todo-toggle ${item.done ? "is-done" : ""}"
            data-action="toggle-workbench-todo"
            data-value="${escapeHTML(item.id)}"
            aria-label="${item.done ? "标记为未完成" : "标记为已完成"}"
          >
            ${item.done ? "✓" : ""}
          </button>
          <div class="todo-copy">
            <strong>${escapeHTML(item.text)}</strong>
          </div>
          <button
            type="button"
            class="todo-remove"
            data-action="remove-workbench-todo"
            data-value="${escapeHTML(item.id)}"
            aria-label="删除待办"
          >
            删除
          </button>
        </div>
      `,
    )
    .join("");
}
function addWorkbenchTodo() {
  const text = state.workbenchTodoDraft.trim();
  if (!text) {
    return false;
  }

  state.workbenchTodos = [
    { id: `todo-${Date.now()}`, text, done: false },
    ...state.workbenchTodos,
  ].slice(0, 12);
  state.workbenchTodoDraft = "";
  saveWorkbenchTodos();
  return true;
}

function toggleWorkbenchTodo(todoId) {
  state.workbenchTodos = state.workbenchTodos.map((item) => (
    item.id === todoId ? { ...item, done: !item.done } : item
  ));
  saveWorkbenchTodos();
}

function removeWorkbenchTodo(todoId) {
  state.workbenchTodos = state.workbenchTodos.filter((item) => item.id !== todoId);
  saveWorkbenchTodos();
}

function clearCompletedWorkbenchTodos() {
  state.workbenchTodos = state.workbenchTodos.filter((item) => !item.done);
  saveWorkbenchTodos();
}

function saveWorkbenchTodos() {
  localStorage.setItem(STORAGE_KEYS.workbenchTodos, JSON.stringify(state.workbenchTodos));
}

function focusWorkbenchTodoInput() {
  requestAnimationFrame(() => {
    refs.workbenchTodoInput?.focus();
  });
}

function startWorkbenchClock() {
  window.setInterval(() => {
    state.now = Date.now();
    syncWorkbenchClock();
  }, 1000);
}

function syncWorkbenchClock() {
  const timeNode = refs.content?.querySelector('[data-role="workbench-time"]');
  const dateNode = refs.content?.querySelector('[data-role="workbench-date"]');
  if (!timeNode || !dateNode) {
    return;
  }

  const now = new Date(state.now);
  timeNode.textContent = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  dateNode.textContent = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);
}

function syncTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  applyThemePreset();
}

function syncThemePreset(themePreset) {
  state.themePreset = getThemePresetId(themePreset);
  state.themeShowcaseIndex = 0;
  localStorage.setItem(STORAGE_KEYS.themePreset, state.themePreset);
  applyThemePreset();
}

function syncThemeShelfExpanded(expanded) {
  state.themeShelfExpanded = Boolean(expanded);
}

function syncThemeShowcase(themeId) {
  const shelfThemes = getThemeShelfThemes();
  const index = shelfThemes.findIndex((theme) => theme.id === themeId);
  state.themeShowcaseIndex = index >= 0 ? index : 0;
}

function shiftThemeShowcase(offset) {
  const shelfThemes = getThemeShelfThemes();

  if (shelfThemes.length === 0) {
    state.themeShowcaseIndex = 0;
    return;
  }

  state.themeShowcaseIndex = (state.themeShowcaseIndex + offset + shelfThemes.length) % shelfThemes.length;
}

function applyThemePreset() {
  const preset = getThemePreset();
  const vars = preset?.vars?.[state.theme] || preset?.vars?.dark || {};
  document.documentElement.dataset.themePreset = preset.id;

  for (const [name, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(name, value);
  }
}

function handlePopState() {
  const previousSection = state.section;
  const previousPostId = state.selectedPostId;
  const previousBlogPage = state.blogPage;
  hydrateFromLocation();
  render();

  const changedToPost = state.section === "blog-detail" && (previousSection !== "blog-detail" || previousPostId !== state.selectedPostId);
  const changedBlogListPosition = state.section === "blog-list" && (previousSection !== "blog-list" || previousBlogPage !== state.blogPage);

  if (changedToPost || changedBlogListPosition) {
    state.pendingScrollTop = true;
  }
}

function hydrateFromLocation() {
  const url = new URL(window.location.href);
  const allBlogTags = new Set(posts.flatMap((post) => post.tags));
  const route = parseLocationRoute(url);

  state.blogQuery = route.blogSearch || "";
  state.blogTag = allBlogTags.has(route.blogTag || "") ? route.blogTag : "all";
  state.blogPage = clampPage(Number(route.page || 1), getTotalBlogPages(getFilteredPosts()));

  if (route.type === "post" && route.postId && postMap.has(route.postId)) {
    state.selectedPostId = route.postId;
    state.blogPage = getBlogPageForPost(route.postId, getPostPageSource(route.postId));
    state.section = "blog-detail";
    return;
  }

  state.section = route.type === "blog-list" ? "blog-list" : "nav";
}

function syncRoute(mode = "replace") {
  const nextPath = buildRoutePath();
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextPath !== currentPath) {
    const nextUrl = new URL(nextPath, window.location.href).toString();

    if (mode === "push") {
      try {
        window.history.pushState(null, "", nextUrl);
      } catch {
        window.location.assign(nextUrl);
        return;
      }

      if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextPath) {
        window.location.assign(nextUrl);
      }
      return;
    }

    try {
      window.history.replaceState(null, "", nextUrl);
    } catch {
      window.location.replace(nextUrl);
      return;
    }

    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextPath) {
      window.location.replace(nextUrl);
    }
  }
}

function buildRoutePath() {
  if (state.section === "blog-detail") {
    const post = getSelectedPost();
    if (post) {
      return buildQueryRoute("post", {
        postId: post.id,
      });
    }
    return `${window.location.pathname || "/"}`;
  }

  if (state.section === "blog-list") {
    return buildQueryRoute("blog-list", {
      blogSearch: state.blogQuery.trim(),
      blogTag: state.blogTag !== "all" ? state.blogTag : "",
      page: state.blogPage > 1 ? String(state.blogPage) : "",
    });
  }

  return `${window.location.pathname || "/"}`;
}

function buildQueryRoute(type, { postId = "", blogSearch = "", blogTag = "", page = "" } = {}) {
  const pathname = window.location.pathname || "/";
  const params = new URLSearchParams();

  if (type === "post" && postId) {
    params.set("post", postId);
  }

  if (type === "blog-list") {
    params.set("section", "blog");
  }

  if (blogSearch) {
    params.set("blogSearch", blogSearch);
  }

  if (blogTag) {
    params.set("blogTag", blogTag);
  }

  if (page) {
    params.set("page", page);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function buildHashRoute(type, { postId = "", blogSearch = "", blogTag = "", page = "" } = {}) {
  const params = new URLSearchParams();

  if (blogSearch) {
    params.set("blogSearch", blogSearch);
  }

  if (blogTag) {
    params.set("blogTag", blogTag);
  }

  if (page) {
    params.set("page", page);
  }

  const pathname = window.location.pathname || "/";
  const query = params.toString();

  if (type === "post" && postId) {
    return query ? `${pathname}#/post/${encodeURIComponent(postId)}?${query}` : `${pathname}#/post/${encodeURIComponent(postId)}`;
  }

  if (type === "blog-list") {
    return query ? `${pathname}#/blog?${query}` : `${pathname}#/blog`;
  }

  return pathname;
}

function getSectionHref(section) {
  return section === "blog-list" ? getBlogListHref() : getHomeHref();
}

function getHomeHref() {
  return `${window.location.pathname || "/"}`;
}

function getBlogListHref() {
  return buildQueryRoute("blog-list", {
    blogSearch: state.blogQuery.trim(),
    blogTag: state.blogTag !== "all" ? state.blogTag : "",
    page: state.blogPage > 1 ? String(state.blogPage) : "",
  });
}

function getPostHref(postId) {
  return buildQueryRoute("post", { postId });
}

function parseLocationRoute(url) {
  const postId = url.searchParams.get("post") || "";
  const blogSearch = url.searchParams.get("blogSearch") || "";
  const blogTag = url.searchParams.get("blogTag") || "";
  const page = url.searchParams.get("page") || "";
  const section = url.searchParams.get("section") || "";
  const hasBlogQuery = blogSearch || blogTag || page;

  if (postId) {
    return {
      type: "post",
      postId,
      blogSearch,
      blogTag,
      page,
    };
  }

  if (section === "blog" || hasBlogQuery) {
    return {
      type: "blog-list",
      postId: "",
      blogSearch,
      blogTag,
      page,
    };
  }

  return parseHashRoute(url.hash);
}

function parseHashRoute(hash) {
  const rawHash = String(hash || "").replace(/^#/, "");
  const [routePath, rawQuery = ""] = rawHash.split("?");
  const normalizedPath = routePath.startsWith("/") ? routePath : `/${routePath}`;
  const params = new URLSearchParams(rawQuery);

  if (normalizedPath.startsWith("/post/")) {
    return {
      type: "post",
      postId: decodeURIComponent(normalizedPath.slice("/post/".length)),
      blogSearch: params.get("blogSearch") || "",
      blogTag: params.get("blogTag") || "",
      page: params.get("page") || "",
    };
  }

  if (normalizedPath === "/blog") {
    return {
      type: "blog-list",
      postId: "",
      blogSearch: params.get("blogSearch") || "",
      blogTag: params.get("blogTag") || "",
      page: params.get("page") || "",
    };
  }

  return {
    type: "nav",
    postId: "",
    blogSearch: "",
    blogTag: "",
    page: "",
  };
}

function updateSeo() {
  const title = buildPageTitle();
  const description = buildPageDescription();
  const canonicalUrl = getCanonicalUrl();
  const currentPost = state.section === "blog-detail" ? getSelectedPost() : null;

  document.title = title;
  setMetaTag("name", "description", description);
  setMetaTag("property", "og:title", title);
  setMetaTag("property", "og:description", description);
  setMetaTag("property", "og:url", canonicalUrl);
  setMetaTag("property", "og:type", currentPost ? "article" : "website");
  setMetaTag("property", "og:site_name", siteMeta.name);
  setMetaTag("name", "twitter:title", title);
  setMetaTag("name", "twitter:description", description);
  setMetaTag("name", "twitter:card", "summary");
  setMetaTag("name", "robots", "index,follow");
  setMetaTag("property", "article:published_time", currentPost ? new Date(currentPost.publishedAt).toISOString() : null);
  setLinkTag("canonical", canonicalUrl);
  setAlternateFeed();
}

function buildPageTitle() {
  if (state.section === "blog-detail") {
    const post = getSelectedPost();
    return post ? `${post.title} | ${siteMeta.name}` : `博客详情 | ${siteMeta.name}`;
  }

  if (state.section === "blog-list") {
    if (state.blogQuery) {
      return `博客搜索：${state.blogQuery} | ${siteMeta.name}`;
    }
    if (state.blogTag !== "all") {
      return `${state.blogTag} 相关文章 | ${siteMeta.name}`;
    }
    return `博客 | ${siteMeta.name}`;
  }

  if (state.query || state.category !== "all" || state.tag !== "all" || state.view !== "all") {
    return `导航筛选 | ${siteMeta.name}`;
  }

  return siteMeta.name;
}

function buildPageDescription() {
  if (state.section === "blog-detail") {
    const post = getSelectedPost();
    return post ? post.summary : siteMeta.description;
  }

  if (state.section === "blog-list") {
    const filteredPosts = getFilteredPosts();
    if (state.blogQuery || state.blogTag !== "all") {
      return `博客当前命中 ${filteredPosts.length} 篇文章。`;
    }
    return `当前共有 ${posts.length} 篇文章。`;
  }

  return siteMeta.description;
}

function getCanonicalBaseUrl() {
  const isLocal = /^(https?:\/\/(127\.0\.0\.1|localhost))/i.test(window.location.origin);
  return isLocal ? window.location.origin : siteMeta.url.replace(/\/+$/, "");
}

function getCanonicalUrl() {
  return new URL(buildRoutePath(), `${getCanonicalBaseUrl()}/`).href;
}

function setMetaTag(attributeName, attributeValue, content) {
  let element = document.head.querySelector(`meta[${attributeName}="${attributeValue}"]`);
  if (!content) {
    element?.remove();
    return;
  }

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attributeName, attributeValue);
    document.head.append(element);
  }

  element.setAttribute("content", content);
}

function setLinkTag(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.append(element);
  }

  element.setAttribute("href", href);
}

function setAlternateFeed() {
  let element = document.head.querySelector('link[rel="alternate"][type="application/rss+xml"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "alternate");
    element.setAttribute("type", "application/rss+xml");
    element.setAttribute("title", `${siteMeta.name} RSS`);
    document.head.append(element);
  }

  element.setAttribute("href", new URL(siteMeta.rssPath, `${getCanonicalBaseUrl()}/`).href);
}
function loadStoredText(key) {
  return String(localStorage.getItem(key) || "");
}

function loadOverviewCollapsedState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.overviewCollapsed) || "true");
    return typeof parsed === "boolean" ? parsed : true;
  } catch {
    return true;
  }
}

function scrollPageTop() {
  const apply = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.scrollingElement && (document.scrollingElement.scrollTop = 0);
    root.scrollTop = 0;
    refs.content && (refs.content.scrollTop = 0);
    root.querySelector(".app-shell") && (root.querySelector(".app-shell").scrollTop = 0);
    releaseActiveElement();
  };

  apply();
  window.requestAnimationFrame(apply);
  window.setTimeout(apply, 0);
}

function scrollToCurrentSectionTop() {
  const getTarget = () => {
    if (state.section === "blog-detail") {
      return refs.content?.querySelector(".article");
    }

    if (state.section === "blog-list") {
      return refs.content?.querySelector(".blog-list, .empty-state");
    }

    return refs.content?.firstElementChild || null;
  };

  const apply = () => {
    const target = getTarget();
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ block: "start" });
    }
    scrollPageTop();
  };

  apply();
  window.requestAnimationFrame(apply);
  window.setTimeout(apply, 0);
  window.setTimeout(apply, 80);
}

function releaseActiveElement() {
  const activeElement = document.activeElement;
  if (activeElement && typeof activeElement.blur === "function") {
    activeElement.blur();
  }
}

function loadTodoList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => ({
        id: String(item.id || `todo-${Date.now()}`),
        text: String(item.text || "").trim(),
        done: Boolean(item.done),
      }))
      .filter((item) => item.text);
  } catch {
    return [];
  }
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

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatShortDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function handleIconError(image) {
  if (!image) {
    return;
  }

  const fallback = image?.nextElementSibling;
  if (fallback) {
    fallback.hidden = false;
  }
  image.hidden = true;
}

window.handleIconError = handleIconError;

function getSiteFaviconUrl(url) {
  try {
    return new URL("/favicon.ico", url).href;
  } catch {
    return "";
  }
}

function resolveAsset(path) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return new URL(path, window.location.href).href;
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








