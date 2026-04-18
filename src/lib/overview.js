export function renderOverviewDeck({
  favorites,
  recent,
  posts,
  siteMap,
  escapeHTML,
  formatShortDate,
  getPostHref,
}) {
  const favoriteSites = [...favorites].map((id) => siteMap.get(id)).filter(Boolean);
  const spotlightSites = favoriteSites.slice(-6).reverse();
  const spotlightSlots = Array.from({ length: 6 }, (_, index) => spotlightSites[index] || null);
  const recentSites = recent.map((id) => siteMap.get(id)).filter(Boolean).slice(0, 4);
  const latestPosts = [...posts].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt)).slice(0, 2);

  return `
    <section class="overview-grid">
      <div class="overview-grid__main">
        <article class="panel overview-card overview-card--primary">
          <div class="overview-card__head">
            <div>
              <p class="section-head__eyebrow">FOCUS</p>
              <h2>最近收藏</h2>
            </div>
            <span class="section-count">${spotlightSites.length}</span>
          </div>
          <p class="overview-card__summary">保留最新收藏的6个站点。<br>优先放常用入口，<br>减少重复查找。</p>
          <div class="overview-link-list overview-link-list--primary">
            ${spotlightSlots.map((site) => (site ? renderOverviewSiteLink(site, escapeHTML) : renderOverviewPlaceholder())).join("")}
          </div>
        </article>

        <article class="panel overview-card">
          <div class="overview-card__head">
            <div>
              <p class="section-head__eyebrow">FLOW</p>
              <h2>最近访问</h2>
            </div>
            <span class="section-count">${recentSites.length}</span>
          </div>
          <p class="overview-card__summary">刚用过的入口会临时聚成一条工作链，不用回忆，也不用重新搜索。</p>
          <div class="overview-link-list overview-link-list--stacked">
            ${recentSites.length > 0 ? recentSites.map((site) => renderOverviewSiteLink(site, escapeHTML, true)).join("") : '<div class="overview-empty">打开几个站点后，这里会自动形成当前任务的短期工作台。</div>'}
          </div>
        </article>
      </div>

      <article class="panel overview-card overview-card--posts">
        <div class="overview-card__head">
          <div>
            <p class="section-head__eyebrow">WRITING</p>
            <h2>最新文章</h2>
          </div>
          <button type="button" class="inline-reset" data-action="set-section" data-value="blog-list">去博客</button>
        </div>
        <p class="overview-card__summary">导航和内容放在同一站内，入口之外还能顺手记录方法、问题和维护经验。</p>
        <div class="overview-post-list">
          ${latestPosts.map((post) => renderOverviewPost(post, escapeHTML, formatShortDate)).join("")}
        </div>
      </article>
    </section>
  `;
}

function renderOverviewSiteLink(site, escapeHTML, compact = false) {
  return `
    <a
      class="overview-link ${compact ? "is-compact" : ""}"
      href="${escapeHTML(site.url)}"
      target="_blank"
      rel="noreferrer noopener"
      data-site-id="${escapeHTML(site.id)}"
    >
      <strong>${escapeHTML(site.name)}</strong>
      <span>${escapeHTML(site.category)}</span>
    </a>
  `;
}

function renderOverviewPlaceholder(compact = false) {
  return `
    <div class="overview-link overview-link--placeholder ${compact ? "is-compact" : ""}" aria-hidden="true">
      <strong>少昊导航</strong>
      <span></span>
    </div>
  `;
}

function renderOverviewPost(post, escapeHTML, formatShortDate) {
  return `
    <a class="overview-post" href="${escapeHTML(getPostHref(post.id))}">
      <span class="overview-post__date">${formatShortDate(post.publishedAt)}</span>
      <strong>${escapeHTML(post.title)}</strong>
      <span>${escapeHTML(post.summary)}</span>
    </a>
  `;
}
