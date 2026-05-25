export function renderUserStats({ state, createStatCard }) {
  return [
    createStatCard("账号状态", state.sync.signedIn ? "已登录" : "未登录"),
    createStatCard("我的站点", String(state.userSites.length)),
    createStatCard("同步状态", state.sync.enabled ? "可用" : "本地"),
    createStatCard("权限范围", "个人"),
  ].join("");
}

export function renderUserPage({ state, escapeHTML, getHost, renderSiteCard, categoryOrder, allSites }) {
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
      ${renderUserSitesManager({ state, escapeHTML, renderSiteCard, categoryOrder, allSites })}
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

function renderUserSitesManager({ state, escapeHTML, renderSiteCard, categoryOrder, allSites }) {
  const disabled = state.sync.busy ? "disabled" : "";
  const categoryOptions = getUserSiteCategories(categoryOrder, state.userSites);
  const tagOptions = getUserSiteTags(allSites);
  const isEditing = Boolean(state.userSiteEditingId);

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
        <div class="user-site-form__row user-site-form__row--url">
          ${renderUrlControl({ value: state.userSiteDraft.url, escapeHTML, disabled })}
        </div>
        <div class="user-site-form__row user-site-form__row--details">
          <input class="workbench-input" data-user-site-field="name" value="${escapeHTML(state.userSiteDraft.name)}" placeholder="站点名称" ${disabled}>
          <input class="workbench-input" data-user-site-field="icon" value="${escapeHTML(state.userSiteDraft.icon)}" placeholder="图标地址（可选）" ${disabled}>
        </div>
        <div class="user-site-form__row user-site-form__row--meta">
          ${renderCategoryControl({ value: state.userSiteDraft.category, categoryOptions, escapeHTML, disabled })}
          ${renderTagControl({ value: state.userSiteDraft.tags, tagOptions, escapeHTML, disabled })}
        </div>
        <div class="user-site-form__row user-site-form__row--submit">
          <input class="workbench-input" data-user-site-field="description" value="${escapeHTML(state.userSiteDraft.description)}" placeholder="说明（可选）" ${disabled}>
          <button type="button" class="workbench-button" data-action="add-user-site" ${disabled}>添加站点</button>
        </div>
      </div>
      <p class="workbench-helper">自定义站点只保存到你的账号，不会写入全站公共导航。</p>
      ${state.userSites.length > 0 ? renderUserSitesList({ state, escapeHTML, renderSiteCard }) : '<div class="workbench-empty">还没有自定义站点。</div>'}
      ${isEditing ? renderUserSiteEditModal({ state, escapeHTML, categoryOptions, tagOptions, disabled }) : ""}
    </section>
  `;
}

function renderUserSiteEditModal({ state, escapeHTML, categoryOptions, tagOptions, disabled }) {
  return `
    <div class="user-site-modal" role="dialog" aria-modal="true" aria-labelledby="user-site-edit-title">
      <button type="button" class="user-site-modal__backdrop" data-action="cancel-edit-user-site" aria-label="关闭编辑"></button>
      <article class="panel user-site-modal__card">
        <div class="user-site-modal__head">
          <div>
            <p class="section-head__eyebrow">EDIT SITE</p>
            <h2 id="user-site-edit-title">编辑自定义站点</h2>
          </div>
          <button type="button" class="user-site-modal__close" data-action="cancel-edit-user-site" aria-label="关闭编辑">×</button>
        </div>
        <div class="user-site-edit-form">
          ${renderUrlControl({ value: state.userSiteDraft.url, escapeHTML, disabled })}
          <input class="workbench-input" data-user-site-field="name" value="${escapeHTML(state.userSiteDraft.name)}" placeholder="站点名称" ${disabled}>
          <input class="workbench-input" data-user-site-field="icon" value="${escapeHTML(state.userSiteDraft.icon)}" placeholder="图标地址（可选）" ${disabled}>
          ${renderCategoryControl({ value: state.userSiteDraft.category, categoryOptions, escapeHTML, disabled })}
          ${renderTagControl({ value: state.userSiteDraft.tags, tagOptions, escapeHTML, disabled })}
          <input class="workbench-input user-site-edit-form__wide" data-user-site-field="description" value="${escapeHTML(state.userSiteDraft.description)}" placeholder="说明（可选）" ${disabled}>
        </div>
        <div class="user-site-modal__actions">
          <button type="button" class="inline-reset" data-action="cancel-edit-user-site" ${disabled}>取消</button>
          <button type="button" class="workbench-button" data-action="add-user-site" ${disabled}>保存修改</button>
        </div>
      </article>
    </div>
  `;
}

function renderUrlControl({ value, escapeHTML, disabled }) {
  return `
    <div class="user-site-url-control">
      <input class="workbench-input" data-user-site-field="url" value="${escapeHTML(value)}" placeholder="https://example.com" ${disabled}>
      <button type="button" class="workbench-button user-site-identify-button" data-action="identify-user-site" ${disabled}>一键识别</button>
    </div>
  `;
}

function renderTagControl({ value, tagOptions, escapeHTML, disabled }) {
  return `
    <div class="user-site-tag-control">
      <input class="workbench-input" data-user-site-field="tags" value="${escapeHTML(value)}" placeholder="标签（可选，用逗号分隔）" ${disabled}>
      <select class="workbench-input user-site-tag-select" data-user-site-tag-select ${disabled}>
        <option value="">选择标签</option>
        ${tagOptions.map((tag) => `<option value="${escapeHTML(tag)}">${escapeHTML(tag)}</option>`).join("")}
      </select>
    </div>
  `;
}

function renderCategoryControl({ value, categoryOptions, escapeHTML, disabled }) {
  return `
    <div class="user-site-category-control">
      <input class="workbench-input" data-user-site-field="category" value="${escapeHTML(value)}" placeholder="分类" ${disabled}>
      <select class="workbench-input user-site-category-select" data-user-site-category-select ${disabled}>
        <option value="">选择分类</option>
        ${categoryOptions.map((category) => `<option value="${escapeHTML(category)}"${category === value ? " selected" : ""}>${escapeHTML(category)}</option>`).join("")}
      </select>
    </div>
  `;
}

function getUserSiteCategories(categoryOrder, sites) {
  const categories = [
    ...(Array.isArray(categoryOrder) ? categoryOrder : []),
    ...sites.map((site) => site.category),
  ];
  const seen = new Set();

  return categories
    .map((category) => String(category || "").trim())
    .filter((category) => {
      const key = category.toLocaleLowerCase();
      if (!category || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function getUserSiteTags(sites) {
  const seen = new Set();
  return (Array.isArray(sites) ? sites : [])
    .flatMap((site) => Array.isArray(site.tags) ? site.tags : [])
    .map((tag) => String(tag || "").trim())
    .filter((tag) => {
      const key = tag.toLocaleLowerCase();
      if (!tag || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function getUserDisplayName(state) {
  return state.sync.userEmail || state.sync.email || "我的账号";
}

function renderUserSitesList({ state, escapeHTML, renderSiteCard }) {
  const groups = groupUserSitesByCategory(state.userSites);

  return `
    <div class="user-site-list">
      ${groups.map((group) => `
        <section class="panel category-block user-site-category" data-category-anchor="${escapeHTML(group.title)}">
          <div class="section-head">
            <div>
              <p class="section-head__eyebrow">CUSTOM SITES</p>
              <h2>${escapeHTML(group.title)}</h2>
            </div>
            <span class="section-count">${group.sites.length}</span>
          </div>
          <div class="site-grid">
            ${group.sites.map((site) => renderSiteCard(site)).join("")}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function groupUserSitesByCategory(sites) {
  const groups = new Map();

  for (const site of sites) {
    const category = site.category || "个人";
    if (!groups.has(category)) {
      groups.set(category, []);
    }

    groups.get(category).push(site);
  }

  return [...groups.entries()].map(([title, groupSites]) => ({
    title,
    sites: groupSites,
  }));
}
