import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isPermanentSessionRefreshError, normalizeSyncSession, persistSyncSession } from "../src/features/sync-session.js";
import { requestSupabaseRest, requestSupabaseRestWithSession, revokeSupabaseSession } from "../src/features/supabase.js";

const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

test("同步会话会保留过期时间用于刷新判断", () => {
  const session = normalizeSyncSession({
    session: {
      access_token: "access",
      refresh_token: "refresh",
      expires_at: 1_800_000_000,
      user: {
        id: "user-1",
        email: "user@example.com",
      },
    },
  });

  assert.equal(session.expiresAt, 1_800_000_000_000);
});

test("持久化同步会话会写入过期时间", () => {
  const storage = new Map();
  const adapter = {
    setItem: (key, value) => storage.set(key, value),
  };

  persistSyncSession(adapter, "session", {
    userEmail: "user@example.com",
    userId: "user-1",
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: 1_800_000_000_000,
  });

  assert.equal(JSON.parse(storage.get("session")).expiresAt, 1_800_000_000_000);
});

test("只有明确的鉴权响应才会判定刷新会话永久失效", () => {
  assert.equal(isPermanentSessionRefreshError({ status: 400 }), true);
  assert.equal(isPermanentSessionRefreshError({ status: 401 }), true);
  assert.equal(isPermanentSessionRefreshError({ status: 403 }), true);
  assert.equal(isPermanentSessionRefreshError({ status: 500 }), false);
  assert.equal(isPermanentSessionRefreshError(new TypeError("Failed to fetch")), false);
});

test("Supabase 请求错误会保留 HTTP 状态码", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 503,
    statusText: "Service Unavailable",
    text: async () => JSON.stringify({ message: "暂时不可用" }),
  });

  try {
    await assert.rejects(
      requestSupabaseRest({ enabled: true, url: "https://example.supabase.co", anonKey: "anon" }, "/rest/v1/test"),
      (error) => error.status === 503 && error.message === "暂时不可用",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("鉴权请求遇到 401 会刷新会话并重试一次", async () => {
  const originalFetch = globalThis.fetch;
  const authorizationHeaders = [];
  let accessToken = "expired-access";
  let refreshCount = 0;
  globalThis.fetch = async (_url, options) => {
    authorizationHeaders.push(options.headers.Authorization);
    if (authorizationHeaders.length === 1) {
      return createJsonResponse(false, 401, "Unauthorized", { message: "JWT expired" });
    }

    return createJsonResponse(true, 200, "OK", [{ id: "site-1" }]);
  };

  try {
    const result = await requestSupabaseRestWithSession(
      { enabled: true, url: "https://example.supabase.co", anonKey: "anon" },
      "/rest/v1/user_sites",
      {},
      {
        ensureActive: async () => {},
        getAccessToken: () => accessToken,
        canRefresh: () => true,
        refresh: async () => {
          refreshCount += 1;
          accessToken = "fresh-access";
        },
      },
    );

    assert.deepEqual(result, [{ id: "site-1" }]);
    assert.equal(refreshCount, 1);
    assert.deepEqual(authorizationHeaders, ["Bearer expired-access", "Bearer fresh-access"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("非 JSON 的 Supabase 错误不会覆盖 HTTP 状态", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 502,
    statusText: "Bad Gateway",
    text: async () => "<html>upstream unavailable</html>",
  });

  try {
    await assert.rejects(
      requestSupabaseRest({ enabled: true, url: "https://example.supabase.co", anonKey: "anon" }, "/rest/v1/test"),
      (error) => error.status === 502 && error.message === "Bad Gateway",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("退出登录只撤销当前 Supabase 会话", async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 204,
      statusText: "No Content",
      text: async () => "",
    };
  };

  try {
    await revokeSupabaseSession(
      { enabled: true, url: "https://example.supabase.co", anonKey: "anon" },
      "access-token",
    );

    assert.equal(request.url, "https://example.supabase.co/auth/v1/logout?scope=local");
    assert.equal(request.options.headers.Authorization, "Bearer access-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("密码恢复和退出登录不会跳过个人数据收尾", () => {
  const accountRestoreCalls = mainSource.match(/restoreLocalAccountData\(state\.sync\.userId\)/g) || [];
  assert.equal(accountRestoreCalls.length, 3);
  assert.match(mainSource, /pendingSnapshot[\s\S]*keepalive: true/);
});

function createJsonResponse(ok, status, statusText, payload) {
  return {
    ok,
    status,
    statusText,
    text: async () => JSON.stringify(payload),
  };
}
