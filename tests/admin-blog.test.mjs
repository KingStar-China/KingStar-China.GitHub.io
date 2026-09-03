import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createAdminBlogHandler } from "../supabase/functions/admin-blog/handler.js";
import { parsePostMarkdown, serializePostMarkdown } from "../src/lib/post-markdown.js";
import { previewDocument } from "../public/admin/blog.js";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_C = "c".repeat(40);
const GITHUB_PREFIX = "/repos/KingStar-China/KingStar-China.GitHub.io";

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers });
}

function encodedFile(source, sha = SHA_A) {
  return {
    type: "file",
    encoding: "base64",
    size: Buffer.byteLength(source),
    sha,
    content: Buffer.from(source).toString("base64"),
  };
}

function createHarness({ admin = true, github, renderMarkdown = (content) => `<p>${content}</p>`, githubToken = "server-token" } = {}) {
  const calls = [];
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input);
    calls.push({ url, options });
    if (url.hostname === "supabase.test" && url.pathname === "/auth/v1/user") {
      return json({ id: "admin-id", email: "ignored@example.com", user_metadata: { role: "admin" } });
    }
    if (url.hostname === "supabase.test" && url.pathname === "/rest/v1/admin_users") {
      return json(admin ? [{ user_id: "admin-id" }] : []);
    }
    if (url.hostname === "api.github.com") {
      return github ? github(url, options, calls) : json({ message: "unexpected GitHub call" }, 500);
    }
    return json({ message: "unexpected request" }, 500);
  };
  return {
    calls,
    handler: createAdminBlogHandler({
      supabaseUrl: "https://supabase.test",
      supabaseKey: "public-key",
      githubToken,
      renderMarkdown,
      fetchImpl,
    }),
  };
}

function request(handler, body, options = {}) {
  return handler(new Request("https://zfvwrnuenurxauvvfsuw.supabase.co/functions/v1/admin-blog", {
    method: options.method || "POST",
    headers: {
      ...(options.auth === false ? {} : { Authorization: "Bearer user-token" }),
      ...(options.contentType === false ? {} : { "Content-Type": "application/json" }),
      ...(options.origin ? { Origin: options.origin } : {}),
    },
    body: options.method === "OPTIONS" ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  }));
}

function validPost(overrides = {}) {
  return {
    id: "test-post",
    title: "中文标题",
    summary: "测试摘要",
    publishedAt: "2026-09-03",
    tags: ["测试", "Markdown"],
    content: "## 正文\n\n内容",
    ...overrides,
  };
}

test("博客接口拒绝未登录和非管理员请求，且不访问 GitHub", async () => {
  const unauthenticated = createHarness();
  const unauthenticatedResponse = await request(unauthenticated.handler, { action: "list" }, { auth: false });
  assert.equal(unauthenticatedResponse.status, 401);
  assert.equal(unauthenticated.calls.length, 0);

  const ordinaryUser = createHarness({ admin: false });
  const ordinaryResponse = await request(ordinaryUser.handler, { action: "list" });
  assert.equal(ordinaryResponse.status, 403);
  assert.equal(ordinaryUser.calls.filter(({ url }) => url.hostname === "api.github.com").length, 0);
});

test("博客接口只允许配置的站点来源并正确响应预检", async () => {
  const harness = createHarness();
  const preflight = await request(harness.handler, null, {
    method: "OPTIONS",
    origin: "https://845864204.xyz",
    auth: false,
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://845864204.xyz");
  assert.equal(harness.calls.length, 0);

  const rejected = await request(harness.handler, { action: "list" }, { origin: "https://example.com" });
  assert.equal(rejected.status, 403);
  assert.equal(harness.calls.length, 0);
});

test("列出文章时读取固定仓库并返回元数据，不下发正文", async () => {
  const older = serializePostMarkdown(validPost({ id: "older", title: "较早文章", publishedAt: "2026-08-01" }));
  const newer = serializePostMarkdown(validPost({ id: "newer", title: "较新文章", publishedAt: "2026-09-01" }));
  const files = [
    { type: "file", name: "older.md", sha: SHA_A, size: Buffer.byteLength(older) },
    { type: "file", name: "newer.md", sha: SHA_B, size: Buffer.byteLength(newer) },
    { type: "file", name: "../escape.md", sha: SHA_C, size: 1 },
  ];
  const harness = createHarness({
    github(url) {
      if (url.pathname === `${GITHUB_PREFIX}/contents/src/content/posts`) return json(files);
      if (url.pathname === `${GITHUB_PREFIX}/git/blobs/${SHA_A}`) return json(encodedFile(older, SHA_A));
      if (url.pathname === `${GITHUB_PREFIX}/git/blobs/${SHA_B}`) return json(encodedFile(newer, SHA_B));
      return json({}, 404);
    },
  });
  const response = await request(harness.handler, { action: "list" });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.posts.map((post) => post.id), ["newer", "older"]);
  assert.equal(payload.posts[0].title, "较新文章");
  assert.equal("content" in payload.posts[0], false);
  assert.equal(harness.calls.some(({ url }) => url.pathname.includes("escape")), false);
});

test("读取文章时支持 UTF-8 Markdown 并返回版本 SHA", async () => {
  const source = serializePostMarkdown(validPost());
  const harness = createHarness({
    github(url) {
      assert.equal(url.pathname, `${GITHUB_PREFIX}/contents/src/content/posts/test-post.md`);
      assert.equal(url.searchParams.get("ref"), "main");
      return json(encodedFile(source));
    },
  });
  const response = await request(harness.handler, { action: "get", id: "test-post" });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(payload.post, validPost());
  assert.equal(payload.sha, SHA_A);
});

test("保存文章只写固定路径和 main 分支，并携带当前 SHA", async () => {
  const before = serializePostMarkdown(validPost({ title: "旧标题" }));
  let putBody;
  const harness = createHarness({
    github(url, options) {
      if (options.method === "PUT") {
        putBody = JSON.parse(options.body);
        assert.equal(url.pathname, `${GITHUB_PREFIX}/contents/src/content/posts/test-post.md`);
        return json({ content: { sha: SHA_B }, commit: { sha: SHA_C } });
      }
      return json(encodedFile(before));
    },
  });
  const next = validPost({ title: "新标题" });
  const response = await request(harness.handler, {
    action: "save",
    post: next,
    sha: SHA_A,
    repository: "attacker/other",
    branch: "unsafe",
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.commit, SHA_C);
  assert.equal(putBody.branch, "main");
  assert.equal(putBody.sha, SHA_A);
  assert.deepEqual(parsePostMarkdown(Buffer.from(putBody.content, "base64").toString(), "test-post"), next);
});

test("版本不一致时返回冲突并阻止覆盖", async () => {
  let writeCount = 0;
  const harness = createHarness({
    github(_url, options) {
      if (options.method === "PUT") writeCount += 1;
      return json(encodedFile(serializePostMarkdown(validPost({ title: "仓库新版本" }))));
    },
  });
  const response = await request(harness.handler, { action: "save", post: validPost({ title: "编辑窗口旧版本" }), sha: SHA_B });
  assert.equal(response.status, 409);
  assert.equal(writeCount, 0);
  assert.match((await response.json()).message, /版本已变化/);
});

test("丢失响应后的相同保存重试不会生成重复提交", async () => {
  let writeCount = 0;
  const post = validPost();
  const harness = createHarness({
    github(_url, options) {
      if (options.method === "PUT") writeCount += 1;
      return json(encodedFile(serializePostMarkdown(post)));
    },
  });
  const response = await request(harness.handler, { action: "save", post, sha: SHA_B });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.unchanged, true);
  assert.equal(payload.sha, SHA_A);
  assert.equal(writeCount, 0);
});

test("删除文章检查当前版本并提交到固定分支", async () => {
  let deleteBody;
  const harness = createHarness({
    github(_url, options) {
      if (options.method === "DELETE") {
        deleteBody = JSON.parse(options.body);
        return json({ commit: { sha: SHA_C } });
      }
      return json(encodedFile(serializePostMarkdown(validPost())));
    },
  });
  const response = await request(harness.handler, { action: "delete", id: "test-post", sha: SHA_A });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id: "test-post", commit: SHA_C });
  assert.deepEqual(deleteBody, { message: "删除博客：test-post", branch: "main", sha: SHA_A });
});

test("文章 ID 不能用于目录穿越", async () => {
  const harness = createHarness();
  const response = await request(harness.handler, { action: "get", id: "../secrets" });
  assert.equal(response.status, 400);
  assert.equal(harness.calls.filter(({ url }) => url.hostname === "api.github.com").length, 0);
});

test("预览要求管理员权限且由服务端渲染", async () => {
  const harness = createHarness({ githubToken: "", renderMarkdown: (content) => `<h2>${content}</h2>` });
  const response = await request(harness.handler, { action: "preview", content: "预览正文" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { html: "<h2>预览正文</h2>" });
});

test("发布状态只查询既有 Pages 工作流", async () => {
  const harness = createHarness({
    github(url) {
      assert.equal(url.pathname, `${GITHUB_PREFIX}/actions/workflows/deploy.yml/runs`);
      assert.equal(url.searchParams.get("branch"), "main");
      assert.equal(url.searchParams.get("head_sha"), SHA_C);
      return json({ workflow_runs: [{ status: "completed", conclusion: "success", head_sha: SHA_C, html_url: "https://github.com/KingStar-China/KingStar-China.GitHub.io/actions/runs/123" }] });
    },
  });
  const response = await request(harness.handler, { action: "status", commit: SHA_C });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.deployment.conclusion, "success");
});

test("无效请求类型、JSON 和超大请求会被拒绝", async () => {
  const harness = createHarness();
  const wrongType = await request(harness.handler, { action: "list" }, { contentType: false });
  assert.equal(wrongType.status, 415);
  const malformed = await request(harness.handler, "{");
  assert.equal(malformed.status, 400);
  const tooLarge = await request(harness.handler, JSON.stringify({ action: "preview", content: "x".repeat(1024 * 1024) }));
  assert.equal(tooLarge.status, 413);
});

test("现有 Markdown 文章可由共享解析器无损序列化", async () => {
  const directory = new URL("../src/content/posts/", import.meta.url);
  const names = (await readdir(directory)).filter((name) => name.endsWith(".md"));
  assert.ok(names.length > 0);
  for (const name of names) {
    const source = await readFile(new URL(name, directory), "utf8");
    const post = parsePostMarkdown(source, name.slice(0, -3));
    assert.deepEqual(parsePostMarkdown(serializePostMarkdown(post), post.id), post);
  }
});

test("文章预览文档设置禁用脚本的 CSP", () => {
  const document = previewDocument("<p>正文</p><script>alert(1)</script>");
  assert.match(document, /default-src 'none'/);
  assert.match(document, /form-action 'none'/);
  assert.doesNotMatch(document, /script-src 'unsafe-inline'/);
});
