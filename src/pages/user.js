export function renderUserStats({ state, createStatCard }) {
  return [
    createStatCard("账号状态", state.sync.signedIn ? "已登录" : "未登录"),
    createStatCard("我的站点", String(state.userSites.length)),
    createStatCard("同步状态", state.sync.enabled ? "可用" : "本地"),
    createStatCard("权限范围", "个人"),
  ].join("");
}

export function renderUserPage({ state, escapeHTML, getHost, renderSiteCard }) {
  if (!state.sync.signedIn) {
    return renderSignedOutUserPage({ state, escapeHTML });
  }

  return `
    <section class="user-portal">
      <div class="panel user-profile">
        <div>
          <p class="section-head__eyebrow">USER CENTER</p>
          <h2>${escapeHTML(getUserDisplayName(state))}</h2>
          <p>你的收藏、最近访问、待办和个人站点会跟随账号同步。</p>
        </div>
        <div class="user-profile__actions">
          <span class="state-pill">已登录</span>
          <button type="button" class="inline-reset" data-action="sync-sign-out" ${state.sync.busy ? "disabled" : ""}>退出登录</button>
        </div>
      </div>
      ${renderUserOverview({ state })}
      ${renderAccountSyncPanel({ state, escapeHTML })}
      ${renderUserSitesManager({ state, escapeHTML, renderSiteCard })}
    </section>
  `;
}

function renderSignedOutUserPage({ state, escapeHTML }) {
  const disabled = state.sync.busy ? "disabled" : "";

  return `
    <section class="user-login-page">
      <article class="panel user-login-card">
        <button type="button" class="user-login-card__close" data-action="set-section" data-value="nav" aria-label="关闭登录">×</button>
        <div class="user-login-card__head">
          <p class="section-head__eyebrow">USER CENTER</p>
          <h2>登录少昊导航</h2>
          <p>登录后同步收藏、最近访问、待办和你的个人站点。</p>
        </div>
        <div class="sync-form user-login-card__form">
          <input
            type="email"
            data-role="sync-email"
            class="workbench-input"
            placeholder="邮箱"
            autocomplete="email"
            value="${escapeHTML(state.sync.email)}"
            ${disabled}
          >
          <input
            type="password"
            data-role="sync-password"
            class="workbench-input"
            placeholder="密码"
            autocomplete="current-password"
            value="${escapeHTML(state.sync.password)}"
            ${disabled}
          >
        </div>
        <div class="sync-actions user-login-card__actions">
          <button type="button" class="workbench-button" data-action="sync-sign-in" ${disabled}>登录</button>
          <button type="button" class="inline-reset" data-action="sync-sign-up" ${disabled}>注册账号</button>
        </div>
        <p class="workbench-helper" data-role="sync-status">${escapeHTML(state.sync.message)}</p>
      </article>
    </section>
  `;
}

function renderUserOverview({ state }) {
  const items = [
    ["我的站点", state.userSites.length],
    ["收藏", state.favorites.size],
    ["最近访问", state.recent.length],
    ["待办", state.workbenchTodos.length],
  ];

  return `
    <div class="user-overview">
      ${items.map(([label, value]) => `
        <article class="panel user-overview-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `).join("")}
    </div>
  `;
}

function renderAccountSyncPanel({ state, escapeHTML }) {
  return `
    <article class="panel user-account-panel">
      <div>
        <p class="section-head__eyebrow">SYNC</p>
        <h2>云端同步</h2>
        <p class="workbench-helper" data-role="sync-status">${escapeHTML(state.sync.message)}</p>
      </div>
      <button type="button" class="workbench-button" data-action="sync-now" ${state.sync.busy ? "disabled" : ""}>立即同步</button>
    </article>
  `;
}

function renderUserSitesManager({ state, escapeHTML, renderSiteCard }) {
  const disabled = state.sync.busy ? "disabled" : "";

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
        <input class="workbench-input user-site-form__icon" data-user-site-field="icon" value="${escapeHTML(state.userSiteDraft.icon)}" placeholder="图标地址（可选）" ${disabled}>
        <input class="workbench-input" data-user-site-field="category" value="${escapeHTML(state.userSiteDraft.category)}" placeholder="分类" ${disabled}>
        <input class="workbench-input" data-user-site-field="tags" value="${escapeHTML(state.userSiteDraft.tags)}" placeholder="标签，用逗号分隔" ${disabled}>
        <input class="workbench-input user-site-form__description" data-user-site-field="description" value="${escapeHTML(state.userSiteDraft.description)}" placeholder="一句话说明" ${disabled}>
        <button type="button" class="workbench-button" data-action="add-user-site" ${disabled}>添加站点</button>
      </div>
      <p class="workbench-helper">自定义站点只保存到你的账号，不会写入全站公共导航。</p>
      ${state.userSites.length > 0 ? renderUserSitesList({ state, renderSiteCard }) : '<div class="workbench-empty">还没有自定义站点。</div>'}
    </section>
  `;
}

function getUserDisplayName(state) {
  return state.sync.userEmail || state.sync.email || "我的账号";
}

function renderUserSitesList({ state, renderSiteCard }) {
  return `
    <div class="site-grid user-site-list">
      ${state.userSites.map((site) => renderSiteCard(site)).join("")}
    </div>
  `;
}
