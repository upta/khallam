import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { AUDIO_DIR } from "../tools/lexicon-cli/lib.mjs";
import { createReviewServer } from "../tools/lexicon-cli/review-server.mjs";

async function withServer(run) {
  const server = createReviewServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("the review page answers at /review/", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/review/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<html/i);
  });
});

test("the word list answers beside the page", async () => {
  await withServer(async (base) => {
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

  await withServer(async (base) => {
    const res = await fetch(`${base}/audio/${encodeURIComponent(clip)}`);
    assert.equal(res.status, 200);
    assert.ok((await res.arrayBuffer()).byteLength > 0);
  });
});

test("the word list is not served from the root any more", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/lexicon.json`);
    await res.arrayBuffer();
    assert.equal(res.status, 404);
  });
});
