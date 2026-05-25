export function loadSyncSession(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    if (!value || typeof value !== "object") {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

export function persistSyncSession(storage, key, syncState) {
  storage.setItem(key, JSON.stringify({
    userEmail: syncState.userEmail,
    userId: syncState.userId,
    accessToken: syncState.accessToken,
    refreshToken: syncState.refreshToken,
    expiresAt: syncState.expiresAt || 0,
  }));
}

export function removeSyncSession(storage, key) {
  storage.removeItem(key);
}

export function getAuthAccessToken(session) {
  return session?.session?.access_token || session?.access_token || "";
}

export function normalizeSyncSession(session, fallback = {}) {
  const activeSession = session.session || session;
  const user = activeSession.user || session.user || {};

  return {
    signedIn: true,
    userEmail: String(user.email || fallback.email || ""),
    userId: String(user.id || fallback.userId || ""),
    accessToken: String(activeSession.access_token || ""),
    refreshToken: String(activeSession.refresh_token || fallback.refreshToken || ""),
    expiresAt: normalizeExpiresAt(activeSession, fallback.expiresAt),
  };
}

function normalizeExpiresAt(session, fallbackExpiresAt = 0) {
  if (Number.isFinite(session.expires_at)) {
    return session.expires_at * 1000;
  }

  if (Number.isFinite(session.expires_in)) {
    return Date.now() + session.expires_in * 1000;
  }

  return Number(fallbackExpiresAt) || 0;
}
