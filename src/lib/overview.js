export function renderOverviewDeck({
  favorites,
  recent,
  posts,
  siteMap,
  escapeHTML,
  formatShortDate,
  getPostHref,
  collapsedCards,
}) {
  const favoriteSites = [...favorites].map((id) => siteMap.get(id)).filter(Boolean);
  const spotlightSites = favoriteSites.slice(-6).reverse();
  const spotlightSlots = Array.from({ length: 6 }, (_, index) => spotlightSites[index] || null);
  const recentSites = recent.map((id) => siteMap.get(id)).filter(Boolean).slice(0, 4);
  const latestPosts = [...posts].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt)).slice(0, 2);

  return `
    <section class="overview-grid">
      <div class="overview-grid__main">
        ${renderOverviewCard({
          cardId: "focus",
          eyebrow: "FOCUS",
          title: "最近收藏",
          meta: `<span class="section-count">${spotlightSites.length}</span>`,
          summary: "保留最新收藏的6个站点。<br>优先放常用入口，<br>减少重复查找。",
          body: `<div class="overview-link-list overview-link-list--primary">
            ${spotlightSlots.map((site) => (site ? renderOverviewSiteLink(site, escapeHTML) : renderOverviewPlaceholder())).join("")}
          </div>`,
          collapsed: Boolean(collapsedCards?.focus),
          escapeHTML,
        })}

        ${renderOverviewCard({
          cardId: "flow",
          eyebrow: "FLOW",
          title: "最近访问",
          meta: `<span class="section-count">${recentSites.length}</span>`,
          summary: "刚用过的入口会临时聚成一条工作链，不用回忆，也不用重新搜索。",
          body: `<div class="overview-link-list overview-link-list--stacked">
            ${recentSites.length > 0 ? recentSites.map((site) => renderOverviewSiteLink(site, escapeHTML, true)).join("") : '<div class="overview-empty">打开几个站点后，这里会自动形成当前任务的短期工作台。</div>'}
          </div>`,
          collapsed: Boolean(collapsedCards?.flow),
          escapeHTML,
        })}
      </div>

      ${renderOverviewCard({
        cardId: "writing",
        eyebrow: "WRITING",
        title: "最新文章",
        meta: '<button type="button" class="inline-reset" data-action="set-section" data-value="blog-list">去博客</button>',
        summary: "导航和内容放在同一站内，入口之外还能顺手记录方法、问题和维护经验。",
        body: `<div class="overview-post-list">
          ${latestPosts.map((post) => renderOverviewPost(post, escapeHTML, formatShortDate, getPostHref)).join("")}
        </div>`,
        collapsed: Boolean(collapsedCards?.writing),
        escapeHTML,
      })}
    </section>
  `;
}

function renderOverviewCard({ cardId, eyebrow, title, meta, summary, body, collapsed, escapeHTML }) {
  return `
    <article class="panel overview-card ${collapsed ? "is-collapsed" : ""}" data-overview-card="${escapeHTML(cardId)}">
      <div class="overview-card__head">
        <button
          type="button"
          class="overview-card__toggle"
          data-action="toggle-overview-card"
          data-value="${escapeHTML(cardId)}"
          aria-expanded="${collapsed ? "false" : "true"}"
        >
          <div>
            <p class="section-head__eyebrow">${escapeHTML(eyebrow)}</p>
            <h2>${escapeHTML(title)}</h2>
          </div>
        </button>
        <div class="overview-card__meta">
          ${meta}
          <button
            type="button"
            class="overview-card__collapse"
            data-action="toggle-overview-card"
            data-value="${escapeHTML(cardId)}"
            aria-label="${collapsed ? "展开卡片" : "折叠卡片"}"
            aria-expanded="${collapsed ? "false" : "true"}"
          >
            ${collapsed ? "展开" : "收起"}
          </button>
        </div>
      </div>
      ${
        collapsed
          ? ""
          : `
            <p class="overview-card__summary">${summary}</p>
            ${body}
          `
      }
    </article>
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

function renderOverviewPost(post, escapeHTML, formatShortDate, getPostHref) {
  return `
    <a class="overview-post" href="${escapeHTML(getPostHref(post.id))}">
      <span class="overview-post__date">${formatShortDate(post.publishedAt)}</span>
      <strong>${escapeHTML(post.title)}</strong>
      <span>${escapeHTML(post.summary)}</span>
    </a>
  `;
}
