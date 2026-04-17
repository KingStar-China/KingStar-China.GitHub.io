import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const postImageDir = path.join(rootDir, "public", "post-image");

const MARKDOWN_IMAGE_PATTERN = /!\[([^\]]*)\]\((<[^>]+>|[^)\s]+)([^)]*)\)/g;
const HTML_IMAGE_PATTERN = /<img\b([^>]*?)\bsrc=(["'])([^"'<>]+)\2([^>]*?)>/gi;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const FILE_URL_PATTERN = /^file:\/\//i;
const HTTP_URL_PATTERN = /^https?:\/\//i;
const DATA_IMAGE_PATTERN = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;

export async function importMarkdownDocumentFromFile(filePath) {
  const absoluteFilePath = path.resolve(String(filePath || "").trim());
  const fileName = path.basename(absoluteFilePath);
  const fileBaseName = path.basename(fileName, path.extname(fileName));
  const markdownDir = path.dirname(absoluteFilePath);
  const source = await readFile(absoluteFilePath, "utf8");
  const parsed = parseImportedMarkdownDocument(source, fileBaseName);
  const assetContext = createAssetContext({ markdownDir, fileBaseName });
  const content = await rewriteMarkdownImages(parsed.content, assetContext);

  return {
    ...parsed,
    content,
    assetCount: assetContext.assetCount,
    sourceFileName: fileName,
  };
}

export function parseImportedMarkdownDocument(source, fileBaseName = "导入文章") {
  const normalized = String(source || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    return {
      title: "",
      summary: "",
      publishedAt: "",
      tags: [],
      content: normalizeMarkdownContent(normalized),
      fileBaseName,
    };
  }

  const metadata = parseImportedMarkdownFrontMatter(match[1]);
  return {
    ...metadata,
    content: normalizeMarkdownContent(match[2]),
    fileBaseName,
  };
}

function parseImportedMarkdownFrontMatter(block) {
  const metadata = {
    title: "",
    summary: "",
    publishedAt: "",
    tags: [],
  };
  const lines = String(block || "").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trimEnd();
    if (!line.trim()) {
      continue;
    }

    if (/^tags\s*:\s*$/i.test(line)) {
      const tags = [];
      while (index + 1 < lines.length && /^\s*-\s+/.test(lines[index + 1])) {
        index += 1;
        tags.push(parseImportedMarkdownScalar(lines[index].replace(/^\s*-\s+/, "")));
      }
      metadata.tags = normalizeStringList(tags);
      continue;
    }

    const scalarMatch = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!scalarMatch) {
      continue;
    }

    const [, key, value] = scalarMatch;
    if (!(key in metadata)) {
      continue;
    }

    metadata[key] = parseImportedMarkdownScalar(value);
  }

  return metadata;
}

function parseImportedMarkdownScalar(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
    try {
      return JSON.parse(text.startsWith("'") ? `"${text.slice(1, -1).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : text);
    } catch {
      return text.slice(1, -1);
    }
  }

  return text;
}

function normalizeMarkdownContent(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
  );
}

function createAssetContext({ markdownDir, fileBaseName }) {
  return {
    markdownDir,
    fileBaseName: slugify(fileBaseName) || "post-image",
    importedAssets: new Map(),
    assetCount: 0,
  };
}

async function rewriteMarkdownImages(content, context) {
  let nextContent = String(content || "");
  nextContent = await replaceAsync(nextContent, MARKDOWN_IMAGE_PATTERN, async (match, alt, rawSource, suffix) => {
    const source = unwrapMarkdownUrl(rawSource);
    const nextSource = await importImageSource(source, context);
    if (!nextSource || nextSource === source) {
      return match;
    }
    return `![${alt}](${nextSource}${suffix || ""})`;
  });

  nextContent = await replaceAsync(nextContent, HTML_IMAGE_PATTERN, async (match, before, quote, source, after) => {
    const nextSource = await importImageSource(source, context);
    if (!nextSource || nextSource === source) {
      return match;
    }
    return `<img${before}src=${quote}${nextSource}${quote}${after}>`;
  });

  return nextContent;
}

function unwrapMarkdownUrl(value) {
  const text = String(value || "").trim();
  if (text.startsWith("<") && text.endsWith(">")) {
    return text.slice(1, -1).trim();
  }
  return text;
}

async function importImageSource(source, context) {
  const rawSource = String(source || "").trim();
  if (!rawSource) {
    return rawSource;
  }

  if (rawSource.startsWith("/post-image/")) {
    return rawSource;
  }

  if (rawSource.startsWith("/") && !FILE_URL_PATTERN.test(rawSource) && !WINDOWS_ABSOLUTE_PATH_PATTERN.test(rawSource)) {
    return rawSource;
  }

  const cached = context.importedAssets.get(rawSource);
  if (cached) {
    return cached;
  }

  const asset = DATA_IMAGE_PATTERN.test(rawSource)
    ? await importDataImage(rawSource, context)
    : HTTP_URL_PATTERN.test(rawSource)
      ? await importRemoteImage(rawSource, context)
      : await importLocalImage(rawSource, context);

  context.importedAssets.set(rawSource, asset.publicPath);
  context.assetCount += 1;
  return asset.publicPath;
}

async function importDataImage(source, context) {
  const match = source.match(DATA_IMAGE_PATTERN);
  if (!match) {
    throw new Error("无效的 base64 图片格式。");
  }

  const [, mimeType, payload] = match;
  const buffer = Buffer.from(payload, "base64");
  const extension = getExtensionFromMimeType(mimeType) || ".png";
  return await saveImportedImage(buffer, extension, context);
}

async function importRemoteImage(source, context) {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`下载外链图片失败：${response.status} ${source}`);
  }

  const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (contentType && !contentType.startsWith("image/")) {
    throw new Error(`外链资源不是图片：${source}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const extension = getExtensionFromMimeType(contentType) || getExtensionFromUrl(source) || ".png";
  return await saveImportedImage(buffer, extension, context);
}

async function importLocalImage(source, context) {
  const resolvedPath = resolveLocalImagePath(source, context.markdownDir);
  const buffer = await readFile(resolvedPath);
  const extension = normalizeExtension(path.extname(resolvedPath)) || ".png";
  return await saveImportedImage(buffer, extension, context);
}

function resolveLocalImagePath(source, markdownDir) {
  const text = String(source || "").trim();
  let resolvedPath = text;

  if (FILE_URL_PATTERN.test(text)) {
    resolvedPath = fileURLToPath(new URL(text));
  } else if (!path.isAbsolute(text) && !WINDOWS_ABSOLUTE_PATH_PATTERN.test(text)) {
    resolvedPath = path.resolve(markdownDir, text);
  }

  return resolvedPath;
}

async function saveImportedImage(buffer, extension, context) {
  await mkdir(postImageDir, { recursive: true });

  const normalizedExtension = normalizeExtension(extension) || ".png";
  const filePath = await getNextAvailableImagePath(context.fileBaseName, normalizedExtension);
  await writeFile(filePath, buffer);

  return {
    filePath,
    publicPath: `/post-image/${path.basename(filePath)}`,
  };
}

async function getNextAvailableImagePath(baseName, extension) {
  let index = 1;

  while (true) {
    const fileName = `${baseName}-${index}${extension}`;
    const filePath = path.join(postImageDir, fileName);
    if (!(await fileExists(filePath))) {
      return filePath;
    }
    index += 1;
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getExtensionFromMimeType(mimeType) {
  const normalized = String(mimeType || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (normalized === "image/jpeg") {
    return ".jpg";
  }
  if (normalized === "image/svg+xml") {
    return ".svg";
  }

  const match = normalized.match(/^image\/([a-z0-9.+-]+)$/);
  if (!match) {
    return "";
  }

  return normalizeExtension(`.${match[1].replace("x-icon", "ico").replace("vnd.microsoft.icon", "ico")}`);
}

function getExtensionFromUrl(source) {
  try {
    const pathname = new URL(source).pathname;
    return normalizeExtension(path.extname(pathname));
  } catch {
    return "";
  }
}

function normalizeExtension(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return "";
  }

  if (text === ".jpeg") {
    return ".jpg";
  }
  if (text === ".svg+xml") {
    return ".svg";
  }
  if (!text.startsWith(".")) {
    return `.${text}`;
  }
  return text;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function replaceAsync(input, pattern, replacer) {
  const matches = [...String(input || "").matchAll(pattern)];
  if (matches.length === 0) {
    return String(input || "");
  }

  let lastIndex = 0;
  let result = "";

  for (const match of matches) {
    const index = match.index ?? 0;
    result += input.slice(lastIndex, index);
    result += await replacer(...match);
    lastIndex = index + match[0].length;
  }

  result += input.slice(lastIndex);
  return result;
}
