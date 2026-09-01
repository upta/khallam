import fs from "node:fs";
import path from "node:path";
import {
  AUDIO_DIR,
  closestTag,
  foldGlottal,
  hashEntries,
  knownTags,
  readLexicon,
  readLock,
  toCodepoints,
} from "./lib.mjs";

const errors = [];
const warnings = [];

const lexicon = readLexicon();
const entries = lexicon.entries;

if (!Array.isArray(entries) || entries.length === 0) {
  console.error("lexicon.json has no entries");
  process.exit(1);
}

const ids = new Set();
const foldedForms = new Map();
const allowedTags = knownTags();

for (const entry of entries) {
  const where = entry.id ?? "(missing id)";

  if (!/^[a-z0-9-]+$/.test(entry.id ?? "")) {
    errors.push(`${where}: id must be lowercase ASCII letters, digits and hyphens`);
  }
  if (ids.has(entry.id)) errors.push(`${where}: duplicate id`);
  ids.add(entry.id);

  // Catches a chapter deleted from tags.json after words were already tagged with it.
  for (const tag of entry.tags ?? []) {
    if (allowedTags.includes(tag)) continue;
    const suggestion = closestTag(tag, allowedTags);
    errors.push(
      `${where}: tag "${tag}" is not a chapter in lexicon/tags.json.` +
        (suggestion ? ` Did you mean "${suggestion}"?` : "") +
        `\n      Chapters: ${allowedTags.join(", ")}`
    );
  }

  if (typeof entry.klallam !== "string" || entry.klallam.length === 0) {
    errors.push(`${where}: klallam is empty`);
    continue;
  }

  // The codepoints array is the human-auditable mirror of the Klallam string.
  const actual = toCodepoints(entry.klallam);
  const stored = entry.codepoints ?? [];
  if (actual.join(" ") !== stored.join(" ")) {
    errors.push(
      `${where}: codepoints do not match the klallam field\n` +
        `      stored: ${stored.join(" ")}\n` +
        `      actual: ${actual.join(" ")}`
    );
  }

  // Straight quotes and backticks mean a glottal stop or ejective got transliterated.
  if (/['"`]/.test(entry.klallam)) {
    errors.push(`${where}: klallam contains an ASCII quote or backtick, which means transliteration crept in`);
  }

  if (entry.audio !== null && entry.audio !== undefined) {
    if (!fs.existsSync(path.join(AUDIO_DIR, entry.audio))) {
      errors.push(`${where}: audio file not found: ${entry.audio}`);
    }
  }

  const folded = foldGlottal(entry.klallam);
  if (foldedForms.has(folded) && foldedForms.get(folded) !== entry.id) {
    warnings.push(
      `${where}: identical to "${foldedForms.get(folded)}" once U+0315 and U+0313 are treated as the same mark`
    );
  } else {
    foldedForms.set(folded, entry.id);
  }
}

const lock = readLock();
if (!lock) {
  errors.push("lexicon.lock is missing. Run: npm run lexicon:lock");
} else {
  const actualHash = hashEntries(entries);
  if (actualHash !== lock.hash) {
    errors.push(
      "lexicon.lock does not match the lexicon contents.\n" +
        `      locked: ${lock.hash}\n` +
        `      actual: ${actualHash}\n` +
        "      A Klallam string changed. If that was intentional, re-lock with: npm run lexicon:lock"
    );
  }
  if (lock.entryCount !== entries.length) {
    errors.push(`lexicon.lock records ${lock.entryCount} entries but the file has ${entries.length}`);
  }
}

const flagged = entries.filter((e) => e.needs_review);

for (const w of warnings) console.log(`WARN  ${w}`);

console.log("");
console.log(`entries       : ${entries.length}`);
console.log(`with audio    : ${entries.filter((e) => e.audio).length}`);
console.log(`needs review  : ${flagged.length}`);
console.log(`warnings      : ${warnings.length}`);

if (errors.length > 0) {
  console.error("");
  for (const e of errors) console.error(`ERROR ${e}`);
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}

console.log("\nLexicon verified.");
