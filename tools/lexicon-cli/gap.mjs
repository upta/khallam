/**
 * List the Klallam words carried inside original-site.html.
 *
 * The page holds its own copy of the words, written in a chat rather than taken from
 * the lexicon. This reads that copy as plain text and prints it, so the rows that have
 * to be typed into lexicon.xlsx can be worked out. It never runs the page's code.
 *
 * Temporary: it exists only while original-site.html does.
 */
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, readLexicon } from "./lib.mjs";

const SITE_PAGE = path.join(REPO_ROOT, "original-site.html");

if (!fs.existsSync(SITE_PAGE)) {
  console.error("Cannot read the site page: original-site.html is not in the repo root.");
  console.error("");
  console.error("This command only exists to read that file. If the page has been");
  console.error("replaced by the real site, this command has done its job and can go.");
  process.exit(1);
}

const source = fs.readFileSync(SITE_PAGE, "utf8");

/** Take the text between "const NAME = [" and the "];" that closes it. */
function arrayLiteral(name) {
  const start = source.indexOf(`const ${name} = [`);
  if (start === -1) throw new Error(`original-site.html has no "const ${name} = [".`);
  const end = source.indexOf("\n];", start);
  if (end === -1) throw new Error(`The ${name} list in original-site.html is never closed.`);
  return source.slice(start, end);
}

const CHAPTER_SPLIT = /\bwords\s*:\s*\[/g;
const LABEL = /label\s*:\s*(['"])(.*?)\1/g;
const WORD_ROW = /\{\s*k\s*:\s*(['"])(.*?)\1\s*,\s*e\s*:\s*(['"])(.*?)\3\s*\}/g;
const SOUND_ROW =
  /\{\s*s\s*:\s*(['"])(.*?)\1\s*,\s*d\s*:\s*(['"])(.*?)\3\s*,\s*e\s*:\s*(['"])(.*?)\5\s*\}/g;

function readChapters() {
  const block = arrayLiteral("SUBJECTS");
  const labels = [...block.matchAll(LABEL)].map((m) => m[2]);
  const sections = block.split(CHAPTER_SPLIT).slice(1);

  return sections.map((section, index) => ({
    label: labels[index] ?? `Chapter ${index + 1}`,
    words: [...section.matchAll(WORD_ROW)].map((m) => ({ klallam: m[2], english: m[4] })),
  }));
}

function readSounds() {
  return [...arrayLiteral("PRONUN").matchAll(SOUND_ROW)].map((m) => {
    const [klallam, english] = m[6].split("=").map((part) => part.trim());
    return { sound: m[2], klallam, english: english ?? "" };
  });
}

/**
 * Columns line up only if combining marks are not counted: they stack onto the letter
 * before them rather than taking a column of their own.
 */
function pad(text, width) {
  const visible = Array.from(text).filter((ch) => !/\p{M}/u.test(ch)).length;
  return text + " ".repeat(Math.max(1, width - visible));
}

function normalize(gloss) {
  return gloss.toLowerCase().replace(/\?/g, " ").replace(/\s+/g, " ").trim();
}

/** "old / worn out (thing)" is really a note about "old / worn out". */
function withoutNotes(gloss) {
  return gloss.replace(/\([^)]*\)/g, " ");
}

/** "road, door" and "small / few" are two meanings each, so they are matched one by one. */
function senses(gloss) {
  return normalize(gloss)
    .split(/[,/]/)
    .map((sense) => sense.trim())
    .filter(Boolean);
}

/** Does one gloss contain the other as a whole run of words? "man" is inside "young man". */
function containsRun(haystack, needle) {
  const outer = haystack.split(" ");
  const inner = needle.split(" ");
  if (inner.length === 0 || inner.length > outer.length) return false;
  for (let i = 0; i + inner.length <= outer.length; i += 1) {
    if (inner.every((word, j) => word === outer[i + j])) return true;
  }
  return false;
}

// Every gloss ending in "it" would look related to every other one. Overlap on nothing
// but a grammar word is noise, not a near miss.
const GRAMMAR_WORDS = new Set([
  "a", "an", "and", "he", "her", "him", "his", "i", "it", "its", "me", "my", "of",
  "or", "she", "that", "the", "them", "they", "this", "to", "us", "we",
]);

function overlaps(left, right) {
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (GRAMMAR_WORDS.has(shorter)) return false;
  return containsRun(longer, shorter);
}

const lexicon = readLexicon().entries;

/**
 * Match a page word to the lexicon by meaning alone. Anything that is not a plain
 * match is reported rather than guessed at: a near miss is shown so it can be checked
 * by eye, because a gloss can differ where the word does not.
 */
function lookUp(english) {
  const exact = lexicon.filter((entry) => normalize(entry.english) === normalize(english));
  if (exact.length > 0) return { matches: exact, how: "same meaning", near: [] };

  const pageSenses = senses(english);
  const shared = lexicon.filter((entry) =>
    senses(entry.english).some((sense) => pageSenses.includes(sense))
  );
  if (shared.length > 0) {
    const overlap = senses(shared[0].english).filter((sense) => pageSenses.includes(sense));
    return { matches: shared, how: `meaning "${overlap[0]}"`, near: [] };
  }

  const loose = senses(withoutNotes(english));
  const near = lexicon.filter((entry) =>
    senses(withoutNotes(entry.english)).some((sense) =>
      loose.some((page) => overlaps(page, sense))
    )
  );
  return { matches: [], how: null, near };
}

const chapters = readChapters();
const sounds = readSounds();

function describe(word) {
  const found = lookUp(word.english);
  const status = found.matches.length > 0 ? "in lexicon" : "not in lexicon";
  const notes = [];
  if (found.matches.length > 1) {
    notes.push(`${found.matches.length} entries: ${found.matches.map((e) => e.id).join(", ")}`);
  } else if (found.matches.length === 1 && found.how !== "same meaning") {
    notes.push(`matched on ${found.how}`);
  }
  if (found.near.length > 0) {
    notes.push(`close to: ${found.near.map((e) => `${e.id} (${e.english})`).join("; ")}`);
  }
  return { ...word, found, status, note: notes.join("  ") };
}

function printGroup(heading, words) {
  const rows = words.map(describe);
  const known = rows.filter((row) => row.found.matches.length > 0).length;
  console.log(`${heading}  (${rows.length} words: ${known} in lexicon, ${rows.length - known} not)`);
  for (const row of rows) {
    console.log(
      `  ${pad(row.klallam, 14)}${pad(row.english, 30)}${pad(row.status, 16)}${row.note}`.trimEnd()
    );
  }
  console.log("");
  return rows;
}

console.log("Klallam words carried inside original-site.html");
console.log("");

let total = 0;
for (const chapter of chapters) {
  printGroup(chapter.label, chapter.words);
  total += chapter.words.length;
}

printGroup("Pronunciation guide examples", sounds);

console.log(
  `${total} words across ${chapters.length} chapters, plus ${sounds.length} in the pronunciation guide.`
);
