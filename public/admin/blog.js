import { createMarkdownEditor } from "./markdown-editor.js?v=20260904-mode-toggle";

export function createBlogManager({ root, tabs, sitesPanel, request, toast }) {
  let posts = [];
  let current = null;
  let baseline = "";
  let loaded = false;
  let busy = false;
  let generation = 0;
  let publishCommit = "";
  let pollTimer;
  let pollCount = 0;
  let mode = "visual";

  root.innerHTML = `
    <div class="blog-toolbar">
      <h2>博客 <span class="blog-count" data-blog-role="count"></span></h2>
      <div class="actions">
        <button class="button" type="button" data-blog-action="reload">刷新列表</button>
        <button class="button primary" type="button" data-blog-action="new">新建文章</button>
      </div>
    </div>
    <div class="blog-publish-row">
      <span class="blog-publish-status" data-blog-role="publish-status" role="status">尚未查询发布状态</span>
      <div class="actions">
        <a class="hidden" data-blog-role="publish-link" target="_blank" rel="noopener noreferrer">查看发布记录</a>
        <button class="button" type="button" data-blog-action="check-publish">刷新发布状态</button>
      </div>
    </div>
    <p class="blog-status" data-blog-role="status" role="status" aria-live="polite"></p>
    <div class="blog-workspace">
      <aside class="blog-sidebar">
        <label>搜索文章<input type="search" data-blog-role="search" autocomplete="off" placeholder="标题、摘要、标签"></label>
        <div class="blog-list" data-blog-role="list"></div>
      </aside>
      <div class="blog-editor">
        <p class="blog-empty" data-blog-role="empty">未选中文章</p>
        <form class="hidden" data-blog-role="form" autocomplete="off" novalidate>
          <fieldset>
            <div class="blog-editor-heading">
              <h2 data-blog-role="editor-title">编辑文章</h2>
              <span class="blog-dirty" data-blog-role="dirty"></span>
            </div>
            <div class="blog-editor-fields">
              <label>标题<input name="blog-post-title" data-blog-field="title" maxlength="200" required></label>
              <div class="grid-2">
                <label>文章 ID<input name="blog-post-id" data-blog-field="id" pattern="[a-z0-9][a-z0-9-]{0,79}" maxlength="80" required></label>
                <label>发布日期<input name="blog-post-date" data-blog-field="publishedAt" type="date" required></label>
              </div>
              <label>标签<input name="blog-post-tags" data-blog-field="tags" placeholder="用逗号分隔" maxlength="1800"></label>
              <label>摘要<textarea name="blog-post-summary" data-blog-field="summary" maxlength="1000" required></textarea></label>
              <div class="blog-content-editor">
                <div class="blog-mode-fallback"><div class="blog-editor-mode-slot" data-blog-role="mode-control"><button type="button" class="button blog-mode-toggle" data-blog-action="toggle-mode" title="切换到 Markdown 源码">Markdown 源码</button></div></div>
                <p class="blog-editor-loading hidden" data-blog-role="editor-loading" role="status">正在加载编辑器…</p>
                <div class="blog-visual-panel" data-blog-role="visual-panel">
                  <div class="blog-visual-editor" data-blog-role="visual-editor"></div>
                </div>
                <div class="hidden" data-blog-role="content-label"><textarea aria-label="Markdown 正文" name="blog-post-content" data-blog-field="content" spellcheck="false" required></textarea></div>
              </div>
            </div>
            <div class="blog-editor-actions">
              <div class="actions">
                <button type="submit" class="button primary" data-blog-action="save">保存并发布</button>
                <a class="button" data-blog-role="view-post" target="_blank" rel="noopener noreferrer">查看线上文章</a>
              </div>
              <button type="button" class="button danger" data-blog-action="delete">删除文章</button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>`;

  const byRole = (name) => root.querySelector(`[data-blog-role="${name}"]`);
  const form = byRole("form");
  const fields = Object.fromEntries([...root.querySelectorAll("[data-blog-field]")].map((input) => [input.dataset.blogField, input]));
  const list = byRole("list");
  const markdownEditor = createMarkdownEditor({
    source: fields.content, container: byRole("visual-editor"), modeControl: byRole("mode-control"), onChange: updateControls,
  });

  function readForm() {
    markdownEditor.flush();
    return {
      id: fields.id.value.trim(), title: fields.title.value.trim(),
      publishedAt: fields.publishedAt.value, summary: fields.summary.value.trim(),
      tags: [...new Set(fields.tags.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))],
      content: fields.content.value.trim(),
    };
  }

  function isDirty() { return Boolean(current) && JSON.stringify(readForm()) !== baseline; }

  function canLeave() {
    if (busy) { toast("正在处理文章，请稍等。", "busy"); return false; }
    return !isDirty() || window.confirm("文章有未保存的修改，确定放弃这些修改吗？");
  }

  function setStatus(message, error = false) {
    byRole("status").textContent = message;
    byRole("status").dataset.error = String(error);
  }

  function updateControls() {
    const dirty = isDirty();
    form.querySelector("fieldset").disabled = busy;
    root.querySelectorAll("button[data-blog-action], button[data-blog-id]").forEach((button) => { button.disabled = busy; });
    markdownEditor.setDisabled(busy);
    root.querySelector('[data-blog-action="delete"]').disabled = busy || !current?.sha;
    byRole("dirty").textContent = busy ? "处理中…" : dirty ? "未保存" : current?.sha ? "已保存" : "新文章";
    byRole("dirty").dataset.dirty = String(dirty);
    byRole("view-post").setAttribute("aria-disabled", String(!current?.sha));
    if (current?.sha) byRole("view-post").href = `/?post=${encodeURIComponent(current.post.id)}`;
    else byRole("view-post").removeAttribute("href");
  }

  async function run(task) {
    if (busy) return;
    busy = true;
    const started = generation;
    updateControls();
    try { await task(started); }
    catch (error) {
      if (started !== generation) return;
      const message = error.message || "操作失败，请稍后重试。";
      setStatus(message, true);
      toast(message, "error");
    } finally {
      if (started === generation) { busy = false; updateControls(); }
    }
  }

  function renderList() {
    const query = byRole("search").value.trim().toLocaleLowerCase();
    const filtered = posts.filter((post) => [post.title, post.summary, ...(post.tags || [])].join(" ").toLocaleLowerCase().includes(query));
    byRole("count").textContent = String(posts.length);
    list.innerHTML = filtered.map((post) => `
      <button type="button" class="blog-list-item" data-blog-id="${escapeHtml(post.id)}" aria-current="${current?.post.id === post.id}">
        <strong>${escapeHtml(post.title)}</strong><span>${escapeHtml(post.publishedAt)}</span>
      </button>`).join("") || `<p class="blog-empty">${loaded ? "没有匹配的文章。" : "文章尚未加载。"}</p>`;
    updateControls();
  }

  function setMode(nextMode) {
    mode = nextMode;
    const visual = mode === "visual";
    if (!visual) markdownEditor.showSource();
    byRole("content-label").classList.toggle("hidden", mode !== "source");
    byRole("visual-panel").classList.toggle("hidden", mode === "loading");
    byRole("visual-editor").classList.toggle("is-source", mode === "source");
    byRole("editor-loading").classList.toggle("hidden", mode !== "loading");
    const toggle = root.querySelector('[data-blog-action="toggle-mode"]');
    toggle.textContent = mode === "source" ? "可视化编辑" : "Markdown 源码";
    toggle.title = `切换到 ${toggle.textContent}`;
  }

  async function showVisual(started) {
    try {
      const ready = await markdownEditor.showVisual();
      if (!ready || started !== generation) return false;
      setMode("visual");
      return true;
    } catch (error) {
      if (started === generation) setMode("source");
      throw error;
    }
  }

  function setForm(data) {
    current = data;
    form.classList.toggle("hidden", !data);
    byRole("empty").classList.toggle("hidden", Boolean(data));
    markdownEditor.reset();
    setMode(data ? "loading" : "source");
    if (data) {
      for (const [name, input] of Object.entries(fields)) input.value = name === "tags" ? data.post.tags.join(", ") : data.post[name];
      fields.id.readOnly = Boolean(data.sha);
      byRole("editor-title").textContent = data.sha ? "编辑文章" : "新建文章";
      baseline = JSON.stringify(readForm());
    } else { baseline = ""; form.reset(); }
    renderList();
  }

  async function openPost(id, started) {
    setStatus("正在读取文章…");
    const data = await request({ action: "get", id });
    if (started !== generation) return;
    setForm(data);
    setStatus("");
    await showVisual(started);
  }

  async function loadPosts(started) {
    setStatus("正在加载文章…");
    const data = await request({ action: "list" });
    if (started !== generation) return;
    posts = data.posts;
    loaded = true;
    renderList();
    setStatus("");
    if (!current && posts.length) await openPost(posts[0].id, started);
  }

  function setSection(section) {
    const blogVisible = section === "blog";
    root.classList.toggle("hidden", !blogVisible);
    sitesPanel.classList.toggle("hidden", blogVisible);
    tabs.querySelectorAll("[data-admin-section]").forEach((button) => {
      const selected = button.dataset.adminSection === section;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    if (blogVisible && !loaded) run(loadPosts);
    if (blogVisible) checkPublish(Boolean(publishCommit));
  }

  async function checkPublish(repeat = false) {
    clearTimeout(pollTimer);
    const started = generation;
    const commit = publishCommit;
    try {
      const { deployment } = await request({ action: "status", ...(commit ? { commit } : {}) });
      if (started !== generation || commit !== publishCommit) return;
      const status = byRole("publish-status");
      const link = byRole("publish-link");
      const validUrl = deployment?.url?.startsWith("https://github.com/KingStar-China/KingStar-China.GitHub.io/actions/runs/");
      link.classList.toggle("hidden", !validUrl);
      if (validUrl) link.href = deployment.url;
      else link.removeAttribute("href");
      if (!deployment) status.textContent = commit ? "已保存，等待发布任务启动" : "暂无发布记录";
      else if (deployment.status !== "completed") status.textContent = "正在构建并发布…";
      else if (deployment.conclusion === "success") status.textContent = "已发布上线";
      else if (deployment.conclusion === "cancelled") status.textContent = "此次发布已取消，请查看最新发布记录";
      else status.textContent = "文章已保存，发布失败，请查看发布记录";
      if (repeat && (!deployment || deployment.status !== "completed") && ++pollCount < 36) {
        pollTimer = setTimeout(() => checkPublish(true), 10000);
      }
    } catch {
      if (started === generation && commit === publishCommit) byRole("publish-status").textContent = "暂时无法获取发布状态，请稍后刷新";
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    // Editor popovers can contain their own buttons; only this command publishes a post.
    if (event.submitter !== root.querySelector('[data-blog-action="save"]')) return;
    if (busy || markdownEditor.isComposing()) return;
    markdownEditor.flush();
    if (!fields.content.validity.valid) setMode("source");
    if (!form.reportValidity() || !current) return;
    run(async (started) => {
      setStatus("正在保存文章…");
      const result = await request({ action: "save", post: readForm(), sha: current.sha });
      if (started !== generation) return;
      posts = posts.filter((post) => post.id !== result.post.id);
      const { content, ...metadata } = result.post;
      posts.push({ ...metadata, sha: result.sha });
      posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      setForm(result);
      setStatus(result.unchanged ? "内容与仓库一致，无需重复保存。" : "文章已保存，正在发布。上线进度见上方发布状态。");
      publishCommit = result.commit || publishCommit;
      pollCount = 0;
      checkPublish(true);
      await showVisual(started);
    });
  });

  root.addEventListener("input", (event) => {
    if (event.target === byRole("search")) renderList();
    else updateControls();
  });

  root.addEventListener("click", (event) => {
    const row = event.target.closest("[data-blog-id]");
    if (row && canLeave()) return void run((started) => openPost(row.dataset.blogId, started));
    const action = event.target.closest("[data-blog-action]")?.dataset.blogAction;
    if (!action || busy) return;
    if (action === "reload") run(loadPosts);
    if (action === "check-publish") { pollCount = 0; checkPublish(Boolean(publishCommit)); }
    if (action === "new" && canLeave()) run(async (started) => {
      const date = new Date();
      const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      setForm({ post: { id: String(Date.now()), title: "", summary: "", publishedAt: localDate, tags: [], content: "" }, sha: null });
      setStatus("");
      await showVisual(started);
      if (started === generation) fields.title.focus();
    });
    if (action === "toggle-mode") {
      if (mode === "visual") { setMode("source"); updateControls(); }
      else run(async (started) => { setMode("loading"); if (await showVisual(started)) setStatus(""); });
    }
    if (action === "delete" && current?.sha && window.confirm(`确定删除文章“${current.post.title}”并发布吗？`)) {
      run(async (started) => {
        const result = await request({ action: "delete", id: current.post.id, sha: current.sha });
        if (started !== generation) return;
        posts = posts.filter((post) => post.id !== result.id);
        setForm(null);
        setStatus("文章已删除，正在发布。");
        publishCommit = result.commit;
        pollCount = 0;
        checkPublish(true);
      });
    }
  });

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-admin-section]");
    if (button) setSection(button.dataset.adminSection);
  });
  tabs.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...tabs.querySelectorAll("[data-admin-section]")];
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
    setSection(buttons[next].dataset.adminSection);
  });
  window.addEventListener("beforeunload", (event) => {
    if (!isDirty() && !busy) return;
    event.preventDefault();
    event.returnValue = "";
  });

  function reset() {
    generation += 1;
    clearTimeout(pollTimer);
    posts = [];
    loaded = false;
    busy = false;
    publishCommit = "";
    byRole("search").value = "";
    byRole("publish-status").textContent = "尚未查询发布状态";
    byRole("publish-link").classList.add("hidden");
    setForm(null);
    setStatus("");
    setSection("sites");
  }

  reset();
  return { reset, canLeave };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
