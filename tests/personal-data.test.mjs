import test from "node:test";
import assert from "node:assert/strict";
import { createPersonalDataSnapshot, mergePersonalData } from "../src/features/personal-data.js";

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
