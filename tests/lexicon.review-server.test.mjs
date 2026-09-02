import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";
import { AUDIO_DIR, REPO_ROOT } from "../tools/lexicon-cli/lib.mjs";

const SITE_ROOT = path.join(REPO_ROOT, "site");

async function withSite(run) {
  const server = await createServer({
    root: SITE_ROOT,
    configFile: path.join(SITE_ROOT, "vite.config.ts"),
    logLevel: "silent",
    // Any free port, so a dev server someone left running does not fail the checks.
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  await server.listen();
  try {
    await run(`http://127.0.0.1:${server.httpServer.address().port}`);
  } finally {
    await server.close();
  }
}

test("the review page answers at /review/", async () => {
  await withSite(async (base) => {
    const res = await fetch(`${base}/review/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Klallam Lexicon Review/);
  });
});

test("the word list answers beside the page", async () => {
  await withSite(async (base) => {
    const res = await fetch(`${base}/review/lexicon.json`);
    assert.equal(res.status, 200);
    const lexicon = await res.json();
    assert.ok(lexicon.entries.length > 0, "the served word list is empty");
  });
});

test("a recording answers under /audio/", async () => {
  const clip = fs
    .readdirSync(AUDIO_DIR)
    .find((name) => path.extname(name).toLowerCase() === ".mp3");
  assert.ok(clip, "no recordings to check against");

  await withSite(async (base) => {
    const res = await fetch(`${base}/audio/${encodeURIComponent(clip)}`);
    assert.equal(res.status, 200);
    assert.ok((await res.arrayBuffer()).byteLength > 0);
  });
});

test("/review without the slash redirects rather than returning the hub", async () => {
  await withSite(async (base) => {
    const res = await fetch(`${base}/review`, { redirect: "manual" });
    await res.arrayBuffer();
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/review/");
  });
});
