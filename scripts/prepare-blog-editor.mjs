import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VDITOR_VERSION } from "../public/admin/markdown-editor.js";

const source = new URL("../node_modules/vditor/", import.meta.url);
const { version } = JSON.parse(await readFile(new URL("package.json", source), "utf8"));
if (version !== VDITOR_VERSION) throw new Error("Update the editor asset version before building.");
const destination = new URL(`../public/admin/vendor/vditor-${version}/`, import.meta.url);
const files = [
  "LICENSE", "dist/index.min.js", "dist/index.css",
  "dist/js/lute/lute.min.js", "dist/js/i18n/zh_CN.js", "dist/js/icons/ant.js",
  "dist/css/content-theme/dark.css",
];
for (const file of files) {
  const target = new URL(file, destination);
  await mkdir(dirname(fileURLToPath(target)), { recursive: true });
  await copyFile(new URL(file, source), target);
}
console.log(`Prepared local Vditor ${version} assets (${files.length} files).`);
