import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { AUDIO_DIR, LEXICON_DIR, LEXICON_JSON } from "./lib.mjs";

const PORT = Number(process.env.PORT ?? 5174);
const REVIEW_PAGE = path.join(LEXICON_DIR, "review", "index.html");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

// The layout the published site already has, so the page works the same in both places.
function fileFor(requested) {
  if (requested === "/review/" || requested === "/review/index.html") return REVIEW_PAGE;
  if (requested === "/review/lexicon.json") return LEXICON_JSON;
  if (requested.startsWith("/audio/")) {
    return path.resolve(AUDIO_DIR, requested.slice("/audio/".length));
  }
  return null;
}

const server = http.createServer((req, res) => {
  const requested = decodeURIComponent(new URL(req.url, "http://localhost").pathname);

  // Without the trailing slash the page asks for its word list a folder too high and comes up empty.
  if (requested === "/" || requested === "/review") {
    res.writeHead(302, { Location: "/review/" }).end();
    return;
  }

  const resolved = fileFor(requested);

  if (resolved === null) {
    res.writeHead(404).end("Not found");
    return;
  }

  // Keep the resolved path inside the lexicon directory.
  if (!resolved.startsWith(LEXICON_DIR + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    res.writeHead(404).end("Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": MIME[path.extname(resolved)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(resolved).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Lexicon review page: http://localhost:${PORT}/review/`);
  console.log("Press Ctrl+C to stop.");
});
