import test from "node:test";
import assert from "node:assert/strict";
import { sites } from "../src/data/sites.js";
import { posts } from "../src/data/posts.js";
import { siteMeta } from "../src/data/site.js";

test("站点数据结构有效", () => {
  const ids = new Set();

  for (const site of sites) {
    assert.ok(site.id, "site.id 不能为空");
    assert.equal(ids.has(site.id), false, `站点 id 重复: ${site.id}`);
    ids.add(site.id);

    assert.ok(site.name, `站点名称不能为空: ${site.id}`);
    assert.ok(site.category, `站点分类不能为空: ${site.id}`);
    assert.ok(Array.isArray(site.tags), `站点 tags 必须是数组: ${site.id}`);
    assert.doesNotThrow(() => new URL(site.url), `站点 URL 无效: ${site.id}`);
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
    assert.ok(Array.isArray(post.content), `文章 content 必须是数组: ${post.id}`);
    assert.ok(post.content.length > 0, `文章内容不能为空: ${post.id}`);
    assert.equal(Number.isNaN(new Date(post.publishedAt).getTime()), false, `文章日期无效: ${post.id}`);
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
