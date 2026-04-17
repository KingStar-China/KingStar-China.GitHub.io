import test from "node:test";
import assert from "node:assert/strict";
import { posts } from "../src/data/posts.js";
import {
  formatPostReadingTime,
  getAdjacentPosts,
  getPostReadingMinutes,
  getRelatedPosts,
} from "../src/lib/blog.js";

const customDomainPost = posts.find((post) => post.id === "github-pages-and-custom-domain");
const aiToolsPost = posts.find((post) => post.id === "organizing-ai-tools");
const favoritesPost = posts.find((post) => post.id === "favorites-and-recent-visits");

test("阅读时长至少为 1 分钟并返回可展示文案", () => {
  assert.ok(customDomainPost);
  assert.equal(getPostReadingMinutes(customDomainPost), 2);
  assert.equal(formatPostReadingTime(customDomainPost), "2 分钟阅读");
});

test("上一篇和下一篇按当前列表顺序返回", () => {
  assert.ok(aiToolsPost);
  const sourcePosts = posts.slice(0, 4);

  const adjacentPosts = getAdjacentPosts(aiToolsPost.id, sourcePosts);

  assert.equal(adjacentPosts.previousPost?.id, "github-pages-and-custom-domain");
  assert.equal(adjacentPosts.nextPost?.id, "favorites-and-recent-visits");
});

test("首篇和末篇文章会正确缺省相邻项", () => {
  const firstAdjacent = getAdjacentPosts(posts[0].id, posts);
  const lastAdjacent = getAdjacentPosts(posts.at(-1)?.id || "", posts);

  assert.equal(firstAdjacent.previousPost, null);
  assert.ok(firstAdjacent.nextPost);
  assert.ok(lastAdjacent.previousPost);
  assert.equal(lastAdjacent.nextPost, null);
});

test("相关文章优先返回标签重合更多且更新的文章", () => {
  const samplePosts = [
    createPost({ id: "current", tags: ["AI", "效率"], publishedAt: "2026-04-17" }),
    createPost({ id: "match-new", tags: ["AI", "效率"], publishedAt: "2026-04-16" }),
    createPost({ id: "match-old", tags: ["AI", "效率"], publishedAt: "2026-04-15" }),
    createPost({ id: "single-tag", tags: ["AI"], publishedAt: "2026-04-18" }),
    createPost({ id: "unrelated", tags: ["设计"], publishedAt: "2026-04-19" }),
  ];
  const relatedPosts = getRelatedPosts("current", samplePosts);

  assert.deepEqual(
    relatedPosts.map((post) => post.id),
    ["match-new", "match-old", "single-tag"],
  );
});

test("没有共同标签时不返回相关文章", () => {
  const isolatedPosts = [
    createPost({ id: "one", tags: ["甲"], publishedAt: "2026-04-17" }),
    createPost({ id: "two", tags: ["乙"], publishedAt: "2026-04-16" }),
  ];

  assert.deepEqual(getRelatedPosts("one", isolatedPosts), []);
});

test("相关文章数量遵守限制", () => {
  assert.ok(favoritesPost);
  const limitedPosts = getRelatedPosts(favoritesPost.id, posts, 1);

  assert.equal(limitedPosts.length, 1);
});

test("当前博客数据没有共同标签时不返回相关文章", () => {
  assert.ok(aiToolsPost);
  assert.deepEqual(getRelatedPosts(aiToolsPost.id, posts), []);
});

function createPost(overrides = {}) {
  return {
    id: "post",
    title: "文章",
    summary: "摘要",
    tags: [],
    publishedAt: "2026-04-17",
    content: ["正文"],
    ...overrides,
  };
}
