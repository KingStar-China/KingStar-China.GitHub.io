import test from "node:test";
import assert from "node:assert/strict";
import { createPersonalDataSnapshot, mergePersonalData } from "../src/features/personal-data.js";
import { renderUserPage } from "../src/pages/user.js";

test("个人数据快照会在站点索引可用后保留最近访问", () => {
  const validSiteIds = new Set(["default-site", "remote-user-site"]);
  const state = {
    favorites: new Set(["remote-user-site", "missing-site"]),
    recent: ["remote-user-site", "default-site", "missing-site"],
    workbenchNote: "",
    workbenchTodos: [],
  };

  const snapshot = createPersonalDataSnapshot(state, validSiteIds, 20);

  assert.deepEqual(snapshot.favorites, ["remote-user-site"]);
  assert.deepEqual(snapshot.recent, ["remote-user-site", "default-site"]);
});

test("合并个人数据时本机最近访问优先于云端旧顺序", () => {
  const validSiteIds = new Set(["new-site", "old-site"]);
  const merged = mergePersonalData(
    {
      favorites: [],
      recent: ["new-site"],
      workbenchNote: "",
      workbenchTodos: [],
    },
    {
      favorites: [],
      recent: ["old-site", "new-site"],
      workbenchNote: "",
      workbenchTodos: [],
    },
    validSiteIds,
    20,
  );

  assert.deepEqual(merged.recent, ["new-site", "old-site"]);
});

test("已登录用户页默认只展示个人站点管理内容", () => {
  const markup = renderTestUserPage();

  assert.match(markup, /我的站点/);
  assert.match(markup, /用户站点一/);
  assert.match(markup, /data-action="open-add-user-site"/);
  assert.match(markup, /data-action="open-user-settings"/);
  assert.match(markup, /name="user-site-filter"/);
  assert.match(markup, /data-lpignore="true"/);
  assert.doesNotMatch(markup, /当前密码/);
  assert.doesNotMatch(markup, /data-user-site-field="url"/);
});

test("登录路由显示账号表单并使用独立的自动填充字段", () => {
  const markup = renderTestUserPage({
    section: "login",
    sync: {
      signedIn: false,
    },
  });

  assert.match(markup, /登录到少昊导航/);
  assert.match(markup, /name="username"/);
  assert.match(markup, /autocomplete="username"/);
  assert.match(markup, /name="current-password"/);
});

test("用户后台恢复会话时不会渲染登录账号输入框", () => {
  const markup = renderTestUserPage({
    section: "user",
    sync: {
      signedIn: false,
    },
  });

  assert.match(markup, /正在恢复登录状态/);
  assert.doesNotMatch(markup, /data-role="sync-email"/);
  assert.doesNotMatch(markup, /data-role="sync-password"/);
});

test("添加网站按钮对应独立网站表单弹窗", () => {
  const markup = renderTestUserPage({
    userSiteModalOpen: true,
  });

  assert.match(markup, /aria-labelledby="user-site-form-title"/);
  assert.match(markup, /id="user-site-form-title">添加网站/);
  assert.match(markup, /data-user-site-field="url"/);
  assert.match(markup, /data-action="add-user-site"/);
});

test("账户设置只在设置弹窗中显示同步和密码操作", () => {
  const markup = renderTestUserPage({
    userSettingsOpen: true,
  });

  assert.match(markup, /id="user-settings-title">账户设置/);
  assert.match(markup, /data-action="sync-now"/);
  assert.match(markup, /data-role="sync-current-password"/);
  assert.match(markup, /data-action="sync-sign-out"/);
});

function renderTestUserPage(stateOverrides = {}) {
  const userSite = {
    id: "user-site-1",
    name: "用户站点一",
    url: "https://example.com",
    category: "工具",
    tags: ["自定义"],
    aliases: [],
    description: "测试站点",
    source: "user",
  };
  const sync = {
    signedIn: true,
    enabled: true,
    busy: false,
    authMode: "",
    userEmail: "user@example.com",
    email: "user@example.com",
    message: "同步可用",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    ...stateOverrides.sync,
  };
  const state = {
    section: "user",
    sync,
    userSites: [userSite],
    userSiteQuery: "",
    userSiteCategory: "all",
    userSiteEditingId: "",
    userSiteModalOpen: false,
    userSettingsOpen: false,
    userSiteDraft: {
      name: "",
      url: "",
      icon: "",
      category: "",
      tags: "",
      aliases: "",
      description: "",
    },
    ...stateOverrides,
    sync,
  };

  return renderUserPage({
    state,
    escapeHTML: (value) => String(value),
    getHost: (url) => new URL(url).host,
    renderSiteCard: (site) => `<article data-site-id="${site.id}">${site.name}</article>`,
    categoryOrder: ["工具"],
    allSites: [userSite],
  });
}
