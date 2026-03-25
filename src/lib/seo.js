function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRss(items, siteMeta) {
  const origin = siteMeta.url.replace(/\/+$/, "");
  const xmlItems = items
    .map((post) => {
      const url = `${origin}/?post=${encodeURIComponent(post.id)}`;
      const pubDate = new Date(post.publishedAt).toUTCString();
      const categoryMarkup = (post.tags || []).map((tag) => `<category>${escapeXml(tag)}</category>`).join("");
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid>${escapeXml(url)}</guid>
      <description>${escapeXml(post.summary || "")}</description>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      ${categoryMarkup}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(siteMeta.name)}</title>
    <link>${escapeXml(origin)}</link>
    <description>${escapeXml(siteMeta.description)}</description>
    <language>zh-CN</language>
    ${xmlItems}
  </channel>
</rss>
`;
}

export function buildSitemap(items, siteMeta) {
  const origin = siteMeta.url.replace(/\/+$/, "");
  const latestPostDate = items[0]?.publishedAt || new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${origin}/`, lastmod: latestPostDate },
    { loc: `${origin}/?section=blog`, lastmod: latestPostDate },
    ...items.map((post) => ({
      loc: `${origin}/?post=${encodeURIComponent(post.id)}`,
      lastmod: post.publishedAt,
    })),
  ];

  const markup = urls
    .map(
      (entry) => `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${markup}
</urlset>
`;
}

export function buildRobots(siteMeta) {
  const origin = siteMeta.url.replace(/\/+$/, "");
  const sitemapPath = siteMeta.sitemapPath || "/sitemap.xml";
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}${sitemapPath}\n`;
}
