import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { lexiconAudio } from "@klallam/game-kit/vite";

const gameRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(gameRoot, "..", "..");

export default defineConfig({
  // Paths relative to the page, so the build works from a sub-folder such as
  // the GitHub Pages address rather than only at the top of a domain.
  base: "./",
  plugins: [lexiconAudio()],
  // These packages ship TypeScript source, so they must go through the transform
  // pipeline rather than the dependency pre-bundler.
  optimizeDeps: { exclude: ["@klallam/lexicon", "@klallam/game-kit"] },
  server: {
    // The kit allows the folders the recordings and its own files come from. This
    // covers the game itself. Named explicitly rather than opening the whole repo,
    // because game:lan puts this server on the local network.
    fs: {
      allow: [gameRoot, path.resolve(repoRoot, "node_modules")],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
