import test from "node:test";
import assert from "node:assert/strict";
import { buildPageViewEvent, getAnalyticsVisitorId } from "../src/features/analytics.js";

test("访问统计会复用本地访客标识", () => {
  const storage = new Map([["analytics-key", "visitor-existing"]]);
  const adapter = {
    getItem: (key) => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
  };

  assert.equal(getAnalyticsVisitorId(adapter, "analytics-key"), "visitor-existing");
});

test("访问统计会为新访客生成并保存标识", () => {
  const storage = new Map();
  const adapter = {
    getItem: (key) => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
  };

  const visitorId = getAnalyticsVisitorId(adapter, "analytics-key");

  assert.match(visitorId, /^visitor-/);
  assert.equal(storage.get("analytics-key"), visitorId);
});

test("访问统计会识别文章路由并隐藏站内来源", () => {
  const event = buildPageViewEvent(
    new URL("https://845864204.xyz/?post=20260502113407"),
    {
      title: "文章标题",
      referrer: "https://845864204.xyz/?section=blog",
    },
    "visitor-1",
    new Date("2026-06-04T00:00:00.000Z"),
  );

  assert.equal(event.path, "/?post=20260502113407");
  assert.equal(event.route_type, "post");
  assert.equal(event.route_value, "20260502113407");
  assert.equal(event.referrer, "");
  assert.equal(event.occurred_at, "2026-06-04T00:00:00.000Z");
});

test("访问统计会记录外部来源 origin", () => {
  const event = buildPageViewEvent(
    new URL("https://845864204.xyz/?section=blog"),
    {
      title: "博客",
      referrer: "https://example.com/path?q=1",
    },
    "visitor-1",
  );

  assert.equal(event.route_type, "blog");
  assert.equal(event.referrer, "https://example.com");
});
