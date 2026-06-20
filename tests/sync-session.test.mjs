import test from "node:test";
import assert from "node:assert/strict";
import { isPermanentSessionRefreshError, normalizeSyncSession, persistSyncSession } from "../src/features/sync-session.js";
import { requestSupabaseRest } from "../src/features/supabase.js";

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
