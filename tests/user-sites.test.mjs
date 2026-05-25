import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUserSiteDraft } from "../src/features/user-sites.js";

test("自定义站点地址和图标地址缺少协议时默认补全 https", () => {
  const site = normalizeUserSiteDraft({
    name: "示例",
    url: "example.com",
    icon: "example.com/favicon.ico",
    category: "",
    tags: "",
    description: "",
  });

  assert.equal(site.url, "https://example.com/");
  assert.equal(site.icon, "https://example.com/favicon.ico");
});

test("自定义站点图标地址为空时保持为空", () => {
  const site = normalizeUserSiteDraft({
    name: "示例",
    url: "https://example.com",
    icon: "",
  });

  assert.equal(site.icon, "");
});
