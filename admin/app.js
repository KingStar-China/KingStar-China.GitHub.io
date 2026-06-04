import { isValidHttpUrl, normalizePostContent, normalizeStringArray as normalizeStringList, validatePostsPayload, validateSearchEnginesPayload, validateSitesPayload } from "./content-validation.js";

const state = {
  section: "sites",
  filter: "",
  sites: [],
  posts: [],
  searchEngines: [],
  iconFiles: [],
  iconQuery: "",
  iconPickerOpen: false,
  selectedSiteId: "",
  selectedPostId: "",
  selectedSearchEngineId: "",
  renameCategorySource: "",
  diagnostics: {
    duplicates: [],
    linkResults: [],
    running: false,
    checkedAt: "",
  },
  dirty: {
    sites: false,
    posts: false,
    searchEngines: false,
  },
  siteMetaLoading: false,
  status: {
    type: "info",
    text: "正在读取本地内容文件...",
  },
  publishing: false,
  draggingSearchEngineId: "",
};

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const root = document.querySelector("#app");
const refs = {};
let pendingEditorScrollY = null;
let pendingIconSearchSelection = null;

if (!LOCAL_HOSTS.has(window.location.hostname)) {
  root.innerHTML = renderRemoteOnlyState();
} else {
  init().catch((error) => {
    root.innerHTML = `<div class="panel empty-state">启动失败：${escapeHTML(error.message)}</div>`;
  });
}

async function init() {
  root.innerHTML = createShell();
  refs.sectionTabs = root.querySelector('[data-role="section-tabs"]');
  refs.search = root.querySelector('[data-role="search"]');
  refs.listActions = root.querySelector('[data-role="list-actions"]');
  refs.list = root.querySelector('[data-role="list"]');
  refs.editor = root.querySelector('[data-role="editor"]');
  refs.status = root.querySelector('[data-role="status"]');
  refs.backupInput = root.querySelector('[data-role="backup-input"]');
  refs.bookmarkInput = root.querySelector('[data-role="bookmark-input"]');

  root.addEventListener("click", handleClick);
  root.addEventListener("input", handleInput);
  root.addEventListener("change", handleChange);
  root.addEventListener("dragstart", handleDragStart);
  root.addEventListener("dragover", handleDragOver);
  root.addEventListener("drop", handleDrop);
  root.addEventListener("dragend", handleDragEnd);

  await loadContent();
  render();
}

function renderRemoteOnlyState() {
  return `
    <div class="admin-shell">
      <header class="panel hero">
        <div>
          <h1>本地内容管理器</h1>
          <p>这个页面只支持在你本机运行。线上站点不会提供内容编辑接口，所以不能直接管理站点和博客数据。</p>
        </div>
        <div class="hero__aside hero__aside--notice">
          <div class="hero__meta">
            <span class="pill">仅本机可用</span>
            <span class="pill">不会开放线上编辑</span>
          </div>
          <div class="hero__actions">
            <a class="ghost-button" href="/">返回首页</a>
          </div>
          <p class="helper hero__helper">请在项目目录的外部 PowerShell 或终端执行 <code>npm run admin:open</code>，它会自动启动本地内容管理器并打开 <code>http://127.0.0.1:3214</code>。</p>
        </div>
      </header>
    </div>
  `;
}
function createShell() {
  return `
    <div class="admin-shell">
      <header class="panel hero">
        <div>
          <h1>本地内容管理器</h1>
          <p>这个页面只在你本机运行，用来编辑站点条目和博客文章。保存后会直接改写 <code>src/data</code> 和 <code>src/content/posts</code>。</p>
          <p class="helper hero__helper">建议在外部 PowerShell 或终端执行 <code>npm run admin:open</code>；它会自动起服务、打开浏览器，并支持导入 Markdown 文件。</p>
          <p class="helper hero__helper">“提交 GitHub”会提交 <code>src/data</code>、<code>src/content</code>、<code>public/icon</code> 和 <code>public/post-image</code> 的内容变更。</p>
          <p class="helper hero__helper">JSON 可恢复站点和博客；书签 HTML 只导入网站，并默认跳过重复链接。</p>
        </div>
        <div class="hero__aside">
          <div class="hero__meta">
            <span class="pill">本地服务</span>
            <span class="pill">不会部署到线上</span>
            <span class="pill">改完后再提交 Git</span>
          </div>
          <div class="hero__actions">
            <button type="button" class="ghost-button" data-action="export-backup">导出整站备份</button>
            <button type="button" class="ghost-button" data-action="import-json">导入 JSON</button>
            <button type="button" class="ghost-button" data-action="import-bookmarks">导入书签 HTML</button>
            <button type="button" class="primary-button" data-action="publish-github">提交 GitHub</button>
          </div>
        </div>
      </header>

      <div class="workspace">
        <aside class="panel sidebar">
          <div class="section-tabs" data-role="section-tabs"></div>
          <div class="sidebar__top">
            <input class="search-input" data-role="search" type="search" placeholder="筛选当前列表">
            <div class="sidebar__actions" data-role="list-actions"></div>
          </div>
          <div class="list" data-role="list"></div>
        </aside>

        <section class="panel editor">
          <div class="editor__head">
            <div>
              <h2 data-role="editor-title">内容编辑</h2>
              <p data-role="editor-subtitle">保存后会直接写回项目文件。</p>
            </div>
            <div class="editor__actions">
              <button type="button" class="ghost-button" data-action="export-section">导出当前分类</button>
              <button type="button" class="ghost-button" data-action="reload-content">重新读取</button>
              <button type="button" class="primary-button" data-action="save-section">保存当前分类</button>
            </div>
          </div>
          <div class="status-bar" data-role="status"></div>
          <div data-role="editor"></div>
        </section>
      </div>

      <input type="file" hidden data-role="backup-input" accept=".json,application/json">
      <input type="file" hidden data-role="bookmark-input" accept=".html,text/html">
      <div class="scroll-action-group" aria-label="页面滚动快捷按钮">
        <button type="button" class="scroll-action-button" data-action="scroll-bottom">直达底部</button>
        <button type="button" class="scroll-action-button" data-action="scroll-top">回到顶部</button>
      </div>
    </div>
  `;
}

async function loadContent() {
  const response = await fetch("/api/content", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`读取内容失败：${response.status}`);
  }

  const payload = await response.json();
  state.sites = Array.isArray(payload.sites) ? payload.sites.map(normalizeSite) : [];
  state.posts = Array.isArray(payload.posts) ? payload.posts.map(normalizePost) : [];
  state.searchEngines = Array.isArray(payload.searchEngines) ? sortSearchEnginesByPriority(payload.searchEngines.map(normalizeSearchEngine)) : [];
  state.iconFiles = Array.isArray(payload.iconFiles) ? payload.iconFiles.map((name) => String(name || "").trim()).filter(Boolean) : [];
  syncSelections();
  resetSiteDiagnostics();
  state.dirty.sites = false;
  state.dirty.posts = false;
  state.dirty.searchEngines = false;
  state.renameCategorySource = getSelectedSiteCategory();
  setStatus("success", "本地内容已加载，可以开始编辑。", false);
}

function render() {
  refs.sectionTabs.innerHTML = renderSectionTabs();
  refs.listActions.innerHTML = renderListActions();
  refs.list.innerHTML = renderList();
  refs.editor.innerHTML = renderEditor();
  refs.search.value = state.filter;
  refs.status.className = `status-bar ${state.status.type === "error" ? "is-error" : state.status.type === "success" ? "is-success" : ""}`.trim();
  refs.status.textContent = state.status.text;
  const publishButton = root.querySelector('[data-action="publish-github"]');
  if (publishButton) {
    publishButton.disabled = state.publishing;
    publishButton.textContent = state.publishing ? "正在提交..." : "提交 GitHub";
  }
  root.querySelector('[data-role="editor-title"]').textContent = state.section === "sites"
    ? "网站编辑器"
    : state.section === "posts"
      ? "博客编辑器"
      : "搜索引擎编辑器";
  root.querySelector('[data-role="editor-subtitle"]').textContent = state.section === "sites"
      ? "维护导航站里的网站条目。填写图标路径时前台优先使用这里；留空时才会尝试网站 favicon。"
    : state.section === "posts"
      ? "维护站内博客文章。正文使用 Markdown 保存，支持标题、列表、引用和代码块。"
      : "维护首页搜索框里的搜索引擎。搜索链接模板必须包含 {query}。";

  restoreEditorStateAfterRender();
}

function renderSectionTabs() {
  const items = [
    { value: "sites", label: `网站 (${state.sites.length})` },
    { value: "posts", label: `博客 (${state.posts.length})` },
    { value: "searchEngines", label: `搜索引擎 (${state.searchEngines.length})` },
  ];

  return items.map((item) => `
    <button
      type="button"
      class="section-tab ${state.section === item.value ? "is-active" : ""}"
      data-action="set-section"
      data-value="${escapeHTML(item.value)}"
    >
      ${escapeHTML(item.label)}${state.dirty[item.value] ? " *" : ""}
    </button>
  `).join("");
}

function renderListActions() {
  const isSites = state.section === "sites";
  return `
    <button type="button" class="primary-button" data-action="create-item">${isSites ? "新建网站" : state.section === "posts" ? "新建文章" : "新建引擎"}</button>
    <button type="button" class="danger-button" data-action="delete-item">${isSites ? "删除网站" : state.section === "posts" ? "删除文章" : "删除引擎"}</button>
  `;
}

function renderList() {
  const items = getFilteredItems();
  if (items.length === 0) {
    return `<div class="empty-state">当前没有匹配项。</div>`;
  }

  return items.map((item) => renderListItem(item)).join("");
}

function renderListItem(item) {
  const isSites = state.section === "sites";
  const isActive = getSelectedId() === item.id;
  const isSearchEngine = state.section === "searchEngines";
  const draggableAttrs = isSearchEngine ? ` draggable="true" data-drag-id="${escapeAttr(item.id)}"` : "";
  const draggingClass = isSearchEngine && state.draggingSearchEngineId === item.id ? " is-dragging" : "";
  const title = isSites
    ? item.name || "未命名网站"
    : state.section === "posts"
      ? item.title || "未命名文章"
      : item.label || "未命名引擎";

  if (isSearchEngine) {
    return `
      <div class="list-item list-item--draggable ${isActive ? "is-active" : ""}${draggingClass}"${draggableAttrs}>
        <div class="list-item__drag-handle" aria-hidden="true" title="拖动排序">
          <span class="list-item__drag-grip">::</span>
          <span>拖动排序</span>
        </div>
        <button type="button" class="list-item__body" data-action="select-item" data-id="${escapeHTML(item.id)}">
          <strong>${escapeHTML(title)}</strong>
        </button>
      </div>
    `;
  }

  return `
    <button type="button" class="list-item ${isActive ? "is-active" : ""}" data-action="select-item" data-id="${escapeHTML(item.id)}">
      <strong>${escapeHTML(title)}</strong>
    </button>
  `;
}

function renderEditor() {
  const item = getSelectedItem();
  const diagnostics = state.section === "sites" ? renderDiagnosticsPanel() : "";

  if (!item) {
    return `${diagnostics}<div class="empty-state">先创建一条内容，或者从左侧选择要编辑的项。</div>`;
  }

  if (state.section === "sites") {
    return `${diagnostics}${renderSiteEditor(item)}`;
  }

  if (state.section === "posts") {
    return renderPostEditor(item);
  }

  return renderSearchEngineEditor(item);
}

function renderDiagnosticsPanel() {
  const diagnostics = state.diagnostics || {
    duplicates: [],
    linkResults: [],
    running: false,
    checkedAt: "",
  };
  const duplicateGroups = diagnostics.duplicates;
  const linkResults = [...diagnostics.linkResults].sort((left, right) => Number(left.ok) - Number(right.ok));
  const okCount = linkResults.filter((item) => item.ok).length;
  const failCount = linkResults.length - okCount;
  const checkedAt = diagnostics.checkedAt ? formatDateTime(diagnostics.checkedAt) : "未检测";

  return `
    <section class="diagnostics">
      <div class="diagnostics__head">
        <div>
          <h3>站点体检</h3>
          <p>先查重复链接，再批量测可访问性。死链检测走本地服务，结果不会上传。</p>
        </div>
        <div class="diagnostics__actions">
          <button type="button" class="ghost-button" data-action="scan-duplicates">检查重复链接</button>
          <button type="button" class="ghost-button" data-action="check-links" ${diagnostics.running ? "disabled" : ""}>${diagnostics.running ? "检测中..." : "检查死链"}</button>
          <button type="button" class="ghost-button" data-action="clear-diagnostics">清空结果</button>
        </div>
      </div>
      <div class="diagnostics__summary">
        <div class="diagnostic-card">
          <span class="diagnostic-card__label">重复链接组</span>
          <strong class="diagnostic-card__value">${duplicateGroups.length}</strong>
        </div>
        <div class="diagnostic-card">
          <span class="diagnostic-card__label">可访问</span>
          <strong class="diagnostic-card__value">${okCount}</strong>
        </div>
        <div class="diagnostic-card">
          <span class="diagnostic-card__label">异常</span>
          <strong class="diagnostic-card__value">${failCount}</strong>
        </div>
        <div class="diagnostic-card">
          <span class="diagnostic-card__label">最近检测</span>
          <strong class="diagnostic-card__value diagnostic-card__value--small">${escapeHTML(checkedAt)}</strong>
        </div>
      </div>
      ${renderDuplicateGroups(duplicateGroups)}
      ${renderLinkResults(linkResults)}
      ${duplicateGroups.length === 0 && linkResults.length === 0 && !diagnostics.running ? '<div class="diagnostics__empty">还没有体检结果。先点“检查重复链接”或“检查死链”。</div>' : ''}
    </section>
  `;
}

function renderDuplicateGroups(groups) {
  if (groups.length === 0) {
    return "";
  }

  return `
    <div class="diagnostics__block">
      <div class="diagnostics__title">重复链接</div>
      <div class="diagnostic-list">
        ${groups.map((group) => `
          <article class="diagnostic-item diagnostic-item--warning">
            <div class="diagnostic-item__main">
              <strong>${escapeHTML(group.url)}</strong>
              <span>${escapeHTML(group.items.map((item) => item.name || item.id).join(" / "))}</span>
            </div>
            <span class="diagnostic-item__meta">${group.items.length} 项重复</span>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function renderLinkResults(results) {
  if (results.length === 0) {
    return "";
  }

  return `
    <div class="diagnostics__block">
      <div class="diagnostics__title">死链检测</div>
      <div class="diagnostic-list">
        ${results.map((result) => renderLinkResult(result)).join("")}
      </div>
    </div>
  `;
}

function renderLinkResult(result) {
  const statusClass = result.ok ? "diagnostic-item--ok" : "diagnostic-item--error";
  const statusLabel = result.ok ? `HTTP ${result.status}` : (result.error || `HTTP ${result.status || "失败"}`);
  const meta = result.finalUrl && result.finalUrl !== result.url ? `跳转到 ${result.finalUrl}` : (result.method || "未完成");

  return `
    <article class="diagnostic-item ${statusClass}">
      <div class="diagnostic-item__main">
        <strong>${escapeHTML(result.name || result.id)}</strong>
        <span>${escapeHTML(result.url)}</span>
      </div>
      <div class="diagnostic-item__side">
        <span class="diagnostic-item__meta">${escapeHTML(statusLabel)}</span>
        <span class="diagnostic-item__meta diagnostic-item__meta--muted">${escapeHTML(meta)}</span>
      </div>
    </article>
  `;
}

function renderSiteEditor(site) {
  const categoryOptions = renderOptionList(getExistingSiteCategories(), site.category);
  const tagOptions = renderOptionList(getExistingTags("sites"), "", new Set(site.tags || []));
  const iconKeyword = state.iconQuery.toLowerCase();
  const iconOptions = state.iconFiles
    .map((name) => ({ name, path: `icon/${name}` }))
    .filter((option) => option.path !== (site.icon || ""))
    .filter((option) => !iconKeyword || option.name.toLowerCase().includes(iconKeyword) || option.path.toLowerCase().includes(iconKeyword));

  return `
    <div class="form-grid">
      <div class="field">
        <label for="site-name">网站名称</label>
        <input id="site-name" data-field="name" value="${escapeAttr(site.name)}">
      </div>
      <div class="field">
        <label for="site-id">唯一 ID</label>
        <div class="meta-row">
          <input id="site-id" data-field="id" value="${escapeAttr(site.id)}">
          <button type="button" class="mini-button" data-action="generate-id">生成</button>
        </div>
      </div>
      <div class="field field--full">
        <label for="site-url">网站链接</label>
        <div class="meta-row">
          <input id="site-url" data-field="url" value="${escapeAttr(site.url)}" placeholder="https://example.com">
          <button type="button" class="mini-button" data-action="fetch-site-metadata" ${state.siteMetaLoading ? "disabled" : ""}>${state.siteMetaLoading ? "抓取中..." : "抓取站点信息"}</button>
        </div>
        <span class="helper">这一步只在本地内容管理器里执行，不依赖 GitHub Pages。会抓标题、描述和 favicon 建议。</span>
      </div>
      <div class="field">
        <label for="site-category">分类</label>
        <input id="site-category" data-field="category" value="${escapeAttr(site.category)}" placeholder="可直接自定义输入">
        <div class="meta-row">
          <select data-action="pick-category">
            <option value="">选择已有分类</option>
            ${categoryOptions}
          </select>
          <button type="button" class="mini-button" data-action="rename-category" data-from-category="${escapeAttr(state.renameCategorySource || site.category)}">批量改名</button>
        </div>
        <span class="helper">上面可直接改当前网站分类；点“批量改名”会把所有同分类网站一起改成输入框里的新名字。</span>
      </div>
      <div class="field">
        <label for="site-icon">图标路径</label>
        <div class="meta-row">
          <input id="site-icon" data-field="icon" value="${escapeAttr(site.icon || "")}" placeholder="icon/example.png 或 https://...">
          <button type="button" class="mini-button" data-action="open-icon-folder">打开ICON文件夹</button>
        </div>
        <span class="helper">支持 public/icon 下的相对路径，也支持直接填网络图片地址；这里有值时前台优先使用这里，留空时才会尝试网站自身 favicon。</span>
        ${state.iconFiles.length > 0 ? `
          <div class="icon-picker-panel">
            <div class="icon-picker-panel__head">
              <button type="button" class="mini-button" data-action="toggle-icon-picker">${state.iconPickerOpen ? "收起图标列表" : `选择图标（${state.iconFiles.length}）`}</button>
            </div>
            ${state.iconPickerOpen ? `
              <div class="icon-picker-panel__body">
                <input class="search-input icon-picker-panel__search" data-role="icon-search" type="search" value="${escapeAttr(state.iconQuery)}" placeholder="搜索图标文件名">
                <div class="icon-picker">
                  ${iconOptions.length > 0 ? iconOptions.map((option) => `
                    <button type="button" class="icon-chip" data-action="pick-icon-path" data-value="${escapeAttr(option.path)}">${escapeHTML(option.name)}</button>
                  `).join("") : `<div class="helper">没有匹配的图标。</div>`}
                </div>
              </div>
            ` : ""}
          </div>
        ` : ""}
      </div>
      <div class="field field--full">
        <label for="site-description">描述</label>
        <textarea id="site-description" data-field="description">${escapeHTML(site.description || "")}</textarea>
      </div>
      <div class="field">
        <label for="site-tags">标签（逗号分隔）</label>
        <input id="site-tags" data-field="tags" value="${escapeAttr((site.tags || []).join(", "))}" placeholder="可直接自定义输入多个标签">
        <select data-action="append-tag">
          <option value="">添加已有标签</option>
          ${tagOptions}
        </select>
        <span class="helper">输入框可自定义，下面可把已有标签追加到当前网站。</span>
      </div>
      <div class="field">
        <label for="site-aliases">别名（逗号分隔）</label>
        <input id="site-aliases" data-field="aliases" value="${escapeAttr((site.aliases || []).join(", "))}">
      </div>
      <div class="field field--full">
        <span class="helper">icon 为空时，页面会先尝试网站自身 favicon，再不行才自动生成占位图标。ID 建议只用英文、数字和短横线。</span>
      </div>
    </div>
  `;
}

function renderSearchEngineEditor(engine) {
  return `
    <div class="form-grid">
      <div class="field">
        <label for="engine-label">显示名称</label>
        <input id="engine-label" data-field="label" value="${escapeAttr(engine.label)}">
      </div>
      <div class="field">
        <label for="engine-id">唯一 ID</label>
        <div class="meta-row">
          <input id="engine-id" data-field="id" value="${escapeAttr(engine.id)}">
          <button type="button" class="mini-button" data-action="generate-id">生成</button>
        </div>
      </div>
      <div class="field">
        <label for="engine-priority">优先级排序</label>
        <input id="engine-priority" data-field="priority" type="number" min="1" max="99" step="1" inputmode="numeric" value="${escapeAttr(engine.priority ?? "")}">
        <span class="helper">支持 1-99，不能重复；1 排第一。左侧也可直接拖拽调整顺序。</span>
      </div>
      <div class="field field--full">
        <label for="engine-placeholder">输入框提示词</label>
        <input id="engine-placeholder" data-field="placeholder" value="${escapeAttr(engine.placeholder)}">
      </div>
      <div class="field field--full">
        <label for="engine-url-template">搜索链接模板</label>
        <input id="engine-url-template" data-field="urlTemplate" value="${escapeAttr(engine.urlTemplate)}" placeholder="https://www.sogou.com/web?query={query}">
      </div>
      <div class="field field--full">
        <span class="helper">模板必须包含 <code>{query}</code>，搜索时会自动替换成关键词。</span>
      </div>
    </div>
  `;
}

function renderPostEditor(post) {
  const tagOptions = renderOptionList(getExistingTags("posts"), "", new Set(post.tags || []));

  return `
    <div class="form-grid">
      <div class="field field--full">
        <label for="post-title">文章标题</label>
        <input id="post-title" data-field="title" value="${escapeAttr(post.title)}">
      </div>
      <div class="field">
        <label for="post-id">唯一 ID</label>
        <div class="meta-row">
          <input id="post-id" data-field="id" value="${escapeAttr(post.id)}">
          <button type="button" class="mini-button" data-action="generate-id">生成</button>
        </div>
        <span class="helper">文章 ID 使用生成时的本地时间，格式为 YYYYMMDDHHMMSS。</span>
      </div>
      <div class="field">
        <label for="post-date">发布日期</label>
        <input id="post-date" data-field="publishedAt" type="date" value="${escapeAttr(post.publishedAt)}">
      </div>
      <div class="field field--full">
        <label for="post-summary">摘要</label>
        <textarea id="post-summary" data-field="summary">${escapeHTML(post.summary || "")}</textarea>
      </div>
      <div class="field field--full">
        <label for="post-tags">标签（逗号分隔）</label>
        <input id="post-tags" data-field="tags" value="${escapeAttr((post.tags || []).join(", "))}" placeholder="可直接自定义输入多个标签">
        <select data-action="append-tag">
          <option value="">添加已有标签</option>
          ${tagOptions}
        </select>
        <span class="helper">输入框可自定义，下面可把已有标签追加到当前文章。</span>
      </div>
      <div class="field field--full">
        <div class="field-head">
          <label for="post-content">正文（Markdown）</label>
          <button type="button" class="ghost-button field-head__action" data-action="import-post-markdown">导入 Markdown 文件</button>
        </div>
        <textarea id="post-content" data-field="content" style="min-height: 320px;">${escapeHTML(post.content || "")}</textarea>
      </div>
      <div class="field field--full">
        <span class="helper">支持 Markdown。导入本地 .md 文件时，会顺手填充 front matter，并把正文里的本地图片、base64 图片和外链图片统一复制到 <code>public/post-image</code>。</span>
      </div>
    </div>
  `;
}

function handleClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const { action, value, id } = button.dataset;

  if (action === "set-section") {
    state.section = value;
    state.filter = "";
    if (state.section === "sites") {
      state.renameCategorySource = getSelectedSiteCategory();
    }
    render();
    return;
  }

  if (action === "select-item") {
    setSelectedId(id);
    if (state.section === "sites") {
      state.renameCategorySource = getSelectedSiteCategory();
    }
    render();
    return;
  }

  if (action === "create-item") {
    createItem();
    render();
    return;
  }

  if (action === "delete-item") {
    deleteItem();
    render();
    return;
  }

  if (action === "rename-category") {
    renameCategory(button.dataset.fromCategory || "").then(() => {
      render();
    }).catch((error) => {
      setStatus("error", error.message);
      render();
    });
    return;
  }

  if (action === "open-icon-folder") {
    openIconFolder().catch((error) => {
      setStatus("error", error.message);
      render();
    });
    return;
  }

  if (action === "fetch-site-metadata") {
    fetchSelectedSiteMetadata().catch((error) => {
      state.siteMetaLoading = false;
      setStatus("error", error.message);
      render();
    });
    return;
  }

  if (action === "toggle-icon-picker") {
    state.iconPickerOpen = !state.iconPickerOpen;
    if (!state.iconPickerOpen) {
      state.iconQuery = "";
    }
    render();
    return;
  }

  if (action === "pick-icon-path") {
    applyPickedIconPath(value);
    return;
  }

  if (action === "generate-id") {
    pendingEditorScrollY = window.scrollY;
    generateId();
    render();
    return;
  }

  if (action === "save-section") {
    saveSection().catch((error) => {
      setStatus("error", error.message);
      render();
    });
    return;
  }

  if (action === "reload-content") {
    loadContent().then(render).catch((error) => {
      setStatus("error", error.message);
      render();
    });
    return;
  }

  if (action === "export-section") {
    exportCurrentSection();
    return;
  }

  if (action === "export-backup") {
    exportFullBackup();
    return;
  }

  if (action === "import-json") {
    refs.backupInput.value = "";
    refs.backupInput.click();
    return;
  }

  if (action === "import-bookmarks") {
    refs.bookmarkInput.value = "";
    refs.bookmarkInput.click();
    return;
  }

  if (action === "import-post-markdown") {
    const item = getSelectedItem();
    if (!item || state.section !== "posts") {
      setStatus("error", "请先在博客分类里选中一篇文章。");
      render();
      return;
    }
    importPostMarkdown().catch((error) => {
      setStatus(error.message === "已取消导入 Markdown 文件。" ? "info" : "error", error.message, false);
      render();
    });
    return;
  }

  if (action === "publish-github") {
    publishToGitHub().catch((error) => {
      state.publishing = false;
      setStatus("error", error.message);
      render();
    });
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

  if (action === "scan-duplicates") {
    runDuplicateScan();
    render();
    return;
  }

  if (action === "check-links") {
    runLinkCheck().catch((error) => {
      state.diagnostics.running = false;
      setStatus("error", error.message);
      render();
    });
    return;
  }

  if (action === "clear-diagnostics") {
    resetSiteDiagnostics();
    setStatus("info", "已清空站点体检结果。", false);
    render();
  }
}
function handleInput(event) {
  if (event.target.matches('[data-role="search"]')) {
    state.filter = event.target.value.trim();
    render();
    return;
  }

  if (event.target.matches('[data-role="icon-search"]')) {
    pendingEditorScrollY = window.scrollY;
    pendingIconSearchSelection = {
      start: event.target.selectionStart ?? event.target.value.length,
      end: event.target.selectionEnd ?? event.target.value.length,
    };
    state.iconQuery = event.target.value.trim();
    render();
    return;
  }

  const field = event.target.dataset.field;
  if (!field) {
    return;
  }

  const item = getSelectedItem();
  if (!item) {
    return;
  }

  const value = event.target.value;
  if (state.section === "sites") {
    applySiteField(item, field, value);
    state.dirty.sites = true;
    resetSiteDiagnostics();
  } else if (state.section === "posts") {
    applyPostField(item, field, value);
    state.dirty.posts = true;
  } else {
    applySearchEngineField(item, field, value);
    state.dirty.searchEngines = true;
  }

  if (field === "id") {
    setSelectedId(item.id);
  }

  setStatus("info", "内容已修改，记得点击“保存当前分类”。", false);
  refreshChrome();
}

function handleChange(event) {
  const action = event.target.dataset.action;
  if (event.target === refs.backupInput) {
    importJsonFile(event.target.files?.[0]).catch((error) => {
      setStatus("error", error.message);
      render();
    }).finally(() => {
      event.target.value = "";
    });
    return;
  }

  if (event.target === refs.bookmarkInput) {
    importBookmarkFile(event.target.files?.[0]).catch((error) => {
      setStatus("error", error.message);
      render();
    }).finally(() => {
      event.target.value = "";
    });
    return;
  }

  if (!action) {
    return;
  }

  if (action === "pick-category") {
    applyPickedCategory(event.target.value);
    event.target.value = "";
    return;
  }

  if (action === "append-tag") {
    appendPickedTag(event.target.value);
    event.target.value = "";
  }
}

function handleDragStart(event) {
  if (state.section !== "searchEngines") {
    return;
  }

  const button = event.target.closest('[data-drag-id]');
  if (!button) {
    return;
  }

  state.draggingSearchEngineId = button.dataset.dragId || "";
  event.dataTransfer?.setData("text/plain", state.draggingSearchEngineId);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function handleDragOver(event) {
  if (state.section !== "searchEngines" || !state.draggingSearchEngineId) {
    return;
  }

  const target = event.target.closest('[data-drag-id]');
  if (!target || target.dataset.dragId === state.draggingSearchEngineId) {
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function handleDrop(event) {
  if (state.section !== "searchEngines" || !state.draggingSearchEngineId) {
    return;
  }

  const target = event.target.closest('[data-drag-id]');
  if (!target) {
    return;
  }

  event.preventDefault();
  const targetId = target.dataset.dragId || "";
  if (!targetId || targetId === state.draggingSearchEngineId) {
    state.draggingSearchEngineId = "";
    render();
    return;
  }

  reorderSearchEngine(state.draggingSearchEngineId, targetId, event.clientY > target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2 ? "after" : "before");
}

function handleDragEnd() {
  if (!state.draggingSearchEngineId) {
    return;
  }

  state.draggingSearchEngineId = "";
  render();
}

function applySiteField(site, field, value) {
  if (field === "tags" || field === "aliases") {
    site[field] = splitCommaList(value);
    return;
  }

  if (field === "url") {
    site.url = normalizeEditableUrlValue(value);
    return;
  }

  site[field] = value;
}

function applySearchEngineField(engine, field, value) {
  if (field === "priority") {
    engine.priority = normalizeSearchEnginePriorityValue(value);
    state.searchEngines = sortSearchEnginesByPriority(state.searchEngines);
    return;
  }

  engine[field] = value;
}

function applyPostField(post, field, value) {
  if (field === "tags") {
    post.tags = splitCommaList(value);
    return;
  }

  if (field === "content") {
    post.content = normalizePostContent(value);
    return;
  }

  post[field] = value;
}

function applyPickedCategory(value) {
  const category = String(value || "").trim();
  const item = getSelectedItem();
  if (!category || !item || state.section !== "sites") {
    return;
  }

  item.category = category;
  state.dirty.sites = true;
  resetSiteDiagnostics();
  setStatus("info", `已选择已有分类：${category}`, false);
  render();
}

async function renameCategory(fromCategory = "") {
  const item = getSelectedItem();
  if (!item || state.section !== "sites") {
    return;
  }

  const currentCategory = String(fromCategory || state.renameCategorySource || item.category || "").trim();
  if (!currentCategory) {
    throw new Error("当前网站还没有分类，不能批量改名。");
  }

  const input = root.querySelector('[data-field="category"]');
  const nextCategory = String(input?.value || item.category || "").trim();
  if (!nextCategory) {
    throw new Error("新分类名称不能为空。");
  }

  if (nextCategory === currentCategory) {
    setStatus("info", "分类名称没有变化。", false);
    return;
  }

  const matchedSites = state.sites.filter((site) => String(site.category || "").trim() === currentCategory);
  if (matchedSites.length === 0) {
    throw new Error(`没有找到分类“${currentCategory}”下的网站。`);
  }

  if (!window.confirm(`确定把分类“${currentCategory}”批量改成“${nextCategory}”吗？将影响 ${matchedSites.length} 个网站。`)) {
    setStatus("info", "已取消批量改名。", false);
    return;
  }

  for (const site of matchedSites) {
    site.category = nextCategory;
  }

  item.category = nextCategory;
  state.renameCategorySource = nextCategory;
  state.dirty.sites = true;
  resetSiteDiagnostics();
  await saveSection();
  setStatus("success", `已把 ${matchedSites.length} 个网站从“${currentCategory}”改到“${nextCategory}”，并保存到本地文件。`, true);
}
function applyPickedIconPath(value) {
  const iconPath = String(value || "").trim();
  const item = getSelectedItem();
  if (!item || state.section !== "sites" || !iconPath) {
    return;
  }

  item.icon = iconPath;
  state.dirty.sites = true;
  state.iconPickerOpen = false;
  state.iconQuery = "";
  setStatus("success", `已选择图标：${iconPath}`, true);
  render();
}

async function openIconFolder() {
  const response = await fetch("/api/open-icon-folder", { method: "POST" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `打开图标文件夹失败：${response.status}`);
  }

  setStatus("success", "已打开 public/icon 文件夹。", true);
}

async function fetchSelectedSiteMetadata() {
  const item = getSelectedItem();
  if (!item || state.section !== "sites") {
    return;
  }

  const siteUrl = normalizeSiteUrlValue(item.url);
  if (!isValidHttpUrl(siteUrl)) {
    throw new Error("请先填写有效的网站链接，再抓取站点信息。");
  }

  state.siteMetaLoading = true;
  setStatus("info", "正在抓取站点标题、描述和图标建议...", true);
  render();

  try {
    const metadata = await requestSiteMetadata(siteUrl);
    const updatedFields = [];

    if (siteUrl !== item.url) {
      item.url = siteUrl;
      updatedFields.push("链接");
    }

    if (metadata.name && metadata.name !== item.name) {
      item.name = metadata.name;
      updatedFields.push("名称");
    }

    if (metadata.description && metadata.description !== item.description) {
      item.description = metadata.description;
      updatedFields.push("描述");
    }

    if (!item.icon && metadata.icon) {
      item.icon = metadata.icon;
      updatedFields.push("图标");
    }

    const mergedAliases = Array.from(new Set([...(item.aliases || []), ...(metadata.aliases || [])].filter(Boolean)));
    if (mergedAliases.length !== (item.aliases || []).length) {
      item.aliases = mergedAliases;
      updatedFields.push("别名");
    }

    if (updatedFields.length === 0) {
      setStatus("info", "已抓取站点信息，但没有需要更新的字段。", true);
      return;
    }

    state.dirty.sites = true;
    setStatus("success", `已更新：${updatedFields.join("、")}。记得保存网站分类。`, true);
  } finally {
    state.siteMetaLoading = false;
    render();
  }
}

async function requestSiteMetadata(url) {
  const response = await fetch("/api/site-metadata", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ url: normalizeSiteUrlValue(url) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `抓取站点信息失败：${response.status}`);
  }

  return {
    name: String(result.name || "").trim(),
    description: String(result.description || "").trim(),
    icon: String(result.icon || "").trim(),
    aliases: normalizeStringList(result.aliases),
    finalUrl: String(result.finalUrl || "").trim(),
  };
}

function appendPickedTag(value) {
  const tag = String(value || "").trim();
  const item = getSelectedItem();
  if (!tag || !item) {
    return;
  }

  const nextTags = Array.from(new Set([...(item.tags || []), tag]));
  if ((item.tags || []).length === nextTags.length) {
    setStatus("info", `当前内容已有标签：${tag}`, false);
    refreshChrome();
    return;
  }

  item.tags = nextTags;
  state.dirty[state.section] = true;
  if (state.section === "sites") {
    resetSiteDiagnostics();
  }
  setStatus("info", `已追加已有标签：${tag}`, false);
  render();
}

function getFilteredItems() {
  const keyword = state.filter.toLowerCase();
  const items = state.section === "sites" ? state.sites : state.section === "posts" ? state.posts : state.searchEngines;
  if (!keyword) {
    return items;
  }

  return items.filter((item) => {
    const source = state.section === "sites"
      ? [item.name, item.category, item.description, ...(item.tags || []), ...(item.aliases || [])]
      : state.section === "posts"
        ? [item.title, item.summary, item.publishedAt, ...(item.tags || []), item.content || ""]
        : [item.label, item.id, item.placeholder, item.urlTemplate];
    return source.join(" ").toLowerCase().includes(keyword);
  });
}

function getSelectedItem() {
  const selectedId = getSelectedId();
  const items = state.section === "sites" ? state.sites : state.section === "posts" ? state.posts : state.searchEngines;
  return items.find((item) => item.id === selectedId) || null;
}

function getSelectedId() {
  return state.section === "sites" ? state.selectedSiteId : state.section === "posts" ? state.selectedPostId : state.selectedSearchEngineId;
}

function setSelectedId(id) {
  if (state.section === "sites") {
    state.selectedSiteId = id;
    state.renameCategorySource = getSelectedSiteCategory(id);
  } else if (state.section === "posts") {
    state.selectedPostId = id;
  } else {
    state.selectedSearchEngineId = id;
  }
}

function createItem() {
  if (state.section === "sites") {
    const site = {
      id: `site-${Date.now()}` ,
      name: "",
      url: "",
      category: "未分类",
      tags: [],
      icon: "",
      description: "",
      aliases: [],
    };
    state.sites = [site, ...state.sites];
    state.selectedSiteId = site.id;
    state.renameCategorySource = site.category;
    state.dirty.sites = true;
    resetSiteDiagnostics();
    setStatus("info", "已创建新网站草稿。", false);
    return;
  }

  if (state.section === "posts") {
    const today = new Date().toISOString().slice(0, 10);
    const post = {
      id: createUniquePostTimestampId(),
      title: "",
      summary: "",
      publishedAt: today,
      tags: [],
      content: "",
    };
    state.posts = [post, ...state.posts];
    state.selectedPostId = post.id;
    state.dirty.posts = true;
    setStatus("info", "已创建新文章草稿。", false);
    return;
  }

  const engine = {
    id: `engine-${Date.now()}` ,
    label: "",
    priority: getNextSearchEnginePriority(),
    placeholder: "",
    urlTemplate: "https://www.sogou.com/web?query={query}",
  };
  state.searchEngines = sortSearchEnginesByPriority([...state.searchEngines, engine]);
  state.selectedSearchEngineId = engine.id;
  state.dirty.searchEngines = true;
  setStatus("info", "已创建新搜索引擎草稿。", false);
}

function deleteItem() {
  const item = getSelectedItem();
  if (!item) {
    setStatus("error", "当前没有可删除的内容。");
    return;
  }

  const label = state.section === "sites" ? item.name || item.id : state.section === "posts" ? item.title || item.id : item.label || item.id;
  if (!window.confirm(`确定删除“${label}”吗？删除后会在保存时写回文件。`)) {
    return;
  }

  if (state.section === "sites") {
    state.sites = state.sites.filter((site) => site.id !== item.id);
    state.selectedSiteId = "";
    state.renameCategorySource = getSelectedSiteCategory();
    state.dirty.sites = true;
    resetSiteDiagnostics();
  } else if (state.section === "posts") {
    state.posts = state.posts.filter((post) => post.id !== item.id);
    state.selectedPostId = "";
    state.dirty.posts = true;
  } else {
    state.searchEngines = state.searchEngines.filter((engine) => engine.id !== item.id);
    state.selectedSearchEngineId = "";
    state.dirty.searchEngines = true;
  }

  setStatus("info", "已删除当前内容，记得保存当前分类。", false);
}

function generateId() {
  const item = getSelectedItem();
  if (!item) {
    return;
  }

  if (state.section === "posts") {
    const nextId = createUniquePostTimestampId(item.id);
    item.id = nextId;
    setSelectedId(nextId);
    state.dirty.posts = true;
    setStatus("info", "已按当前时间生成文章 ID。", false);
    return;
  }

  const source = state.section === "sites" ? item.name : state.section === "posts" ? item.title : item.label;
  const slug = slugify(source);
  const nextId = slug || `${state.section === "sites" ? "site" : "engine"}-${Date.now()}`;
  item.id = nextId;
  setSelectedId(nextId);
  state.dirty[state.section] = true;
  setStatus("info", "已根据当前标题生成 ID。", false);
}

function formatTimestampId(date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function createUniquePostTimestampId(excludeId = "") {
  const usedIds = new Set(state.posts.map((post) => post.id).filter((id) => id && id !== excludeId));
  const baseDate = new Date();

  for (let offsetSeconds = 0; offsetSeconds < 120; offsetSeconds += 1) {
    const candidateDate = new Date(baseDate.getTime() + offsetSeconds * 1000);
    const candidateId = formatTimestampId(candidateDate);
    if (!usedIds.has(candidateId)) {
      return candidateId;
    }
  }

  return `${formatTimestampId(baseDate)}${String(Math.floor(Math.random() * 10))}`;
}

async function saveSection() {
  await saveSectionByName(state.section);
  setStatus("success", `已保存${state.section === "sites" ? "网站" : state.section === "posts" ? "博客文章" : "搜索引擎"}到本地文件。`, true);
  render();
}

async function saveSectionByName(section) {
  const target = section === "sites" ? "/api/sites" : section === "posts" ? "/api/posts" : "/api/search-engines";
  const payload = section === "sites" ? state.sites : section === "posts" ? state.posts : state.searchEngines;

  validateBeforeSave(payload, section);

  const response = await fetch(target, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `保存失败：${response.status}`);
  }

  state.dirty[section] = false;
}

async function saveDirtySections() {
  const sections = ["sites", "posts", "searchEngines"].filter((section) => state.dirty[section]);
  for (const section of sections) {
    await saveSectionByName(section);
  }
}

async function publishToGitHub() {
  if (state.publishing) {
    return;
  }

  const message = String(window.prompt("输入这次提交的 Git commit message：", `content: update ${formatFileDate(new Date())}`) || "").trim();
  if (!message) {
    setStatus("info", "已取消提交 GitHub。", false);
    render();
    return;
  }

  state.publishing = true;
  setStatus("info", "正在保存内容并提交到 GitHub...", true);
  render();

  await saveDirtySections();

  const response = await fetch("/api/publish-github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = String(result.detail || "").trim();
    const fallback = result.error || `提交失败：${response.status}`;
    if (result.code === "push_failed_after_commit" || result.code === "push_failed_pending_commits") {
      throw new Error(`${fallback}${detail ? `\n\nGit 输出：${detail}` : ""}`);
    }
    throw new Error(detail ? `${fallback}\n\nGit 输出：${detail}` : fallback);
  }

  state.publishing = false;
  if (result.pushedOnly) {
    setStatus("success", `已重试推送到 GitHub：${result.branch || "main"} · ${result.summary || "已推送待同步提交"}`, true);
  } else {
    setStatus("success", `已推送到 GitHub：${result.branch || "main"} · ${result.summary || message}`, true);
  }
  render();
}

function exportCurrentSection() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    section: state.section,
    items: state.section === "sites" ? state.sites : state.section === "posts" ? state.posts : state.searchEngines,
  };
  const filename = `backup-${state.section}-${formatFileDate(new Date())}.json`;
  downloadJson(filename, payload);
  setStatus("success", `已导出${state.section === "sites" ? "网站" : state.section === "posts" ? "博客文章" : "搜索引擎"} JSON。`, true);
  refreshChrome();
}

function exportFullBackup() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sites: state.sites,
    posts: state.posts,
    searchEngines: state.searchEngines,
  };
  const filename = `backup-all-${formatFileDate(new Date())}.json`;
  downloadJson(filename, payload);
  setStatus("success", "已导出整站备份 JSON。", true);
  refreshChrome();
}

async function importJsonFile(file) {
  if (!file) {
    return;
  }

  const text = await file.text();
  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("JSON 文件格式不正确，无法解析。");
  }

  if (!window.confirm("导入 JSON 会替换其中包含的站点或博客数据。是否继续？")) {
    return;
  }

  const importedSections = [];

  if (Array.isArray(payload)) {
    applyImportedSection(state.section, payload);
    importedSections.push(state.section);
  } else if (payload && typeof payload === "object") {
    if (payload.section && Array.isArray(payload.items)) {
      applyImportedSection(payload.section, payload.items);
      importedSections.push(payload.section);
    }

    if (Array.isArray(payload.sites)) {
      applyImportedSection("sites", payload.sites);
      importedSections.push("sites");
    }

    if (Array.isArray(payload.posts)) {
      applyImportedSection("posts", payload.posts);
      importedSections.push("posts");
    }

    if (Array.isArray(payload.searchEngines)) {
      applyImportedSection("searchEngines", payload.searchEngines);
      importedSections.push("searchEngines");
    }
  }

  if (importedSections.length === 0) {
    throw new Error("没有识别到可导入的 sites/posts/searchEngines 数据。");
  }

  syncSelections();
  setStatus("success", `已导入 ${formatImportedSections(importedSections)}，记得保存对应分类。`, true);
  render();
}

function runDuplicateScan() {
  const groups = findDuplicateUrlGroups(state.sites);
  state.diagnostics.duplicates = groups;
  setStatus("success", groups.length > 0 ? `发现 ${groups.length} 组重复链接。` : "没有发现重复链接。", true);
}

async function runLinkCheck() {
  if (state.section !== "sites") {
    return;
  }

  state.diagnostics.running = true;
  render();

  const response = await fetch("/api/site-health", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(state.sites),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `检测失败：${response.status}`);
  }

  state.diagnostics.linkResults = Array.isArray(result.results) ? result.results : [];
  state.diagnostics.checkedAt = typeof result.checkedAt === "string" ? result.checkedAt : new Date().toISOString();
  state.diagnostics.running = false;
  const okCount = state.diagnostics.linkResults.filter((item) => item.ok).length;
  const failCount = state.diagnostics.linkResults.length - okCount;
  setStatus("success", `死链检测完成：${okCount} 个正常，${failCount} 个异常。`, true);
  render();
}

function findDuplicateUrlGroups(sites) {
  const groups = new Map();

  for (const site of sites) {
    const normalizedUrl = normalizeUrlForCompare(site.url);
    if (!normalizedUrl) {
      continue;
    }

    const items = groups.get(normalizedUrl) || [];
    items.push(site);
    groups.set(normalizedUrl, items);
  }

  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([url, items]) => ({ url, items }))
    .sort((left, right) => right.items.length - left.items.length || left.url.localeCompare(right.url, "zh-CN"));
}

async function importBookmarkFile(file) {
  if (!file) {
    return;
  }

  const text = await file.text();
  const importedSites = parseBookmarkHtml(text);
  if (importedSites.length === 0) {
    throw new Error("没有从书签 HTML 里识别到可导入的网站链接。");
  }

  const mergeResult = mergeImportedSites(state.sites, importedSites);
  if (mergeResult.added === 0) {
    throw new Error(`识别到 ${importedSites.length} 个书签，但都和现有链接重复。`);
  }

  state.sites = mergeResult.sites;
  state.selectedSiteId = mergeResult.firstAddedId || state.sites[0]?.id || "";
  state.renameCategorySource = getSelectedSiteCategory();
  state.dirty.sites = true;
  resetSiteDiagnostics();
  setStatus("success", `已导入 ${mergeResult.added} 个书签网站，跳过 ${mergeResult.skipped} 个重复链接，记得保存网站分类。`, true);
  render();
}

async function importPostMarkdown() {
  if (state.section !== "posts") {
    throw new Error("只有博客分类支持导入 Markdown 文件。");
  }

  const post = getSelectedItem();
  if (!post) {
    throw new Error("请先选择一篇文章，再导入 Markdown 文件。");
  }

  setStatus("info", "正在读取 Markdown 文件并处理图片...", false);
  render();

  const response = await fetch("/api/import-post-markdown", {
    method: "POST",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `导入失败：${response.status}`);
  }

  const imported = normalizeImportedMarkdownPayload(result);
  const importedFields = [];

  post.content = imported.content;

  if (imported.title) {
    post.title = imported.title;
    importedFields.push("标题");
  }
  if (imported.summary) {
    post.summary = imported.summary;
    importedFields.push("摘要");
  }
  if (imported.publishedAt) {
    post.publishedAt = imported.publishedAt;
    importedFields.push("发布日期");
  }
  if (imported.tags.length > 0) {
    post.tags = imported.tags;
    importedFields.push("标签");
  }

  if (!post.id || /^post-\d+$/.test(post.id)) {
    const nextId = createUniquePostTimestampId(post.id);
    post.id = nextId;
    setSelectedId(nextId);
    importedFields.push("ID");
  }

  if (!post.title) {
    post.title = imported.fileBaseName;
  }

  state.dirty.posts = true;
  setStatus(
    "success",
    importedFields.length > 0
      ? `已导入 Markdown 文件，并更新${importedFields.join("、")}；已处理 ${imported.assetCount} 张图片。记得保存博客分类。`
      : `已导入 Markdown 正文；已处理 ${imported.assetCount} 张图片。记得保存博客分类。`,
    true,
  );
  render();
}

function applyImportedSection(section, items) {
  if (section === "sites") {
    const sites = items.map(normalizeSite);
    validateBeforeSave(sites, "sites");
    state.sites = sites;
    state.renameCategorySource = getSelectedSiteCategory();
    state.dirty.sites = true;
    resetSiteDiagnostics();
    return;
  }

  if (section === "posts") {
    const posts = items.map(normalizePost);
    validateBeforeSave(posts, "posts");
    state.posts = posts;
    state.dirty.posts = true;
    return;
  }

  if (section === "searchEngines") {
    const searchEngines = sortSearchEnginesByPriority(items.map(normalizeSearchEngine));
    validateBeforeSave(searchEngines, "searchEngines");
    state.searchEngines = searchEngines;
    state.dirty.searchEngines = true;
    return;
  }

  throw new Error(`不支持的导入分类：${section}`);
}

function mergeImportedSites(existingSites, importedSites) {
  const urlSet = new Set(existingSites.map((site) => normalizeUrlForCompare(site.url)));
  const idSet = new Set(existingSites.map((site) => site.id));
  const nextSites = [...existingSites];
  let added = 0;
  let skipped = 0;
  let firstAddedId = "";

  for (const site of importedSites) {
    const normalizedUrl = normalizeUrlForCompare(site.url);
    if (!normalizedUrl || urlSet.has(normalizedUrl)) {
      skipped += 1;
      continue;
    }

    const uniqueId = createUniqueId(site.id || slugify(site.name) || "bookmark", idSet);
    const nextSite = {
      ...site,
      id: uniqueId,
    };

    nextSites.unshift(normalizeSite(nextSite));
    urlSet.add(normalizedUrl);
    idSet.add(uniqueId);
    added += 1;
    if (!firstAddedId) {
      firstAddedId = uniqueId;
    }
  }

  return { sites: nextSites, added, skipped, firstAddedId };
}

function parseBookmarkHtml(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");
  const anchors = Array.from(doc.querySelectorAll("a[href]"));
  const usedIds = new Set();

  return anchors
    .map((anchor, index) => createSiteFromBookmark(anchor, index, usedIds))
    .filter(Boolean);
}

function createSiteFromBookmark(anchor, index, usedIds) {
  const href = String(anchor.getAttribute("href") || "").trim();
  if (!href || !/^https?:\/\//i.test(href)) {
    return null;
  }

  const host = getHost(href);
  const name = String(anchor.textContent || "").trim() || host || `书签-${index + 1}`;
  const folders = getBookmarkFolders(anchor);
  const category = folders[0] || "导入书签";
  const tags = Array.from(new Set(["导入", ...folders.slice(1).filter(Boolean)]));
  const idBase = slugify(name) || slugify(host) || `bookmark-${index + 1}`;
  const id = createUniqueId(idBase, usedIds);
  const descriptionSource = folders.length > 0 ? folders.join(" / ") : host || href;

  return normalizeSite({
    id,
    name,
    url: href,
    category,
    tags,
    icon: "",
    description: `从书签导入：${descriptionSource}`,
    aliases: host ? [host] : [],
  });
}

function getBookmarkFolders(anchor) {
  const folders = [];
  let node = anchor.parentElement;

  while (node) {
    if (node.tagName === "DL") {
      const labelHolder = node.previousElementSibling;
      const heading = labelHolder?.querySelector("h3");
      const folder = String(heading?.textContent || "").trim();
      if (folder) {
        folders.push(folder);
      }
    }
    node = node.parentElement;
  }

  return folders.reverse();
}

function validateBeforeSave(payload, section) {
  if (section === "sites") {
    normalizeSitesForSave(payload);
    validateSitesPayload(payload);
    return;
  }

  if (section === "posts") {
    validatePostsPayload(payload);
    return;
  }

  validateSearchEnginesPayload(payload);
}

function normalizeImportedMarkdownPayload(payload) {
  return {
    title: String(payload?.title || "").trim(),
    summary: String(payload?.summary || "").trim(),
    publishedAt: String(payload?.publishedAt || "").trim(),
    tags: normalizeStringList(payload?.tags),
    content: normalizePostContent(payload?.content),
    fileBaseName: String(payload?.fileBaseName || "").trim(),
    assetCount: Number.isFinite(payload?.assetCount) ? payload.assetCount : 0,
  };
}

function normalizeSite(site = {}) {
  return {
    id: String(site.id || "").trim(),
    name: String(site.name || "").trim(),
    url: String(site.url || "").trim(),
    category: String(site.category || "").trim(),
    tags: normalizeStringList(site.tags),
    icon: typeof site.icon === "string" ? site.icon.trim() : "",
    description: String(site.description || "").trim(),
    aliases: normalizeStringList(site.aliases),
  };
}

function normalizePost(post = {}) {
  return {
    id: String(post.id || "").trim(),
    title: String(post.title || "").trim(),
    summary: String(post.summary || "").trim(),
    publishedAt: String(post.publishedAt || "").trim(),
    tags: normalizeStringList(post.tags),
    content: normalizePostContent(post.content),
  };
}

function normalizeSearchEngine(engine = {}) {
  return {
    id: String(engine.id || "").trim(),
    label: String(engine.label || "").trim(),
    priority: normalizeSearchEnginePriorityValue(engine.priority),
    placeholder: String(engine.placeholder || "").trim(),
    urlTemplate: String(engine.urlTemplate || "").trim(),
  };
}

function normalizeSearchEnginePriorityValue(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const priority = Number.parseInt(text, 10);
  if (!Number.isInteger(priority) || priority < 1 || priority > 99) {
    return null;
  }

  return priority;
}

function assignSequentialSearchEnginePriorities(searchEngines) {
  return searchEngines.map((engine, index) => ({
    ...engine,
    priority: index + 1,
  }));
}

function sortSearchEnginesByPriority(searchEngines) {
  return [...searchEngines].sort((left, right) => {
    const leftPriority = Number.isInteger(left?.priority) ? left.priority : 999;
    const rightPriority = Number.isInteger(right?.priority) ? right.priority : 999;
    return leftPriority - rightPriority || compareText(left?.label || "", right?.label || "") || compareText(left?.id || "", right?.id || "");
  });
}

function getNextSearchEnginePriority() {
  const used = new Set(
    state.searchEngines
      .map((engine) => normalizeSearchEnginePriorityValue(engine?.priority))
      .filter(Number.isInteger),
  );

  for (let priority = 1; priority <= 99; priority += 1) {
    if (!used.has(priority)) {
      return priority;
    }
  }

  return state.searchEngines.length + 1;
}

function reorderSearchEngine(sourceId, targetId, position) {
  const items = [...state.searchEngines];
  const sourceIndex = items.findIndex((engine) => engine.id === sourceId);
  const targetIndex = items.findIndex((engine) => engine.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    state.draggingSearchEngineId = "";
    render();
    return;
  }

  const [moved] = items.splice(sourceIndex, 1);
  const nextTargetIndex = items.findIndex((engine) => engine.id === targetId);
  const insertIndex = position === "after" ? nextTargetIndex + 1 : nextTargetIndex;
  items.splice(insertIndex, 0, moved);

  state.searchEngines = assignSequentialSearchEnginePriorities(items);
  state.selectedSearchEngineId = moved.id;
  state.dirty.searchEngines = true;
  state.draggingSearchEngineId = "";
  setStatus("info", "已调整搜索引擎顺序，记得保存当前分类。", false);
  render();
}

function getExistingSiteCategories() {
  return Array.from(new Set(
    state.sites
      .map((site) => String(site.category || "").trim())
      .filter(Boolean)
  )).sort(compareText);
}

function getExistingTags(section) {
  const items = section === "sites" ? state.sites : state.posts;
  return Array.from(new Set(
    items
      .flatMap((item) => (Array.isArray(item.tags) ? item.tags : []))
      .map((tag) => String(tag || "").trim())
      .filter(Boolean)
  )).sort(compareText);
}

function renderOptionList(options, currentValue = "", excludedValues = new Set()) {
  return options
    .filter((option) => option !== currentValue && !excludedValues.has(option))
    .map((option) => `<option value="${escapeAttr(option)}">${escapeHTML(option)}</option>`)
    .join("");
}

function syncSelections() {
  if (!state.sites.some((site) => site.id === state.selectedSiteId)) {
    state.selectedSiteId = state.sites[0]?.id || "";
  }

  if (!state.posts.some((post) => post.id === state.selectedPostId)) {
    state.selectedPostId = state.posts[0]?.id || "";
  }

  if (!state.searchEngines.some((engine) => engine.id === state.selectedSearchEngineId)) {
    state.selectedSearchEngineId = state.searchEngines[0]?.id || "";
  }
}

function restoreEditorStateAfterRender() {
  if (pendingEditorScrollY === null && !pendingIconSearchSelection) {
    return;
  }

  const scrollY = pendingEditorScrollY;
  const selection = pendingIconSearchSelection;
  pendingEditorScrollY = null;
  pendingIconSearchSelection = null;

  requestAnimationFrame(() => {
    if (typeof scrollY === "number") {
      window.scrollTo({ top: scrollY, behavior: "auto" });
    }

    if (!selection) {
      return;
    }

    const input = root.querySelector('[data-role="icon-search"]');
    if (!input) {
      return;
    }

    input.focus({ preventScroll: true });
    const end = Math.min(selection.end, input.value.length);
    const start = Math.min(selection.start, end);
    input.setSelectionRange(start, end);
  });
}

function getSelectedSiteCategory(siteId = state.selectedSiteId) {
  const site = state.sites.find((entry) => entry.id === siteId);
  return String(site?.category || "").trim();
}

function createUniqueId(base, usedIds) {
  const normalizedBase = slugify(base) || "item";
  let candidate = normalizedBase;
  let index = 2;

  while (usedIds.has(candidate)) {
    candidate = `${normalizedBase}-${index}`;
    index += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function normalizeUrlForCompare(url) {
  try {
    const parsed = new URL(String(url || "").trim());
    parsed.hash = "";
    if (parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }
    return parsed.toString();
  } catch {
    return String(url || "").trim();
  }
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatImportedSections(sections) {
  const labels = Array.from(new Set(sections)).map((section) => (section === "sites" ? "网站" : section === "posts" ? "博客" : "搜索引擎"));
  return labels.join("和");
}

function formatFileDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join("");
}

function getHost(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function splitCommaList(value) {
  return String(value || "")
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEditableUrlValue(value) {
  let text = String(value || "");
  while (/^https?:\/\/https?:\/\//i.test(text)) {
    text = text.replace(/^https?:\/\//i, "");
  }
  return text;
}

function normalizeSiteUrlValue(value) {
  const text = normalizeEditableUrlValue(value).trim();
  if (!text || /^[a-z][a-z\d+.-]*:\/\//i.test(text)) {
    return text;
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(text)) {
    return text;
  }

  return `https://${text}`;
}

function normalizeSitesForSave(sites) {
  if (!Array.isArray(sites)) {
    return;
  }

  for (const site of sites) {
    if (!site || typeof site !== "object") {
      continue;
    }
    site.url = normalizeSiteUrlValue(site.url);
  }
}

function slugify(value) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return slug;
}

function compareText(left, right) {
  return left.localeCompare(right, "zh-CN");
}

function resetSiteDiagnostics() {
  state.diagnostics.duplicates = [];
  state.diagnostics.linkResults = [];
  state.diagnostics.running = false;
  state.diagnostics.checkedAt = "";
}

function formatDate(value) {
  if (!value) {
    return "未设置日期";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "未检测";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function refreshChrome() {
  refs.sectionTabs.innerHTML = renderSectionTabs();
  refs.list.innerHTML = renderList();
  refs.status.className = `status-bar ${state.status.type === "error" ? "is-error" : state.status.type === "success" ? "is-success" : ""}`.trim();
  refs.status.textContent = state.status.text;
}

function setStatus(type, text, keep = true) {
  state.status = { type, text };
  if (!keep && type === "success") {
    state.status.type = "info";
  }
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHTML(value).replace(/\n/g, "&#10;");
}


