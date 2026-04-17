import test from "node:test";
import assert from "node:assert/strict";
import { sites } from "../src/data/sites.js";
import { posts } from "../src/data/posts.js";
import { siteMeta } from "../src/data/site.js";
import { searchEngines } from "../src/data/search-engines.js";
import {
  isValidDateString,
  isValidHttpUrl,
  isValidSearchUrlTemplate,
  normalizeSiteUrlForCompare,
  normalizePostContent,
  validatePostsPayload,
  validateSearchEnginesPayload,
  validateSiteIconReferences,
  validateSitesPayload,
} from "../admin/content-validation.js";
import { decoratePost, loadPostsFromMarkdown } from "../scripts/posts-content.mjs";
import { extractSiteMetadata } from "../scripts/site-metadata.mjs";
import { readdir } from "node:fs/promises";

test("站点数据结构有效", () => {
  const ids = new Set();

  for (const site of sites) {
    assert.ok(site.id, "site.id 不能为空");
    assert.equal(ids.has(site.id), false, `站点 id 重复: ${site.id}`);
    ids.add(site.id);

    assert.ok(site.name, `站点名称不能为空: ${site.id}`);
    assert.ok(site.category, `站点分类不能为空: ${site.id}`);
    assert.ok(Array.isArray(site.tags), `站点 tags 必须是数组: ${site.id}`);
    assert.equal(isValidHttpUrl(site.url), true, `站点 URL 无效: ${site.id}`);
  }
});

test("博客数据结构有效", () => {
  const ids = new Set();

  for (const post of posts) {
    assert.ok(post.id, "post.id 不能为空");
    assert.equal(ids.has(post.id), false, `文章 id 重复: ${post.id}`);
    ids.add(post.id);

    assert.ok(post.title, `文章标题不能为空: ${post.id}`);
    assert.ok(post.summary, `文章摘要不能为空: ${post.id}`);
    assert.ok(Array.isArray(post.tags), `文章 tags 必须是数组: ${post.id}`);
    assert.equal(typeof post.content, "string", `文章 content 必须是字符串: ${post.id}`);
    assert.ok(post.content.trim().length > 0, `文章内容不能为空: ${post.id}`);
    assert.equal(isValidDateString(post.publishedAt), true, `文章日期无效: ${post.id}`);
  }
});

test("搜索引擎数据结构有效", () => {
  const ids = new Set();

  for (const engine of searchEngines) {
    assert.ok(engine.id, "搜索引擎 id 不能为空");
    assert.equal(ids.has(engine.id), false, `搜索引擎 id 重复: ${engine.id}`);
    ids.add(engine.id);
    assert.ok(engine.label, `搜索引擎名称不能为空: ${engine.id}`);
    assert.ok(engine.placeholder, `搜索提示词不能为空: ${engine.id}`);
    assert.equal(isValidSearchUrlTemplate(engine.urlTemplate), true, `搜索引擎模板无效: ${engine.id}`);
  }
});

test("站点元信息有效", () => {
  const url = new URL(siteMeta.url);
  assert.equal(url.protocol, "https:");
  assert.ok(siteMeta.name);
  assert.ok(siteMeta.description);
  assert.equal(siteMeta.rssPath, "/rss.xml");
  assert.equal(siteMeta.sitemapPath, "/sitemap.xml");
});

test("本地管理校验接受当前站点、文章和搜索引擎数据", () => {
  assert.doesNotThrow(() => validateSitesPayload(structuredClone(sites)));
  assert.doesNotThrow(() => validatePostsPayload(structuredClone(posts)));
  assert.doesNotThrow(() => validateSearchEnginesPayload(structuredClone(searchEngines)));
});

test("本地管理校验会拒绝错误链接、错误日期、空正文和错误模板", () => {
  const badSites = structuredClone(sites);
  badSites[0].url = "javascript:alert(1)";
  assert.throws(() => validateSitesPayload(badSites), /链接格式无效/);

  const badDatePosts = structuredClone(posts);
  badDatePosts[0].publishedAt = "2026-02-31";
  assert.throws(() => validatePostsPayload(badDatePosts), /发布日期无效/);

  const emptyContentPosts = structuredClone(posts);
  emptyContentPosts[0].content = [];
  assert.throws(() => validatePostsPayload(emptyContentPosts), /正文不能为空/);

  const badEngines = structuredClone(searchEngines);
  badEngines[0].urlTemplate = "https://www.sogou.com/web";
  assert.throws(() => validateSearchEnginesPayload(badEngines), /链接模板无效/);
});

test("Markdown 文章源可以解析为当前博客数据", async () => {
  const markdownPosts = await loadPostsFromMarkdown();

  assert.deepEqual(
    markdownPosts.map((post) => post.id),
    posts.map((post) => post.id),
  );
  assert.equal(markdownPosts[0]?.title, posts[0]?.title);
});

test("博客派生数据包含 Markdown 渲染结果和内容块统计", () => {
  assert.ok(posts[0]?.contentHtml);
  assert.equal(typeof posts[0]?.contentHtml, "string");
  assert.ok(posts[0]?.blockCount > 0);
});

test("Markdown 代码块会生成高亮 HTML", () => {
  const post = decoratePost({
    id: "code-sample",
    title: "Code",
    summary: "Code",
    publishedAt: "2026-04-17",
    tags: ["测试"],
    content: "```js\nconst answer = 42;\n```",
  });

  assert.match(post.contentHtml, /article-code-block/);
  assert.match(post.contentHtml, /class="hljs language-js"/);
  assert.match(post.contentHtml, /hljs-keyword|hljs-variable|hljs-number/);
});

test("Markdown 常见结构会生成对应 HTML", () => {
  const post = decoratePost({
    id: "rich-sample",
    title: "Rich",
    summary: "Rich",
    publishedAt: "2026-04-17",
    tags: ["测试"],
    content: [
      "| 功能 | 状态 |",
      "| --- | --- |",
      "| Table | OK |",
      "",
      "---",
      "",
      "![Alt](https://example.com/test.png)",
    ].join("\n"),
  });

  assert.match(post.contentHtml, /<table>/);
  assert.match(post.contentHtml, /<hr>/);
  assert.match(post.contentHtml, /<img src="https:\/\/example\.com\/test\.png" alt="Alt">/);
});

test("Markdown 标题会生成锚点和目录数据", () => {
  const post = decoratePost({
    id: "toc-sample",
    title: "Toc",
    summary: "Toc",
    publishedAt: "2026-04-17",
    tags: ["测试"],
    content: [
      "## 第一节",
      "",
      "内容",
      "",
      "### 第二层",
      "",
      "更多内容",
    ].join("\n"),
  });

  assert.match(post.contentHtml, /<h2 id="第一节">第一节<\/h2>/);
  assert.match(post.contentHtml, /<h3 id="第二层">第二层<\/h3>/);
  assert.deepEqual(post.toc, [
    { id: "第一节", text: "第一节", depth: 2 },
    { id: "第二层", text: "第二层", depth: 3 },
  ]);
});

test("本地管理校验会拒绝归一化后重复的站点链接和错误图标路径", () => {
  const duplicateSites = structuredClone(sites);
  duplicateSites[0].url = "https://github.com/";
  duplicateSites[0].id = "duplicate-site";
  duplicateSites[0].name = "Duplicate";
  duplicateSites[0].category = "外网";
  duplicateSites[0].description = "重复链接";
  duplicateSites[0].tags = [];
  duplicateSites[0].aliases = [];
  duplicateSites.push({
    id: "github-copy",
    name: "GitHub Copy",
    url: "https://github.com/#section",
    category: "外网",
    tags: [],
    icon: "",
    description: "同站点不同 hash",
    aliases: [],
  });
  assert.throws(() => validateSitesPayload(duplicateSites), /链接重复/);

  const badIconSites = structuredClone(sites);
  badIconSites[0].icon = "favicon/test.png";
  assert.throws(() => validateSitesPayload(badIconSites), /图标路径无效/);
});

test("本地管理校验会验证本地图标文件是否存在", async () => {
  const iconFiles = await readdir(new URL("../public/icon/", import.meta.url));
  assert.doesNotThrow(() => validateSiteIconReferences(structuredClone(sites), iconFiles));

  const badSites = structuredClone(sites);
  badSites[0].icon = "icon/not-found.png";
  assert.throws(() => validateSiteIconReferences(badSites, iconFiles), /图标文件不存在/);
});

test("站点链接归一化会忽略 hash 和根路径尾斜杠差异", () => {
  assert.equal(
    normalizeSiteUrlForCompare("https://github.com/#readme"),
    normalizeSiteUrlForCompare("https://github.com/"),
  );
  assert.equal(
    normalizeSiteUrlForCompare("https://example.com/docs/"),
    normalizeSiteUrlForCompare("https://example.com/docs"),
  );
});

test("文章正文归一化会兼容旧数组格式", () => {
  assert.equal(normalizePostContent(["第一段", "第二段"]), "第一段\n\n第二段");
  assert.equal(normalizePostContent("  # 标题\n\n正文  "), "# 标题\n\n正文");
});

test("站点信息抓取会解析标题、描述、图标和别名", () => {
  const html = `
    <html>
      <head>
        <title>Example App</title>
        <meta name="description" content="An example site for tests.">
        <link rel="apple-touch-icon" href="/icons/touch.png" sizes="180x180">
      </head>
      <body></body>
    </html>
  `;

  const metadata = extractSiteMetadata(html, "https://www.example.com/docs");
  assert.equal(metadata.name, "Example App");
  assert.equal(metadata.description, "An example site for tests.");
  assert.equal(metadata.icon, "https://www.example.com/icons/touch.png");
  assert.deepEqual(metadata.aliases, ["example.com", "www.example.com"]);
  assert.equal(metadata.finalUrl, "https://www.example.com/docs");
});

test("站点信息抓取在缺少 link icon 时会回退到 favicon.ico", () => {
  const html = `
    <html>
      <head>
        <meta property="og:site_name" content="Fallback Site">
      </head>
      <body></body>
    </html>
  `;

  const metadata = extractSiteMetadata(html, "https://sub.example.com/path");
  assert.equal(metadata.name, "Fallback Site");
  assert.equal(metadata.icon, "https://sub.example.com/favicon.ico");
});
