import { test } from "node:test";
import assert from "node:assert/strict";
import { closestTag, knownTags, readChapters } from "../tools/lexicon-cli/lib.mjs";
import { parseTags } from "../tools/lexicon-cli/sheet-schema.mjs";

test("a capitalised tag still names its chapter", () => {
  assert.deepEqual(parseTags("CH-4"), ["ch-4"]);
  assert.ok(knownTags().includes("ch-4"));
});

test("a tag with stray spaces still names its chapter", () => {
  assert.deepEqual(parseTags("  ch-4  , ch-6 "), ["ch-4", "ch-6"]);
});

test("the same tag typed two ways is stored once", () => {
  assert.deepEqual(parseTags("CH-4 , ch-4"), ["ch-4"]);
});

test("a mistyped tag is not a chapter, and the one meant is suggested", () => {
  const tags = knownTags();
  assert.ok(!tags.includes("ch-11"), "a typo must not pass as a chapter");
  assert.equal(closestTag("ch-11", tags), "ch-1.1");
});

test("a tag nothing like a chapter is left unguessed", () => {
  assert.equal(closestTag("household", knownTags()), null);
});

// Tags are lowercased on the way in, so a capital in the list could never be matched.
test("every chapter in tags.json is written the way a tidied tag would be", () => {
  for (const chapter of readChapters()) {
    assert.deepEqual(parseTags(chapter.tag), [chapter.tag], `chapter "${chapter.tag}"`);
    assert.ok(chapter.label, `chapter "${chapter.tag}" has no label`);
    assert.equal(typeof chapter.order, "number", `chapter "${chapter.tag}" has no order`);
  }
});
