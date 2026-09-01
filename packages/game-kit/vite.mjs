import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const KIT_ROOT = path.dirname(fileURLToPath(import.meta.url));
// Found through the package rather than by counting folders, so this keeps working
// wherever the kit sits relative to the lexicon.
const LEXICON_DIR = path.dirname(require.resolve("@klallam/lexicon/lexicon.json"));
const AUDIO_DIR = path.join(LEXICON_DIR, "audio");

function resolveInsideAudioDir(pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/audio\/?/, "");
  if (!relative) return null;
  const resolved = path.resolve(AUDIO_DIR, relative);
  if (!resolved.startsWith(AUDIO_DIR + path.sep)) return null;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
  return resolved;
}

/**
 * The recordings stay in the lexicon package. Everything that shows Klallam reaches
 * them at /audio/* rather than keeping a second copy of its own.
 */
export function lexiconAudio() {
  return [
    {
      name: "klallam-lexicon-audio-serve",
      apply: "serve",
      config() {
        // The dev server has to be told it may read outside the app root. Named
        // explicitly rather than opening the whole repo, because game:lan puts this
        // server on the local network.
        return { server: { fs: { allow: [KIT_ROOT, LEXICON_DIR] } } };
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ?? "";
          if (!url.startsWith("/audio/")) return next();
          const file = resolveInsideAudioDir(new URL(url, "http://localhost").pathname);
          if (file === null) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }
          res.setHeader("Content-Type", "audio/mpeg");
          fs.createReadStream(file).pipe(res);
        });
      },
    },
    {
      name: "klallam-lexicon-audio-build",
      apply: "build",
      generateBundle() {
        for (const name of fs.readdirSync(AUDIO_DIR)) {
          if (path.extname(name).toLowerCase() !== ".mp3") continue;
          this.emitFile({
            type: "asset",
            fileName: `audio/${name}`,
            source: fs.readFileSync(path.join(AUDIO_DIR, name)),
          });
        }
      },
    },
  ];
}
