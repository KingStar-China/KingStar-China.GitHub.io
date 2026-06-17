import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";

function extractInitialThemeScript() {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const match = html.match(/<script>\s*(\(\(\) => \{[\s\S]*?\}\)\(\);\s*)<\/script>/);

  if (!match) {
    throw new Error("Initial theme script not found");
  }

  return match[1];
}

function runInitialThemeScript(entries) {
  const storage = new Map(entries);
  const documentElement = {
    dataset: {},
    style: {},
  };
  const context = createContext({
    document: {
      documentElement,
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    Set,
  });

  new Script(extractInitialThemeScript()).runInContext(context);

  return {
    documentElement,
    storage,
  };
}

test("旧主题缓存会迁移为深色首屏", () => {
  const { documentElement, storage } = runInitialThemeScript([
    ["nav-tool.theme", "light"],
  ]);

  assert.equal(documentElement.dataset.theme, "dark");
  assert.equal(documentElement.style.colorScheme, "dark");
  assert.equal(storage.get("nav-tool.theme"), "dark");
  assert.equal(storage.get("nav-tool.themeVersion"), "2");
});

test("新版主题缓存会保留用户主动选择", () => {
  const { documentElement, storage } = runInitialThemeScript([
    ["nav-tool.theme", "light"],
    ["nav-tool.themeVersion", "2"],
  ]);

  assert.equal(documentElement.dataset.theme, "light");
  assert.equal(documentElement.style.colorScheme, "light");
  assert.equal(storage.get("nav-tool.theme"), "light");
  assert.equal(storage.get("nav-tool.themeVersion"), "2");
});
