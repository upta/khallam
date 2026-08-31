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
import { REPO_ROOT } from "./lib.mjs";

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
  return text + " ".repeat(Math.max(0, width - visible));
}

const chapters = readChapters();
const sounds = readSounds();

console.log("Klallam words carried inside original-site.html");
console.log("");

let total = 0;
for (const chapter of chapters) {
  console.log(`${chapter.label}  (${chapter.words.length} words)`);
  for (const word of chapter.words) {
    console.log(`  ${pad(word.klallam, 14)}${word.english}`);
  }
  console.log("");
  total += chapter.words.length;
}

console.log(`Pronunciation guide examples  (${sounds.length} words)`);
for (const sound of sounds) {
  console.log(`  ${pad(sound.klallam, 14)}${sound.english}`);
}
console.log("");

console.log(
  `${total} words across ${chapters.length} chapters, plus ${sounds.length} in the pronunciation guide.`
);
