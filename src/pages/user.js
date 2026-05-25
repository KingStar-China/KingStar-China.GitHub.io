export function renderUserStats({ state, createStatCard }) {
  return [
    createStatCard("账号状态", state.sync.signedIn ? "已登录" : "未登录"),
    createStatCard("我的站点", String(state.userSites.length)),
    createStatCard("同步状态", state.sync.enabled ? "可用" : "本地"),
    createStatCard("权限范围", "个人"),
  ].join("");
}

export function renderUserPage({ state, renderSyncCard, escapeHTML, getHost }) {
  return `
    <section class="user-portal">
      <div class="panel user-portal__intro">
        <p class="section-head__eyebrow">USER CENTER</p>
        <h2>用户中心</h2>
        <p>这里管理你的个人账号、个人站点、收藏、待办和云端同步。普通用户的内容只保存到自己的账号，不会改动全站公共导航。</p>
      </div>
      <div class="section-head user-portal__head">
        <div>
          <p class="section-head__eyebrow">ACCOUNT</p>
          <h2>我的账号</h2>
        </div>
        <a class="inline-reset" href="/admin/">站长后台说明</a>
      </div>
      <div class="user-portal__grid">
        ${renderSyncCard()}
        <article class="panel workbench-card workbench-card--sync">
          <div class="workbench-card__head">
            <div>
              <p class="section-head__eyebrow">ADMIN</p>
              <h2>站长后台说明</h2>
            </div>
            <span class="section-count">/admin</span>
          </div>
          <p class="workbench-helper">全站内容管理只在站长本机运行。请在项目目录执行 npm run admin:open，打开 http://127.0.0.1:3214/ 后编辑站点和博客。</p>
          <div class="sync-actions">
            <a class="workbench-button" href="/admin/">查看站长后台说明</a>
          </div>
        </article>
      </div>
      ${renderUserSitesManager({ state, escapeHTML, getHost })}
    </section>
  `;
}

function renderUserSitesManager({ state, escapeHTML, getHost }) {
  const disabled = !state.sync.signedIn || state.sync.busy ? "disabled" : "";
  const helper = state.sync.signedIn
    ? "自定义站点只保存到你的 Supabase 账号，不会写入全局站点文件。"
    : "登录云端同步后，可以添加只属于你的站点。";

  return `
    <section class="user-sites-manager">
      <div class="section-head user-sites-manager__head">
        <div>
          <p class="section-head__eyebrow">CUSTOM SITES</p>
          <h2>我的站点</h2>
        </div>
        <span class="section-count">${state.userSites.length}</span>
      </div>
      <div class="user-site-form">
        <input class="workbench-input" data-user-site-field="name" value="${escapeHTML(state.userSiteDraft.name)}" placeholder="站点名称" ${disabled}>
        <input class="workbench-input" data-user-site-field="url" value="${escapeHTML(state.userSiteDraft.url)}" placeholder="https://example.com" ${disabled}>
        <input class="workbench-input" data-user-site-field="category" value="${escapeHTML(state.userSiteDraft.category)}" placeholder="分类" ${disabled}>
        <input class="workbench-input" data-user-site-field="tags" value="${escapeHTML(state.userSiteDraft.tags)}" placeholder="标签，用逗号分隔" ${disabled}>
        <input class="workbench-input user-site-form__description" data-user-site-field="description" value="${escapeHTML(state.userSiteDraft.description)}" placeholder="一句话说明" ${disabled}>
        <button type="button" class="workbench-button" data-action="add-user-site" ${disabled}>添加站点</button>
      </div>
      <p class="workbench-helper">${escapeHTML(helper)}</p>
      ${state.userSites.length > 0 ? renderUserSitesList({ state, escapeHTML, getHost }) : '<div class="workbench-empty">还没有自定义站点。</div>'}
    </section>
  `;
}

function renderUserSitesList({ state, escapeHTML, getHost }) {
  return `
    <div class="user-site-list">
      ${state.userSites.map((site) => `
        <div class="todo-item user-site-item">
          <div class="todo-copy">
            <strong>${escapeHTML(site.name)}</strong>
            <span>${escapeHTML(getHost(site.url))}</span>
          </div>
          <button type="button" class="todo-remove" data-action="remove-user-site" data-site-id="${escapeHTML(site.id)}">删除</button>
        </div>
      `).join("")}
    </div>
  `;
}
