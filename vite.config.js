import { defineConfig } from "vite";
import { syncGeneratedPostsData } from "./scripts/posts-content.mjs";

export default defineConfig({
  plugins: [
    {
      name: "sync-posts-markdown",
      async buildStart() {
        await syncGeneratedPostsData();
      },
      configureServer(server) {
        const syncPosts = async () => {
          await syncGeneratedPostsData();
          server.ws.send({ type: "full-reload" });
        };

        server.watcher.add("src/content/posts/*.md");
        server.watcher.on("add", (file) => {
          if (file.includes("src/content/posts/") && file.endsWith(".md")) {
            syncPosts().catch((error) => {
              server.config.logger.error(error instanceof Error ? error.message : String(error));
            });
          }
        });
        server.watcher.on("change", (file) => {
          if (file.includes("src/content/posts/") && file.endsWith(".md")) {
            syncPosts().catch((error) => {
              server.config.logger.error(error instanceof Error ? error.message : String(error));
            });
          }
        });
        server.watcher.on("unlink", (file) => {
          if (file.includes("src/content/posts/") && file.endsWith(".md")) {
            syncPosts().catch((error) => {
              server.config.logger.error(error instanceof Error ? error.message : String(error));
            });
          }
        });
      },
    },
  ],
  base: "./",
});
