import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { posts } from "../src/data/posts.js";
import { siteMeta } from "../src/data/site.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");

const origin = siteMeta.url.replace(/\/+$/, "");
const feedPath = siteMeta.rssPath || "/rss.xml";
const sitemapPath = siteMeta.sitemapPath || "/sitemap.xml";

const sortedPosts = [...posts].sort(
  (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
);

await mkdir(publicDir, { recursive: true });
await writeFile(path.join(publicDir, "rss.xml"), buildRss(sortedPosts), "utf8");
await writeFile(path.join(publicDir, "sitemap.xml"), buildSitemap(sortedPosts), "utf8");
await writeFile(path.join(publicDir, "robots.txt"), buildRobots(), "utf8");

function buildRss(items) {
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

function buildSitemap(items) {
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

function buildRobots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}${sitemapPath}\n`;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
