const SITE_METADATA_TIMEOUT = 10000;

const HTML_ENTITY_MAP = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export async function fetchSiteMetadata(url, { timeoutMs = SITE_METADATA_TIMEOUT } = {}) {
  const targetUrl = String(url || "").trim();
  const response = await fetch(targetUrl, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "user-agent": "Codex Local Site Metadata Fetcher",
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`抓取失败：HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType && !/html|xhtml/i.test(contentType)) {
    throw new Error(`目标不是 HTML 页面：${contentType}`);
  }

  const html = await response.text();
  return extractSiteMetadata(html, response.url || targetUrl);
}

export function extractSiteMetadata(html, baseUrl) {
  const source = String(html || "");
  const finalUrl = toAbsoluteUrl(baseUrl, baseUrl) || String(baseUrl || "").trim();
  const parsed = tryParseUrl(finalUrl);
  const hostname = parsed?.hostname || "";
  const normalizedHost = hostname.replace(/^www\./i, "");
  const iconHref = pickBestIconHref(source);

  const aliases = Array.from(new Set([normalizedHost, hostname].filter(Boolean)));
  const title = firstNonEmpty([
    readMetaContent(source, "property", "og:site_name"),
    readMetaContent(source, "property", "og:title"),
    readMetaContent(source, "name", "twitter:title"),
    readTitle(source),
    normalizedHost,
  ]);
  const description = firstNonEmpty([
    readMetaContent(source, "name", "description"),
    readMetaContent(source, "property", "og:description"),
    readMetaContent(source, "name", "twitter:description"),
  ]);
  const icon = iconHref
    ? toAbsoluteUrl(iconHref, finalUrl)
    : parsed
      ? `${parsed.origin}/favicon.ico`
      : "";

  return {
    name: title,
    description,
    icon: icon || "",
    aliases,
    finalUrl,
  };
}

function readTitle(source) {
  const match = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(match?.[1] || "");
}

function readMetaContent(source, attrName, attrValue) {
  const pattern = new RegExp(
    `<meta\\b(?=[^>]*\\b${escapeRegExp(attrName)}\\s*=\\s*["']${escapeRegExp(attrValue)}["'])(?=[^>]*\\bcontent\\s*=\\s*["']([^"']*)["'])[^>]*>`,
    "i",
  );
  const match = source.match(pattern);
  return cleanText(match?.[1] || "");
}

function pickBestIconHref(source) {
  const matches = [...source.matchAll(/<link\b(?=[^>]*\brel\s*=\s*["'][^"']*icon[^"']*["'])(?=[^>]*\bhref\s*=\s*["']([^"']+)["'])[^>]*>/ig)];
  if (matches.length === 0) {
    return "";
  }

  const ranked = matches
    .map((match) => {
      const tag = match[0] || "";
      const href = cleanText(match[1] || "");
      const rel = readTagAttribute(tag, "rel").toLowerCase();
      const sizes = readTagAttribute(tag, "sizes").toLowerCase();
      let score = 0;

      if (rel.includes("apple-touch-icon")) {
        score += 40;
      } else if (rel.includes("shortcut icon")) {
        score += 36;
      } else if (rel.includes("icon")) {
        score += 28;
      }

      if (/svg$/i.test(href)) {
        score += 10;
      } else if (/png$/i.test(href)) {
        score += 8;
      } else if (/ico$/i.test(href)) {
        score += 6;
      }

      const area = parseSizesArea(sizes);
      score += Math.min(area / 1024, 12);

      return { href, score };
    })
    .filter((item) => item.href)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.href || "";
}

function readTagAttribute(tag, name) {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*["']([^"']*)["']`, "i");
  const match = String(tag || "").match(pattern);
  return cleanText(match?.[1] || "");
}

function parseSizesArea(value) {
  const text = String(value || "").trim();
  const match = text.match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) {
    return 0;
  }

  return Number(match[1]) * Number(match[2]);
}

function cleanText(value) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (token, entity) => {
    const key = String(entity || "").toLowerCase();
    if (key in HTML_ENTITY_MAP) {
      return HTML_ENTITY_MAP[key];
    }

    if (key.startsWith("#x")) {
      const codePoint = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : token;
    }

    if (key.startsWith("#")) {
      const codePoint = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : token;
    }

    return token;
  });
}

function toAbsoluteUrl(candidate, baseUrl) {
  try {
    return new URL(String(candidate || "").trim(), String(baseUrl || "").trim()).href;
  } catch {
    return "";
  }
}

function tryParseUrl(value) {
  try {
    return new URL(String(value || "").trim());
  } catch {
    return null;
  }
}

function firstNonEmpty(values) {
  return values.find((value) => String(value || "").trim()) || "";
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
