export function normalizeMarkdownContent(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

export function parsePostMarkdown(source, id) {
  const normalized = String(source || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`${id}.md 缺少 front matter`);
  return { id, ...parseFrontMatter(match[1], id), content: normalizeMarkdownContent(match[2]) };
}

function parseFrontMatter(block, id) {
  const metadata = { title: "", summary: "", publishedAt: "", tags: [] };
  const lines = String(block || "").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trimEnd();
    if (!line.trim()) continue;
    if (/^tags\s*:\s*$/.test(line)) {
      const tags = [];
      while (index + 1 < lines.length && /^\s*-\s+/.test(lines[index + 1])) {
        index += 1;
        tags.push(parseScalar(lines[index].replace(/^\s*-\s+/, "")));
      }
      metadata.tags = tags.filter(Boolean);
      continue;
    }
    const scalarMatch = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!scalarMatch) throw new Error(`${id}.md front matter 无法解析：${line}`);
    const [, key, value] = scalarMatch;
    if (Object.hasOwn(metadata, key)) metadata[key] = parseScalar(value);
  }
  return metadata;
}

function parseScalar(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    try {
      return JSON.parse(text.startsWith("'") ? `"${text.slice(1, -1).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : text);
    } catch {
      return text.slice(1, -1);
    }
  }
  return text;
}

export function serializePostMarkdown(post) {
  const tags = Array.isArray(post.tags) ? post.tags : [];
  return [
    "---",
    `title: ${JSON.stringify(String(post.title || "").trim())}`,
    `summary: ${JSON.stringify(String(post.summary || "").trim())}`,
    `publishedAt: ${JSON.stringify(String(post.publishedAt || "").trim())}`,
    "tags:",
    ...tags.map((tag) => `  - ${JSON.stringify(String(tag || "").trim())}`),
    "---", "", normalizeMarkdownContent(post.content), "",
  ].join("\n");
}
