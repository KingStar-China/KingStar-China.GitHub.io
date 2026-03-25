import test from "node:test";
import assert from "node:assert/strict";
import { posts } from "../src/data/posts.js";
import { siteMeta } from "../src/data/site.js";
import { buildRobots, buildRss, buildSitemap } from "../src/lib/seo.js";

const sortedPosts = [...posts].sort(
  (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
);

test("RSS 会为每篇文章生成一个 item", () => {
  const rss = buildRss(sortedPosts, siteMeta);
  const itemCount = rss.match(/<item>/g)?.length ?? 0;
  assert.equal(itemCount, sortedPosts.length);
  assert.match(rss, /<language>zh-CN<\/language>/);
});

test("站点地图包含首页、博客列表和文章详情", () => {
  const sitemap = buildSitemap(sortedPosts, siteMeta);
  assert.match(sitemap, /https:\/\/845864204\.xyz\//);
  assert.match(sitemap, /\?section=blog/);
  assert.ok(sitemap.includes(`?post=${sortedPosts[0].id}`));
});

test("robots.txt 指向 sitemap", () => {
  const robots = buildRobots(siteMeta);
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Sitemap: https:\/\/845864204\.xyz\/sitemap\.xml/);
});

test("SEO 输出会转义 XML 特殊字符", () => {
  const rss = buildRss([
    {
      id: "test-xml",
      title: "A & B < C",
      summary: "x > y",
      publishedAt: "2026-03-25",
      tags: ["A&B"],
    },
  ], siteMeta);
  assert.match(rss, /A &amp; B &lt; C/);
  assert.match(rss, /x &gt; y/);
  assert.match(rss, /A&amp;B/);
});
