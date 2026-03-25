import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { posts } from "../src/data/posts.js";
import { siteMeta } from "../src/data/site.js";
import { buildRss, buildSitemap, buildRobots } from "../src/lib/seo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");

const sortedPosts = [...posts].sort(
  (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
);

await mkdir(publicDir, { recursive: true });
await writeFile(path.join(publicDir, "rss.xml"), buildRss(sortedPosts, siteMeta), "utf8");
await writeFile(path.join(publicDir, "sitemap.xml"), buildSitemap(sortedPosts, siteMeta), "utf8");
await writeFile(path.join(publicDir, "robots.txt"), buildRobots(siteMeta), "utf8");
