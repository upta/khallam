import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { klallamAssets } from "@klallam/game-kit/vite";

const siteRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(siteRoot, "..");
const gamesRoot = path.resolve(repoRoot, "games");

const require = createRequire(import.meta.url);
const lexiconDir = path.dirname(require.resolve("@klallam/lexicon/lexicon.json"));

/**
 * Serves the review page live at the address the built site already gives it, from
 * the same two files `tools/site/build-site.mjs` copies. One website, one server.
 */
function reviewPage(): Plugin {
  const served = new Map<string, { file: string; type: string }>([
    ["/review/", { file: path.join(lexiconDir, "review", "index.html"), type: "text/html; charset=utf-8" }],
    ["/review/index.html", { file: path.join(lexiconDir, "review", "index.html"), type: "text/html; charset=utf-8" }],
    ["/review/lexicon.json", { file: path.join(lexiconDir, "lexicon.json"), type: "application/json; charset=utf-8" }],
  ]);

  return {
    name: "klallam-review-page",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
        const match = served.get(decodeURIComponent(pathname));
        if (match === undefined) return next();

        res.setHeader("Content-Type", match.type);
        res.setHeader("Cache-Control", "no-store");
        fs.createReadStream(match.file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  // Paths relative to the page, so the built site works from a sub-folder such as
  // the GitHub Pages address rather than only at the top of a domain.
  base: "./",
  plugins: [klallamAssets(), reviewPage()],
  // These packages ship TypeScript source, so they must go through the transform
  // pipeline rather than the dependency pre-bundler.
  optimizeDeps: {
    exclude: [
      "@klallam/lexicon",
      "@klallam/game-kit",
      "@klallam/fishybird",
      "@klallam/flashcards",
      "@klallam/matching",
      "@klallam/quiz",
      "@klallam/wordlist",
    ],
  },
  server: {
    // The kit allows the folders the recordings and the Klallam font come from. This
    // covers the site itself and the games it places.
    fs: {
      allow: [siteRoot, gamesRoot, path.resolve(repoRoot, "node_modules")],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
