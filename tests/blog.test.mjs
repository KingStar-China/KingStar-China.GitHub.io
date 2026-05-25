import test from "node:test";
import assert from "node:assert/strict";
import { posts } from "../src/data/posts.js";
import {
  formatPostReadingTime,
  getAdjacentPosts,
  getPostReadingMinutes,
  getRelatedPosts,
} from "../src/lib/blog.js";

test("阅读时长至少为 1 分钟并返回可展示文案", () => {
  const shortPost = createPost({ content: "短正文" });

  assert.equal(getPostReadingMinutes(shortPost), 1);
  assert.equal(formatPostReadingTime(shortPost), "1 分钟阅读");
});

test("上一篇和下一篇按当前列表顺序返回", () => {
  const sourcePosts = [
    createPost({ id: "previous" }),
    createPost({ id: "current" }),
    createPost({ id: "next" }),
  ];

  const adjacentPosts = getAdjacentPosts("current", sourcePosts);

  assert.equal(adjacentPosts.previousPost?.id, "previous");
  assert.equal(adjacentPosts.nextPost?.id, "next");
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
  const relatedPosts = [
    createPost({ id: "current", tags: ["AI"] }),
    createPost({ id: "one", tags: ["AI"], publishedAt: "2026-04-18" }),
    createPost({ id: "two", tags: ["AI"], publishedAt: "2026-04-19" }),
  ];
  const limitedPosts = getRelatedPosts("current", relatedPosts, 1);

  assert.equal(limitedPosts.length, 1);
});

test("没有当前文章时不返回相关文章", () => {
  assert.deepEqual(getRelatedPosts("missing", posts), []);
});

function createPost(overrides = {}) {
  return {
    id: "post",
    title: "文章",
    summary: "摘要",
    tags: [],
    publishedAt: "2026-04-17",
    content: "正文",
    ...overrides,
  };
}
