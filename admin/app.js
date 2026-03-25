const state = {
  section: "sites",
  filter: "",
  sites: [],
  posts: [],
  selectedSiteId: "",
  selectedPostId: "",
  diagnostics: {
    duplicates: [],
    linkResults: [],
    running: false,
    checkedAt: "",
  },
  dirty: {
    sites: false,
    posts: false,
  },
  status: {
    type: "info",
    text: "正在读取本地内容文件...",
  },
};

const root = document.querySelector("#app");
const refs = {};

init().catch((error) => {
  root.innerHTML = `<div class="panel empty-state">启动失败：${escapeHTML(error.message)}</div>`;
});

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

  await loadContent();
  render();
}

function createShell() {
  return `
    <div class="admin-shell">
      <header class="panel hero">
        <div>
          <h1>本地内容管理器</h1>
          <p>这个页面只在你本机运行，用来编辑站点条目和博客文章。保存后会直接改写 <code>src/data/sites.js</code> 和 <code>src/data/posts.js</code>。</p>
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
          </div>
          <p class="helper hero__helper">JSON 可恢复站点和博客；书签 HTML 只会导入网站，并且默认跳过重复链接。</p>
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
  syncSelections();
  resetSiteDiagnostics();
  state.dirty.sites = false;
  state.dirty.posts = false;
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
  root.querySelector('[data-role="editor-title"]').textContent = state.section === "sites" ? "网站编辑器" : "博客编辑器";
  root.querySelector('[data-role="editor-subtitle"]').textContent = state.section === "sites"
    ? "维护导航站里的网站条目，图标路径填 public/icon 下的相对路径。"
    : "维护站内博客文章。正文用空行分段保存。";
}

function renderSectionTabs() {
  const items = [
    { value: "sites", label: `网站 (${state.sites.length})` },
    { value: "posts", label: `博客 (${state.posts.length})` },
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
    <button type="button" class="primary-button" data-action="create-item">${isSites ? "新建网站" : "新建文章"}</button>
    <button type="button" class="danger-button" data-action="delete-item">${isSites ? "删除网站" : "删除文章"}</button>
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
  const secondary = isSites
    ? `${item.category || "未分类"} · ${(item.tags || []).join(" / ") || "无标签"}`
    : `${formatDate(item.publishedAt)} · ${(item.tags || []).join(" / ") || "无标签"}`;
  const preview = isSites ? item.description : item.summary;

  return `
    <button type="button" class="list-item ${isActive ? "is-active" : ""}" data-action="select-item" data-id="${escapeHTML(item.id)}">
      <strong>${escapeHTML(isSites ? item.name || "未命名网站" : item.title || "未命名文章")}</strong>
      <span>${escapeHTML(secondary)}</span>
      <span>${escapeHTML(preview || "暂无说明")}</span>
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

  return renderPostEditor(item);
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
        <input id="site-url" data-field="url" value="${escapeAttr(site.url)}">
      </div>
      <div class="field">
        <label for="site-category">分类</label>
        <input id="site-category" data-field="category" value="${escapeAttr(site.category)}" placeholder="可直接自定义输入">
        <select data-action="pick-category">
          <option value="">选择已有分类</option>
          ${categoryOptions}
        </select>
        <span class="helper">上面可自定义，下面可直接选当前已有分类。</span>
      </div>
      <div class="field">
        <label for="site-icon">图标路径</label>
        <input id="site-icon" data-field="icon" value="${escapeAttr(site.icon || "")}">
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
        <span class="helper">icon 为空时，页面会自动生成占位图标。ID 建议只用英文、数字和短横线。</span>
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
        <label for="post-content">正文（空行分段）</label>
        <textarea id="post-content" data-field="content" style="min-height: 320px;">${escapeHTML((post.content || []).join("\n\n"))}</textarea>
      </div>
      <div class="field field--full">
        <span class="helper">每个空行会被保存成一个段落。第一版不支持 Markdown，正文会按纯文本段落渲染。</span>
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
    render();
    return;
  }

  if (action === "select-item") {
    setSelectedId(id);
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

  if (action === "generate-id") {
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
  } else {
    applyPostField(item, field, value);
    state.dirty.posts = true;
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

function applySiteField(site, field, value) {
  if (field === "tags" || field === "aliases") {
    site[field] = splitCommaList(value);
    return;
  }

  site[field] = value;
}

function applyPostField(post, field, value) {
  if (field === "tags") {
    post.tags = splitCommaList(value);
    return;
  }

  if (field === "content") {
    post.content = splitParagraphs(value);
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
  const items = state.section === "sites" ? state.sites : state.posts;
  if (!keyword) {
    return items;
  }

  return items.filter((item) => {
    const source = state.section === "sites"
      ? [item.name, item.category, item.description, ...(item.tags || []), ...(item.aliases || [])]
      : [item.title, item.summary, item.publishedAt, ...(item.tags || []), ...(item.content || [])];
    return source.join(" ").toLowerCase().includes(keyword);
  });
}

function getSelectedItem() {
  const selectedId = getSelectedId();
  const items = state.section === "sites" ? state.sites : state.posts;
  return items.find((item) => item.id === selectedId) || null;
}

function getSelectedId() {
  return state.section === "sites" ? state.selectedSiteId : state.selectedPostId;
}

function setSelectedId(id) {
  if (state.section === "sites") {
    state.selectedSiteId = id;
  } else {
    state.selectedPostId = id;
  }
}

function createItem() {
  if (state.section === "sites") {
    const site = {
      id: `site-${Date.now()}`,
      name: "",
      url: "https://",
      category: "未分类",
      tags: [],
      icon: "",
      description: "",
      aliases: [],
    };
    state.sites = [site, ...state.sites];
    state.selectedSiteId = site.id;
    state.dirty.sites = true;
    resetSiteDiagnostics();
    setStatus("info", "已创建新网站草稿。", false);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const post = {
    id: `post-${Date.now()}`,
    title: "",
    summary: "",
    publishedAt: today,
    tags: [],
    content: [],
  };
  state.posts = [post, ...state.posts];
  state.selectedPostId = post.id;
  state.dirty.posts = true;
  setStatus("info", "已创建新文章草稿。", false);
}

function deleteItem() {
  const item = getSelectedItem();
  if (!item) {
    setStatus("error", "当前没有可删除的内容。");
    return;
  }

  const label = state.section === "sites" ? item.name || item.id : item.title || item.id;
  if (!window.confirm(`确定删除“${label}”吗？删除后会在保存时写回文件。`)) {
    return;
  }

  if (state.section === "sites") {
    state.sites = state.sites.filter((site) => site.id !== item.id);
    state.selectedSiteId = state.sites[0]?.id || "";
    state.dirty.sites = true;
    resetSiteDiagnostics();
  } else {
    state.posts = state.posts.filter((post) => post.id !== item.id);
    state.selectedPostId = state.posts[0]?.id || "";
    state.dirty.posts = true;
  }

  setStatus("info", "已删除当前内容，记得保存当前分类。", false);
}

function generateId() {
  const item = getSelectedItem();
  if (!item) {
    return;
  }

  const source = state.section === "sites" ? item.name : item.title;
  const slug = slugify(source);
  item.id = slug || `${state.section === "sites" ? "site" : "post"}-${Date.now()}`;
  state.dirty[state.section] = true;
  setStatus("info", "已根据当前标题生成 ID。", false);
}

async function saveSection() {
  const target = state.section === "sites" ? "/api/sites" : "/api/posts";
  const payload = state.section === "sites" ? state.sites : state.posts;

  validateBeforeSave(payload, state.section);

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

  state.dirty[state.section] = false;
  setStatus("success", `已保存${state.section === "sites" ? "网站" : "博客文章"}到本地文件。`, true);
  render();
}

function exportCurrentSection() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    section: state.section,
    items: state.section === "sites" ? state.sites : state.posts,
  };
  const filename = `backup-${state.section}-${formatFileDate(new Date())}.json`;
  downloadJson(filename, payload);
  setStatus("success", `已导出${state.section === "sites" ? "网站" : "博客文章"} JSON。`, true);
  refreshChrome();
}

function exportFullBackup() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sites: state.sites,
    posts: state.posts,
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
  }

  if (importedSections.length === 0) {
    throw new Error("没有识别到可导入的 sites/posts 数据。");
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
  state.dirty.sites = true;
  resetSiteDiagnostics();
  setStatus("success", `已导入 ${mergeResult.added} 个书签网站，跳过 ${mergeResult.skipped} 个重复链接，记得保存网站分类。`, true);
  render();
}

function applyImportedSection(section, items) {
  if (section === "sites") {
    const sites = items.map(normalizeSite);
    validateBeforeSave(sites, "sites");
    state.sites = sites;
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
  const ids = new Set();
  for (const item of payload) {
    const id = String(item.id || "").trim();
    if (!id) {
      throw new Error("ID 不能为空");
    }
    if (ids.has(id)) {
      throw new Error(`ID 重复：${id}`);
    }
    ids.add(id);

    if (section === "sites") {
      if (!String(item.name || "").trim()) {
        throw new Error(`站点 ${id} 缺少名称`);
      }
      if (!String(item.url || "").trim()) {
        throw new Error(`站点 ${id} 缺少链接`);
      }
      if (!String(item.category || "").trim()) {
        throw new Error(`站点 ${id} 缺少分类`);
      }
    } else {
      if (!String(item.title || "").trim()) {
        throw new Error(`文章 ${id} 缺少标题`);
      }
      if (!String(item.publishedAt || "").trim()) {
        throw new Error(`文章 ${id} 缺少发布日期`);
      }
    }
  }
}

function normalizeSite(site = {}) {
  return {
    id: String(site.id || "").trim(),
    name: String(site.name || "").trim(),
    url: String(site.url || "").trim(),
    category: String(site.category || "").trim(),
    tags: normalizeStringArray(site.tags),
    icon: typeof site.icon === "string" ? site.icon.trim() : "",
    description: String(site.description || "").trim(),
    aliases: normalizeStringArray(site.aliases),
  };
}

function normalizePost(post = {}) {
  return {
    id: String(post.id || "").trim(),
    title: String(post.title || "").trim(),
    summary: String(post.summary || "").trim(),
    publishedAt: String(post.publishedAt || "").trim(),
    tags: normalizeStringArray(post.tags),
    content: normalizeStringArray(post.content),
  };
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return splitCommaList(value);
  }

  return [];
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
  const labels = Array.from(new Set(sections)).map((section) => (section === "sites" ? "网站" : "博客"));
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

function splitParagraphs(value) {
  return value
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
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






