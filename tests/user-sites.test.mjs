import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRemoteUserSite, normalizeUserSiteDraft } from "../src/features/user-sites.js";

test("自定义站点地址和图标地址缺少协议时默认补全 https", () => {
  const site = normalizeUserSiteDraft({
    name: "示例",
    url: "example.com",
    icon: "example.com/favicon.ico",
    category: "工具",
    tags: "",
    description: "",
  });

  assert.equal(site.url, "https://example.com/");
  assert.equal(site.icon, "https://example.com/favicon.ico");
  assert.equal(site.category, "工具");
});

test("自定义站点图标地址为空时保持为空", () => {
  const site = normalizeUserSiteDraft({
    name: "示例",
    url: "https://example.com",
    icon: "",
    category: "工具",
  });

  assert.equal(site.icon, "");
});

test("自定义站点分类为空时拒绝提交", () => {
  const site = normalizeUserSiteDraft({
    name: "示例",
    url: "https://example.com",
    category: "",
  });

  assert.equal(site, null);
});

test("自定义站点会保存并读取别名", () => {
  const draft = normalizeUserSiteDraft({
    name: "百度",
    url: "baidu.com",
    category: "搜索",
    tags: "",
    aliases: "baidu，百度一下 baidu.com",
  });

  assert.deepEqual(draft.aliases, ["baidu", "百度一下", "baidu.com"]);

  const remote = normalizeRemoteUserSite({
    id: "user-site-1",
    name: "百度",
    url: "https://baidu.com",
    category: "搜索",
    aliases: [" baidu ", "", "百度一下"],
  });

  assert.deepEqual(remote.aliases, ["baidu", "百度一下"]);
});
