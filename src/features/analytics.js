const VISITOR_ID_KEY = "nav-tool.analytics.visitorId";
const VISITOR_ID_PREFIX = "visitor";

export function getAnalyticsVisitorId(storage, key = VISITOR_ID_KEY) {
  const existing = String(storage.getItem(key) || "").trim();
  if (existing) {
    return existing;
  }

  const id = createVisitorId();
  storage.setItem(key, id);
  return id;
}

export function buildPageViewEvent(location, documentRef, visitorId, now = new Date()) {
  const url = new URL(location.href);
  const route = parseAnalyticsRoute(url);

  return {
    visitor_id: visitorId,
    path: normalizePath(url),
    route_type: route.type,
    route_value: route.value,
    title: String(documentRef.title || "").slice(0, 160),
    referrer: normalizeReferrer(documentRef.referrer, url.origin),
    user_agent: String(navigator.userAgent || "").slice(0, 240),
    occurred_at: now.toISOString(),
  };
}

function createVisitorId() {
  if (globalThis.crypto?.randomUUID) {
    return `${VISITOR_ID_PREFIX}-${globalThis.crypto.randomUUID()}`;
  }

  return `${VISITOR_ID_PREFIX}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePath(url) {
  return `${url.pathname}${url.search}${url.hash}`.slice(0, 500) || "/";
}

function normalizeReferrer(referrer, ownOrigin) {
  if (!referrer) {
    return "";
  }

  try {
    const url = new URL(referrer);
    return url.origin === ownOrigin ? "" : url.origin.slice(0, 120);
  } catch {
    return "";
  }
}

function parseAnalyticsRoute(url) {
  const section = url.searchParams.get("section") || "";
  const postId = url.searchParams.get("post") || "";

  if (postId) {
    return { type: "post", value: postId.slice(0, 120) };
  }

  if (section === "blog") {
    return { type: "blog", value: "" };
  }

  if (section === "user" || section === "promo") {
    return { type: "user", value: "" };
  }

  const hash = String(url.hash || "").replace(/^#/, "");
  if (hash.startsWith("/post/")) {
    return { type: "post", value: decodeURIComponent(hash.slice("/post/".length).split("?")[0] || "").slice(0, 120) };
  }

  if (hash.startsWith("/blog")) {
    return { type: "blog", value: "" };
  }

  if (hash.startsWith("/user") || hash.startsWith("/promo")) {
    return { type: "user", value: "" };
  }

  return { type: "nav", value: "" };
}
