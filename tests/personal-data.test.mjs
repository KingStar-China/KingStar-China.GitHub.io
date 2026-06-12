import test from "node:test";
import assert from "node:assert/strict";
import { createPersonalDataSnapshot, mergePersonalData } from "../src/features/personal-data.js";
import { renderUserStats } from "../src/pages/user.js";

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

test("用户页右侧统计显示用户后台数据", () => {
  const markup = renderUserStats({
    state: {
      sync: {
        signedIn: true,
        enabled: true,
      },
      userSites: [{ id: "site-1" }, { id: "site-2" }],
    },
    createStatCard: (label, value) => `<article><span>${label}</span><strong>${value}</strong></article>`,
  });

  assert.match(markup, /账号状态[\s\S]*已登录/);
  assert.match(markup, /我的站点[\s\S]*2/);
  assert.match(markup, /同步状态[\s\S]*可用/);
  assert.match(markup, /权限范围[\s\S]*个人/);
});
