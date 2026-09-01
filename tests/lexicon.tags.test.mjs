import { test } from "node:test";
import assert from "node:assert/strict";
import { closestTag, knownTags, readChapters } from "../tools/lexicon-cli/lib.mjs";
import { parseTags } from "../tools/lexicon-cli/sheet-schema.mjs";

test("a capitalised tag still names its chapter", () => {
  assert.deepEqual(parseTags("Nouns"), ["nouns"]);
  assert.ok(knownTags().includes("nouns"));
});

test("a tag with stray spaces still names its chapter", () => {
  assert.deepEqual(parseTags("  nouns  , adj "), ["nouns", "adj"]);
});

test("the same tag typed two ways is stored once", () => {
  assert.deepEqual(parseTags("Nouns , nouns"), ["nouns"]);
});

test("a mistyped tag is not a chapter, and the one meant is suggested", () => {
  const tags = knownTags();
  assert.ok(!tags.includes("noun"), "a typo must not pass as a chapter");
  assert.equal(closestTag("noun", tags), "nouns");
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
