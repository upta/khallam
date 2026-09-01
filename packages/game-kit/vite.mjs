import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const KIT_ROOT = path.dirname(fileURLToPath(import.meta.url));
// Found through the package rather than by counting folders, so this keeps working
// wherever the kit sits relative to the lexicon.
const LEXICON_DIR = path.dirname(require.resolve("@klallam/lexicon/lexicon.json"));

// The recordings stay in the lexicon package and the Klallam font in this one.
// Everything that shows Klallam reaches them here rather than keeping its own copy.
const SHARED_ASSETS = [
  {
    prefix: "/audio/",
    dir: path.join(LEXICON_DIR, "audio"),
    types: { ".mp3": "audio/mpeg" },
  },
  {
    prefix: "/fonts/",
    dir: path.join(KIT_ROOT, "fonts"),
    types: { ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" },
  },
];

function resolveInside(dir, prefix, pathname) {
  const relative = decodeURIComponent(pathname).slice(prefix.length);
  if (!relative) return null;
  const resolved = path.resolve(dir, relative);
  if (!resolved.startsWith(dir + path.sep)) return null;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
  return resolved;
}

/**
 * Serves the shared Klallam assets in development and copies them into the build,
 * so there is only ever one copy of each in the published site.
 */
export function klallamAssets() {
  return [
    {
      name: "klallam-shared-assets-serve",
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
          const asset = SHARED_ASSETS.find((entry) => url.startsWith(entry.prefix));
          if (asset === undefined) return next();

          const pathname = new URL(url, "http://localhost").pathname;
          const file = resolveInside(asset.dir, asset.prefix, pathname);
          const type = file === null ? undefined : asset.types[path.extname(file).toLowerCase()];
          if (file === null || type === undefined) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }
          res.setHeader("Content-Type", type);
          fs.createReadStream(file).pipe(res);
        });
      },
    },
    {
      name: "klallam-shared-assets-build",
      apply: "build",
      generateBundle() {
        for (const asset of SHARED_ASSETS) {
          const folder = asset.prefix.replaceAll("/", "");
          for (const name of fs.readdirSync(asset.dir)) {
            if (asset.types[path.extname(name).toLowerCase()] === undefined) continue;
            this.emitFile({
              type: "asset",
              fileName: `${folder}/${name}`,
              source: fs.readFileSync(path.join(asset.dir, name)),
            });
          }
        }
      },
    },
  ];
}
