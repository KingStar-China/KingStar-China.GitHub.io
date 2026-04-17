import test from "node:test";
import assert from "node:assert/strict";
import {
  closeCommandPalette,
  getCommandSections,
  openCommandPalette,
  runCommandResult,
} from "../src/lib/command-palette.js";

test("命令面板默认显示最近访问和最新文章", () => {
  const deps = createPaletteDeps({
    state: {
      commandQuery: "",
      recent: ["site-1"],
    },
    sites: [
      createSite({ id: "site-1", name: "GitHub", category: "外网", tags: ["代码"], description: "代码托管" }),
    ],
    posts: [
      createPost({ id: "post-1", title: "第一篇", publishedAt: "2026-04-17" }),
    ],
  });

  const sections = getCommandSections(deps);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].title, "最近访问");
  assert.equal(sections[0].items[0].title, "GitHub");
  assert.equal(sections[1].title, "最新文章");
});

test("命令面板搜索结果会按站点和博客分组", () => {
  const deps = createPaletteDeps({
    state: {
      commandQuery: "cloud",
      recent: [],
    },
    sites: [
      createSite({ id: "site-1", name: "Cloudflare", description: "CDN", category: "外网" }),
    ],
    posts: [
      createPost({ id: "post-1", title: "Cloudflare Pages", summary: "自定义域名", publishedAt: "2026-04-17" }),
    ],
  });

  const sections = getCommandSections(deps);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].title, "网站结果");
  assert.equal(sections[1].title, "博客结果");
});

test("打开命令面板会重置选中索引", () => {
  const state = {
    commandOpen: false,
    commandIndex: 5,
  };

  openCommandPalette(state);
  assert.equal(state.commandOpen, true);
  assert.equal(state.commandIndex, 0);
});

test("关闭命令面板会清空关键词和索引", () => {
  const state = {
    commandOpen: true,
    commandQuery: "gpt",
    commandIndex: 3,
  };

  closeCommandPalette(state);
  assert.equal(state.commandOpen, false);
  assert.equal(state.commandQuery, "");
  assert.equal(state.commandIndex, 0);
});

test("运行站点结果会直接打开目标 URL 并记录最近访问", () => {
  const openedWindow = { opener: "keep" };
  const tracker = createResultSpies();
  const originalWindow = globalThis.window;
  globalThis.window = {
    open: (...args) => {
      tracker.openCalls.push(args);
      return openedWindow;
    },
  };

  try {
    runCommandResult(
      { kind: "site", id: "site-1" },
      createPaletteDeps({
        state: tracker.state,
        sites: [createSite({ id: "site-1", name: "GitHub", url: "https://github.com/" })],
        hooks: tracker,
      }),
    );
  } finally {
    globalThis.window = originalWindow;
  }

  assert.deepEqual(tracker.openCalls, [["https://github.com/", "_blank", "noopener,noreferrer"]]);
  assert.equal(openedWindow.opener, null);
  assert.deepEqual(tracker.trackRecentCalls, ["site-1"]);
  assert.equal(tracker.closeCalls, 1);
  assert.equal(tracker.renderCalls, 1);
});

test("站点结果被浏览器拦截时不会误更新状态", () => {
  const tracker = createResultSpies();
  const originalWindow = globalThis.window;
  globalThis.window = {
    open: (...args) => {
      tracker.openCalls.push(args);
      return null;
    },
  };

  try {
    runCommandResult(
      { kind: "site", id: "site-1" },
      createPaletteDeps({
        state: tracker.state,
        sites: [createSite({ id: "site-1", name: "GitHub", url: "https://github.com/" })],
        hooks: tracker,
      }),
    );
  } finally {
    globalThis.window = originalWindow;
  }

  assert.deepEqual(tracker.openCalls, [["https://github.com/", "_blank", "noopener,noreferrer"]]);
  assert.deepEqual(tracker.trackRecentCalls, []);
  assert.equal(tracker.closeCalls, 0);
  assert.equal(tracker.renderCalls, 0);
});

test("运行博客结果会打开文章并关闭面板", () => {
  const tracker = createResultSpies();

  runCommandResult(
    { kind: "post", id: "post-1" },
    createPaletteDeps({
      state: tracker.state,
      posts: [createPost({ id: "post-1", title: "测试文章" })],
      hooks: tracker,
    }),
  );

  assert.deepEqual(tracker.openPostCalls, ["post-1"]);
  assert.equal(tracker.closeCalls, 1);
  assert.equal(tracker.renderCalls, 1);
});

test("运行动作结果会切换导航视图并关闭面板", () => {
  const tracker = createResultSpies();
  const deps = createPaletteDeps({
    state: tracker.state,
    hooks: tracker,
  });

  runCommandResult(
    { kind: "action", id: "nav-recent" },
    deps,
  );

  assert.equal(deps.state.section, "nav");
  assert.equal(deps.state.view, "recent");
  assert.equal(tracker.resetNavFiltersCalls, 1);
  assert.equal(tracker.closeCalls, 1);
  assert.equal(tracker.renderCalls, 1);
});

function createPaletteDeps({ state = {}, sites = [], posts = [], hooks = {} } = {}) {
  const siteMap = new Map(sites.map((site) => [site.id, site]));

  return {
    state: {
      commandQuery: "",
      recent: [],
      section: "nav",
      view: "all",
      ...state,
    },
    sites,
    posts,
    siteMap,
    commandResultLimit: 8,
    getSiteSearchScore: (site, query) => String(site.name || "").toLowerCase().includes(String(query || "").toLowerCase()) ? 100 : 0,
    getPostSearchScore: (post, query) => String(post.title || "").toLowerCase().includes(String(query || "").toLowerCase()) ? 100 : 0,
    getHost: (url) => new URL(url).host,
    formatShortDate: (date) => date,
    trackRecent: hooks.trackRecent || (() => {}),
    closeCommandPalette: hooks.closeCommandPalette || (() => {}),
    render: hooks.render || (() => {}),
    openPost: hooks.openPost || (() => {}),
    resetNavFilters: hooks.resetNavFilters || (() => {}),
  };
}

function createResultSpies() {
  const state = {
    commandQuery: "",
    recent: [],
    section: "nav",
    view: "all",
  };

  const tracker = {
    state,
    openCalls: [],
    trackRecentCalls: [],
    openPostCalls: [],
    closeCalls: 0,
    renderCalls: 0,
    resetNavFiltersCalls: 0,
  };

  tracker.trackRecent = (id) => {
    tracker.trackRecentCalls.push(id);
  };
  tracker.openPost = (id) => {
    tracker.openPostCalls.push(id);
  };
  tracker.closeCommandPalette = () => {
    tracker.closeCalls += 1;
  };
  tracker.render = () => {
    tracker.renderCalls += 1;
  };
  tracker.resetNavFilters = () => {
    tracker.resetNavFiltersCalls += 1;
  };

  return tracker;
}

function createSite(overrides = {}) {
  return {
    id: "site",
    name: "网站",
    url: "https://example.com/",
    category: "分类",
    description: "说明",
    tags: [],
    ...overrides,
  };
}

function createPost(overrides = {}) {
  return {
    id: "post",
    title: "文章",
    summary: "摘要",
    tags: [],
    publishedAt: "2026-04-17",
    ...overrides,
  };
}
