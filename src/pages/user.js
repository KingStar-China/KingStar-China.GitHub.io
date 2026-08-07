export function renderUserPage({ state, escapeHTML, getHost, renderSiteCard, categoryOrder, allSites }) {
  if (!state.sync.signedIn) {
    if (state.section === "user") {
      return renderRestoringUserPage();
    }
    return renderSignedOutUserPage({ state, escapeHTML });
  }

  return `
    <section class="user-portal">
      ${renderUserSitesManager({ state, escapeHTML, renderSiteCard, categoryOrder, allSites })}
      ${state.userSettingsOpen ? renderUserSettingsModal({ state, escapeHTML }) : ""}
    </section>
  `;
}

function renderRestoringUserPage() {
  return `
    <section class="user-login-page" aria-live="polite">
      <article class="panel user-login-card user-session-card">
        <span class="user-session-card__spinner" aria-hidden="true"></span>
        <h2>正在恢复登录状态</h2>
        <p>正在读取本机账号缓存，请稍候。</p>
      </article>
    </section>
  `;
}

function renderSignedOutUserPage({ state, escapeHTML }) {
  const disabled = state.sync.busy ? "disabled" : "";
  const isSigningIn = state.sync.busy && state.sync.authMode === "sign-in";
  const isSigningUp = state.sync.busy && state.sync.authMode === "sign-up";
  const signInLabel = isSigningIn ? "登录中..." : "登录";
  const signUpLabel = isSigningUp ? "注册中..." : "立即注册";

  return `
    <section class="user-login-page">
      <article class="panel user-login-card">
        <button type="button" class="user-login-card__close" data-action="set-section" data-value="nav" aria-label="关闭登录">×</button>
        <div class="user-login-card__head">
          <h2>登录到少昊导航</h2>
        </div>
        <div class="sync-form user-login-card__form">
          <label class="user-login-field">
            <span>邮箱</span>
            <input
              type="email"
              name="username"
              data-role="sync-email"
              class="workbench-input"
              placeholder="you@example.com"
              autocomplete="username"
              value="${escapeHTML(state.sync.email)}"
              ${disabled}
            >
          </label>
          <label class="user-login-field">
            <span>密码</span>
            <input
              type="password"
              name="current-password"
              data-role="sync-password"
              class="workbench-input"
              placeholder="输入密码"
              autocomplete="current-password"
              value="${escapeHTML(state.sync.password)}"
              ${disabled}
            >
          </label>
          <button type="button" class="workbench-button user-login-card__primary" data-action="sync-sign-in" ${disabled}>${signInLabel}</button>
        </div>
        <p class="user-login-card__status${state.sync.busy ? " is-busy" : ""}" data-role="sync-status">${escapeHTML(state.sync.message)}</p>
        <div class="user-login-card__divider"><span>或</span></div>
        <div class="user-login-card__links">
          <button type="button" class="inline-reset" data-action="sync-reset-password" ${disabled}>忘记密码</button>
          <span>还没有账号？ <button type="button" class="inline-reset" data-action="sync-sign-up" ${disabled}>${signUpLabel}</button></span>
        </div>
      </article>
    </section>
  `;
}

function renderUserSettingsModal({ state, escapeHTML }) {
  const disabled = state.sync.busy ? "disabled" : "";
  const isRecovery = state.sync.authMode === "recovery";

  return `
    <div class="user-site-modal user-settings-modal" role="dialog" aria-modal="true" aria-labelledby="user-settings-title">
      <button type="button" class="user-site-modal__backdrop" data-action="close-user-settings" aria-label="关闭账户设置"></button>
      <article class="panel user-site-modal__card user-settings-modal__card">
        <div class="user-site-modal__head">
          <div>
            <p class="section-head__eyebrow">ACCOUNT</p>
            <h2 id="user-settings-title">账户设置</h2>
          </div>
          <button type="button" class="user-site-modal__close" data-action="close-user-settings" aria-label="关闭账户设置">×</button>
        </div>
        <div class="user-settings-modal__body">
          <section class="user-settings-section">
            <div>
              <span class="user-settings-section__label">登录账号</span>
              <strong>${escapeHTML(getUserDisplayName(state))}</strong>
            </div>
            <span class="state-pill">已登录</span>
          </section>
          <section class="user-settings-section user-settings-section--sync">
            <div>
              <span class="user-settings-section__label">云端同步</span>
              <p class="workbench-helper" data-role="sync-status">${escapeHTML(state.sync.message)}</p>
            </div>
            <button type="button" class="workbench-button" data-action="sync-now" ${disabled}>立即同步</button>
          </section>
          <section class="user-settings-section user-settings-section--password">
            <div>
              <span class="user-settings-section__label">安全</span>
              <strong>${isRecovery ? "设置新密码" : "修改密码"}</strong>
            </div>
            <div class="user-password-form">
              ${isRecovery ? "" : `
                <input class="workbench-input" type="password" data-role="sync-current-password" value="${escapeHTML(state.sync.currentPassword)}" placeholder="当前密码" autocomplete="current-password" ${disabled}>
              `}
              <input class="workbench-input" type="password" data-role="sync-new-password" value="${escapeHTML(state.sync.newPassword)}" placeholder="新密码" autocomplete="new-password" ${disabled}>
              <input class="workbench-input" type="password" data-role="sync-confirm-password" value="${escapeHTML(state.sync.confirmPassword)}" placeholder="确认新密码" autocomplete="new-password" ${disabled}>
              <button type="button" class="workbench-button" data-action="sync-update-password" ${disabled}>保存密码</button>
            </div>
          </section>
        </div>
        <div class="user-settings-modal__foot">
          <button type="button" class="inline-reset user-settings-modal__signout" data-action="sync-sign-out" ${disabled}>退出登录</button>
          <button type="button" class="workbench-button" data-action="close-user-settings">完成</button>
        </div>
      </article>
    </div>
  `;
}

function renderUserSitesManager({ state, escapeHTML, renderSiteCard, categoryOrder, allSites }) {
  const disabled = state.sync.busy ? "disabled" : "";
  const categoryOptions = getUserSiteCategories(categoryOrder, state.userSites);
  const tagOptions = getUserSiteTags(allSites);
  const filteredSites = getFilteredUserSites(state);
  const filterCategories = getUserSiteCategories([], state.userSites);

  return `
    <section class="user-sites-manager">
      <header class="user-sites-manager__head">
        <div>
          <p class="section-head__eyebrow">MY SITES</p>
          <div class="user-sites-manager__title">
            <h2>我的站点</h2>
            <span class="section-count">${state.userSites.length}</span>
          </div>
          <p>这里仅显示你在用户后台添加的网站。</p>
        </div>
        <div class="user-sites-manager__actions">
          <button type="button" class="user-page-button user-page-button--secondary" data-action="open-user-settings" ${disabled}>账户设置</button>
          <button type="button" class="user-page-button user-page-button--primary" data-action="open-add-user-site" ${disabled}>+ 添加网站</button>
        </div>
      </header>
      ${state.userSites.length > 0 ? `
        <div class="user-site-filter">
          <input
            class="workbench-input"
            type="search"
            name="user-site-filter"
            data-role="user-site-search"
            value="${escapeHTML(state.userSiteQuery)}"
            placeholder="搜索我的站点"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            data-lpignore="true"
            data-1p-ignore
          >
          <select class="workbench-input" data-role="user-site-category-filter">
            <option value="all">全部分类</option>
            ${filterCategories.map((category) => `<option value="${escapeHTML(category)}"${state.userSiteCategory === category ? " selected" : ""}>${escapeHTML(category)}</option>`).join("")}
          </select>
          <span class="workbench-helper">显示 ${filteredSites.length} / ${state.userSites.length}</span>
        </div>
        ${filteredSites.length > 0 ? renderUserSitesList({ sites: filteredSites, escapeHTML, renderSiteCard }) : '<div class="workbench-empty">没有匹配的自定义站点。</div>'}
      ` : `
        <div class="user-sites-empty">
          <h3>还没有个人网站</h3>
          <p>添加后会显示在这里，并跟随当前账号同步。</p>
          <button type="button" class="user-page-button user-page-button--primary" data-action="open-add-user-site" ${disabled}>+ 添加第一个网站</button>
        </div>
      `}
      ${state.userSiteModalOpen ? renderUserSiteModal({ state, escapeHTML, categoryOptions, tagOptions, disabled }) : ""}
    </section>
  `;
}

function renderUserSiteModal({ state, escapeHTML, categoryOptions, tagOptions, disabled }) {
  const isEditing = Boolean(state.userSiteEditingId);

  return `
    <div class="user-site-modal" role="dialog" aria-modal="true" aria-labelledby="user-site-form-title">
      <button type="button" class="user-site-modal__backdrop" data-action="cancel-edit-user-site" aria-label="关闭网站表单"></button>
      <article class="panel user-site-modal__card">
        <div class="user-site-modal__head">
          <div>
            <p class="section-head__eyebrow">${isEditing ? "EDIT SITE" : "NEW SITE"}</p>
            <h2 id="user-site-form-title">${isEditing ? "编辑网站" : "添加网站"}</h2>
          </div>
          <button type="button" class="user-site-modal__close" data-action="cancel-edit-user-site" aria-label="关闭网站表单">×</button>
        </div>
        <div class="user-site-edit-form">
          <div class="user-site-form__row user-site-form__row--url">
            ${renderUrlControl({ value: state.userSiteDraft.url, escapeHTML, disabled })}
          </div>
          <div class="user-site-form__row user-site-form__row--details">
            <input class="workbench-input" data-user-site-field="name" value="${escapeHTML(state.userSiteDraft.name)}" placeholder="站点名称" ${disabled}>
            <input class="workbench-input" data-user-site-field="icon" value="${escapeHTML(state.userSiteDraft.icon)}" placeholder="图标地址（可选）" ${disabled}>
          </div>
          <div class="user-site-form__row">
            ${renderCategoryControl({ value: state.userSiteDraft.category, categoryOptions, escapeHTML, disabled })}
          </div>
          <div class="user-site-form__row">
            ${renderTagControl({ value: state.userSiteDraft.tags, tagOptions, escapeHTML, disabled })}
          </div>
          <div class="user-site-form__row">
            <input class="workbench-input" data-user-site-field="aliases" value="${escapeHTML(state.userSiteDraft.aliases)}" placeholder="别名（可选，用逗号分隔）" ${disabled}>
          </div>
          <div class="user-site-form__row">
            <input class="workbench-input" data-user-site-field="description" value="${escapeHTML(state.userSiteDraft.description)}" placeholder="说明（可选）" ${disabled}>
          </div>
        </div>
        <p class="workbench-helper user-site-modal__status" data-role="sync-status">${escapeHTML(state.sync.message)}</p>
        <div class="user-site-modal__actions">
          <button type="button" class="inline-reset" data-action="cancel-edit-user-site" ${disabled}>取消</button>
          <button type="button" class="workbench-button" data-action="add-user-site" ${disabled}>${isEditing ? "保存修改" : "添加网站"}</button>
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

function renderUserSitesList({ sites, escapeHTML, renderSiteCard }) {
  const groups = groupUserSitesByCategory(sites);

  return `
    <div class="user-site-list">
      ${groups.map((group) => `
        <section class="user-site-category" data-category-anchor="${escapeHTML(group.title)}">
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

function getFilteredUserSites(state) {
  const query = String(state.userSiteQuery || "").trim().toLocaleLowerCase();

  return state.userSites.filter((site) => {
    if (state.userSiteCategory !== "all" && site.category !== state.userSiteCategory) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      site.name,
      site.url,
      site.category,
      site.description,
      ...(Array.isArray(site.tags) ? site.tags : []),
      ...(Array.isArray(site.aliases) ? site.aliases : []),
    ].join(" ").toLocaleLowerCase();

    return haystack.includes(query);
  });
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
