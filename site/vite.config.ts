import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { klallamAssets } from "@klallam/game-kit/vite";

const siteRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(siteRoot, "..");
const gamesRoot = path.resolve(repoRoot, "games");

export default defineConfig({
  // Paths relative to the page, so the built site works from a sub-folder such as
  // the GitHub Pages address rather than only at the top of a domain.
  base: "./",
  plugins: [klallamAssets()],
  // These packages ship TypeScript source, so they must go through the transform
  // pipeline rather than the dependency pre-bundler.
  optimizeDeps: {
    exclude: [
      "@klallam/lexicon",
      "@klallam/game-kit",
      "@klallam/fishybird",
      "@klallam/flashcards",
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
