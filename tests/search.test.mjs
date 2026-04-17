import test from "node:test";
import assert from "node:assert/strict";
import { sites } from "../src/data/sites.js";
import { posts } from "../src/data/posts.js";
import { getPostSearchScore, getSiteSearchScore, matchesPostQuery, matchesSiteQuery, normalizeQuery } from "../src/lib/search.js";

const google = sites.find((site) => site.id === "google");
const x = sites.find((site) => site.id === "x");
const gpt = sites.find((site) => site.name === "GPT");
const cloudflare = sites.find((site) => site.name === "Cloudflare");
const zhihu = sites.find((site) => site.id === "zhihu");
const domainPost = posts.find((post) => post.id === "github-pages-and-custom-domain");
const readingPost = posts.find((post) => post.id === "designing-for-reading");

test("normalizeQuery 会去空格并转小写", () => {
  assert.equal(normalizeQuery("  GPT  "), "gpt");
});

test("站点搜索优先命中标题精确匹配", () => {
  assert.ok(google);
  assert.ok(x);
  assert.ok(getSiteSearchScore(google, "google") > getSiteSearchScore(x, "google"));
});

test("站点搜索支持别名和分类标签", () => {
  assert.ok(x);
  assert.ok(gpt);
  assert.equal(matchesSiteQuery(x, "twitter"), true);
  assert.equal(matchesSiteQuery(x, "推特"), true);
  assert.equal(matchesSiteQuery(gpt, "AI"), true);
});

test("站点搜索支持域名和去分隔符匹配", () => {
  assert.ok(cloudflare);
  assert.ok(zhihu);
  assert.equal(matchesSiteQuery(cloudflare, "cloud flare"), true);
  assert.equal(matchesSiteQuery(zhihu, "zhihu.com"), true);
});

test("博客搜索支持标题、标签和正文内容", () => {
  assert.ok(domainPost);
  assert.ok(readingPost);
  assert.equal(matchesPostQuery(domainPost, "cloudflare"), true);
  assert.equal(matchesPostQuery(domainPost, "域名"), true);
  assert.equal(matchesPostQuery(readingPost, "阅读体验"), true);
});

test("博客搜索支持去分隔符后的标题匹配", () => {
  assert.ok(domainPost);
  assert.equal(matchesPostQuery(domainPost, "github pages"), true);
});

test("博客搜索标题精确命中分数高于同文的标签命中", () => {
  assert.ok(domainPost);
  assert.ok(getPostSearchScore(domainPost, domainPost.title) > getPostSearchScore(domainPost, "Cloudflare"));
});
