import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSyncSession, persistSyncSession } from "../src/features/sync-session.js";

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
