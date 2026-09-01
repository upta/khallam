/**
 * Merge lexicon.xlsx back into lexicon.json.
 *
 * Runs as a dry run by default: it reports what it found and writes nothing.
 * Pass --apply to commit the changes.
 *
 * The sheet is treated as untrusted input. Excel rewrites text without being asked,
 * so every Klallam string is compared at the codepoint level rather than as a
 * string, and anything that looks like AutoCorrect damage stops the import.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  AUDIO_DIR,
  LEXICON_SHEET,
  REPO_ROOT,
  closestTag,
  foldGlottal,
  inspectKlallam,
  knownTags,
  readLexicon,
  slugify,
  toCodepoints,
  uniqueId,
  writeLexicon,
  writeLock,
} from "./lib.mjs";
import { readSheet, patchColumn } from "./xlsx.mjs";
import { findColumnIndexes, parseTags, rowsToRecords } from "./sheet-schema.mjs";

const apply = process.argv.includes("--apply");
const allowEdits = process.argv.includes("--allow-edits");
const allowDeletes = process.argv.includes("--allow-deletes");

// Excel drops a ~$ owner file beside a workbook it has open.
const OWNER_FILE = path.join(
  path.dirname(LEXICON_SHEET),
  "~$" + path.basename(LEXICON_SHEET)
);

if (!fs.existsSync(LEXICON_SHEET)) {
  console.error("Cannot import: lexicon/lexicon.xlsx does not exist.");
  console.error("");
  console.error("The spreadsheet is the source of truth for Klallam text, so without it");
  console.error("there is nothing to import from. It was probably moved, renamed, or");
  console.error("never checked out.");
  console.error("");
  console.error("Restore it from version control.");
  console.error("");
  console.error("Only if it is genuinely gone, rebuild it with: npm run lexicon:sheet");
  console.error("That regenerates the sheet from lexicon.json, so anything the lexicon");
  console.error("does not store, such as notes columns, will not come back.");
  process.exit(1);
}

const lexicon = readLexicon();
const entries = lexicon.entries;
const byId = new Map(entries.map((e) => [e.id, e]));
const allowedTags = knownTags();

let sheetRows;
let records;
try {
  sheetRows = readSheet(fs.readFileSync(LEXICON_SHEET));
  records = rowsToRecords(sheetRows);
} catch (err) {
  console.error(`Cannot import: lexicon/lexicon.xlsx could not be read.`);
  console.error(`Reason: ${err.message}`);
  console.error("");
  if (fs.existsSync(OWNER_FILE)) {
    console.error("The file looks like it is open in Excel. Close it and try again.");
  } else {
    console.error("If Excel reports the file as damaged, restore it from version control.");
  }
  process.exit(1);
}

if (fs.existsSync(OWNER_FILE)) {
  console.log("NOTE  lexicon.xlsx appears to be open in Excel.");
  console.log("      Anything not saved yet will not be seen by this import.");
}

// A sheet with headers and no words is a corrupted file, never an instruction to
// empty the lexicon. Missing rows mean deletions, so this cannot be a warning.
if (records.length === 0) {
  console.error("Cannot import: lexicon/lexicon.xlsx has its headers but no words.");
  console.error("");
  console.error("A row missing from the sheet means a deleted word, so importing this would");
  console.error("propose emptying the lexicon. That is not something a sheet gets to say.");
  console.error("");
  console.error("Restore the spreadsheet from version control.");
  process.exit(1);
}

const errors = [];
const warnings = [];
const additions = [];
const klallamEdits = [];
const fieldEdits = [];
const absent = [];
let unchanged = 0;

/** Show two Klallam strings as aligned codepoints, marking the positions that differ. */
function codepointDiff(before, after) {
  const a = toCodepoints(before);
  const b = toCodepoints(after);
  const columns = [];

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const width = Math.max((a[i] ?? "").length, (b[i] ?? "").length);
    columns.push({
      was: (a[i] ?? "").padEnd(width),
      now: (b[i] ?? "").padEnd(width),
      mark: (a[i] === b[i] ? "" : "^^").padStart(Math.ceil((width + 2) / 2)).padEnd(width),
    });
  }

  const line = (key) => columns.map((c) => c[key]).join(" ").trimEnd();
  return `      was: ${line("was")}\n      now: ${line("now")}\n           ${line("mark")}`;
}

const seenIds = new Set();

for (const record of records) {
  const where = `row ${record.row}`;
  record.status = "invalid";

  if (!record.klallam) {
    errors.push(`${where}: the Klallam column is empty`);
    continue;
  }
  if (!record.english) {
    errors.push(`${where}: the English column is empty`);
    continue;
  }

  for (const problem of inspectKlallam(record.klallam)) {
    errors.push(`${where}: Klallam text ${problem}`);
  }

  if (record.untrimmedKlallam !== record.klallam) {
    console.log(`NOTE  ${where}: stripped surrounding whitespace from the Klallam cell`);
  }

  if (record.audio && !fs.existsSync(path.join(AUDIO_DIR, record.audio))) {
    errors.push(`${where}: no such recording: lexicon/audio/${record.audio}`);
  }

  const tags = parseTags(record.tags);
  const audio = record.audio || null;

  // A tag nobody recognises is a word missing from a chapter, and nothing else
  // would ever say so. Better to stop the import than to lose it quietly.
  for (const tag of tags) {
    if (allowedTags.includes(tag)) continue;
    const suggestion = closestTag(tag, allowedTags);
    errors.push(
      `${where}: "${tag}" is not one of the chapter tags.` +
        (suggestion ? ` Did you mean "${suggestion}"?` : "") +
        `\n      Tags in use: ${allowedTags.join(", ")}` +
        `\n      To add a new chapter, ask Claude to add it to lexicon/tags.json.`
    );
  }

  if (!record.id) {
    // A blank id means "new word", so a match against the lexicon is a mistake
    // rather than an edit: the row lost its id, or the word was re-typed.
    const clash = entries.find((e) => e.klallam === record.klallam);
    if (clash) {
      errors.push(
        `${where}: this word is already in the lexicon as "${clash.id}" (${clash.english}),` +
          ` but the id column is blank.\n` +
          `      To change it, put ${clash.id} back in the id column. To add a genuinely` +
          ` different word, check the spelling with a speaker.`
      );
      continue;
    }
    record.status = "new";
    additions.push({ record, tags, audio });
    continue;
  }

  if (seenIds.has(record.id)) {
    errors.push(`${where}: id "${record.id}" is used on more than one row`);
    continue;
  }
  seenIds.add(record.id);

  const entry = byId.get(record.id);
  if (!entry) {
    errors.push(
      `${where}: id "${record.id}" is not in the lexicon. Leave the id blank to add a new word.`
    );
    continue;
  }

  const klallamChanged = entry.klallam !== record.klallam;
  const others = [];
  if (entry.english !== record.english) others.push(["English", entry.english, record.english]);
  if ((entry.audio ?? "") !== (audio ?? "")) {
    others.push(["audio", entry.audio ?? "(none)", audio ?? "(none)"]);
  }
  if ((entry.tags ?? []).join(", ") !== tags.join(", ")) {
    others.push(["tags", (entry.tags ?? []).join(", ") || "(none)", tags.join(", ") || "(none)"]);
  }

  if (klallamChanged) {
    record.status = "klallam-edit";
    klallamEdits.push({ record, entry, tags, audio, others });
  } else if (others.length > 0) {
    record.status = "field-edit";
    fieldEdits.push({ record, entry, tags, audio, others, lostRecording: Boolean(entry.audio) && !audio });
  } else {
    record.status = "unchanged";
    unchanged++;
  }
}

for (const entry of entries) {
  if (!seenIds.has(entry.id)) absent.push(entry);
}

/**
 * Near-duplicate detection.
 *
 * The lexicon already contains pairs that differ only by glottalization mark; that
 * is a known open question in PLAN.md, not something this import introduced. So a
 * collision is only fatal when the import is the thing creating it.
 */
function collisions(keyOf, describe, skipGroup = () => false) {
  const groups = new Map();
  for (const record of records) {
    if (record.status === "invalid") continue;
    const key = keyOf(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  for (const group of groups.values()) {
    if (group.length < 2 || skipGroup(group)) continue;
    const rows = group.map((r) => r.row).join(", ");
    const introduced = group.some((r) => r.status === "new" || r.status === "klallam-edit");
    (introduced ? errors : warnings).push(describe(rows, introduced));
  }
}

collisions(
  (r) => r.klallam,
  (rows, introduced) =>
    `rows ${rows} hold the same Klallam word.` +
    (introduced ? " This import is what makes them collide." : " This pair already existed.")
);

collisions(
  (r) => foldGlottal(r.klallam),
  (rows, introduced) =>
    `rows ${rows} differ only by an invisible glottalization mark (U+0313 vs U+0315).` +
    (introduced
      ? "\n      This import is what makes them collide. If they are genuinely different" +
        "\n      words, confirm with a speaker and import them one at a time."
      : " This pair already existed."),
  // Identical strings fold identically; they are already reported above.
  (group) => new Set(group.map((r) => r.klallam)).size === 1
);

/* ------------------------------------------------------------------ report --- */

console.log("");
console.log("Reading lexicon.xlsx");
console.log("--------------------");
console.log(`  ${records.length} row(s) in the sheet, ${entries.length} word(s) in the lexicon\n`);

if (additions.length > 0) {
  console.log(`NEW WORDS (${additions.length})`);
  for (const { record, audio } of additions) {
    console.log(`  row ${record.row}  ${record.english}`);
    console.log(`      ${toCodepoints(record.klallam).join(" ")}`);
    console.log(`      recording: ${audio ?? "(none - will be flagged for review)"}`);
  }
  console.log("");
}

if (klallamEdits.length > 0) {
  console.log(`CHANGED KLALLAM TEXT (${klallamEdits.length})`);
  for (const { record, entry } of klallamEdits) {
    console.log(`  row ${record.row}  ${entry.id}  (${entry.english})`);
    console.log(codepointDiff(entry.klallam, record.klallam));
  }
  console.log("");
}

if (fieldEdits.length > 0) {
  console.log(`CHANGED DETAILS (${fieldEdits.length})`);
  for (const { record, entry, others, lostRecording } of fieldEdits) {
    console.log(`  row ${record.row}  ${entry.id}`);
    for (const [field, was, now] of others) console.log(`      ${field}: ${was}  ->  ${now}`);
    if (lostRecording) console.log("      will be flagged for review: no recording linked");
  }
  console.log("");
}

if (absent.length > 0) {
  console.log(`DELETIONS (${absent.length})`);
  console.log("  In the lexicon, no longer in the sheet. The sheet is the source, so these");
  console.log("  are words that were deleted. Codepoints are printed so a word removed by");
  console.log("  mistake can be put back from this report.");
  for (const entry of absent) {
    console.log(`  ${entry.id}  (${entry.english})`);
    console.log(`      ${entry.codepoints.join(" ")}`);
    console.log(`      recording: ${entry.audio ?? "(none)"}${entry.audio ? " - left on disk" : ""}`);
  }
  console.log("");
}

console.log(`unchanged     : ${unchanged}`);
console.log(`to add        : ${additions.length}`);
console.log(`to edit       : ${klallamEdits.length + fieldEdits.length}`);
console.log(`to delete     : ${absent.length}`);

for (const w of warnings) console.log(`\nWARN  ${w}`);

if (errors.length > 0) {
  console.error("");
  for (const e of errors) console.error(`ERROR ${e}`);
  console.error(`\n${errors.length} problem(s) found. Nothing was changed.`);
  process.exit(1);
}

if (klallamEdits.length > 0 && !allowEdits) {
  console.error("");
  console.error("This import would change the Klallam text of words already in the lexicon.");
  console.error("That is a linguistic decision, so it needs to be stated explicitly.");
  console.error("\nCheck the codepoints above with a speaker, then re-run with:");
  console.error("  npm run lexicon:import -- --apply --allow-edits");
  process.exit(1);
}

if (absent.length > 0 && !allowDeletes) {
  console.error("");
  console.error("This import would remove word(s) from the lexicon, because their rows are no");
  console.error("longer in the spreadsheet. Deleting a row is how a word is removed, so this is");
  console.error("working as intended - but it is worth being sure it was meant.");
  console.error("\nCheck the list above, then re-run with:");
  console.error(
    `  npm run lexicon:import -- --apply${klallamEdits.length > 0 ? " --allow-edits" : ""} --allow-deletes`
  );
  process.exit(1);
}

const changeCount = additions.length + klallamEdits.length + fieldEdits.length + absent.length;

if (!apply) {
  console.log("");
  if (changeCount === 0) {
    console.log("The sheet and the lexicon already agree. Nothing to do.");
  } else {
    console.log("This was a dry run. Nothing has been written.");
    console.log("\nTo apply:");
    console.log(`  npm run lexicon:import -- --apply${klallamEdits.length > 0 ? " --allow-edits" : ""}`);
  }
  process.exit(0);
}

// Every apply writes the id column back, so prove the sheet is writable before
// touching lexicon.json. Failing halfway would leave the two out of step.
try {
  fs.closeSync(fs.openSync(LEXICON_SHEET, "r+"));
} catch (err) {
  console.error("\nCannot apply: lexicon/lexicon.xlsx is not writable.");
  console.error(`Reason: ${err.code ?? err.message}`);
  console.error("");
  console.error("An import writes the ids back into the sheet. Close the file in Excel");
  console.error("and run the same command again. Nothing has been changed.");
  process.exit(1);
}

/**
 * Stamp the id column back into the sheet. Every id is written, not only the ones just
 * generated, so a cell left looking hand-typed by an earlier import is corrected.
 */
function stampIds(generated) {
  const idsByRow = new Map(generated);
  for (const record of records) {
    if (record.id && !idsByRow.has(record.row)) idsByRow.set(record.row, record.id);
  }
  if (idsByRow.size === 0) return;

  const idColumn = findColumnIndexes(sheetRows).id;
  fs.writeFileSync(
    LEXICON_SHEET,
    patchColumn(fs.readFileSync(LEXICON_SHEET), idColumn, idsByRow)
  );
}

if (changeCount === 0) {
  stampIds(new Map());
  console.log("\nNothing to import. Tidied the id column.");
  process.exit(0);
}

/* ------------------------------------------------------------------- apply --- */

const taken = new Set(entries.map((e) => e.id));
const generatedIds = new Map();

for (const { record, tags, audio } of additions) {
  const folded = foldGlottal(record.klallam);
  const nearMatch = entries.find((e) => foldGlottal(e.klallam) === folded);
  const id = uniqueId(slugify(record.english), taken);
  taken.add(id);
  generatedIds.set(record.row, id);

  entries.push({
    id,
    klallam: record.klallam,
    codepoints: toCodepoints(record.klallam),
    english: record.english,
    audio,
    image: null,
    tags,
    needs_review: !audio || Boolean(nearMatch),
    review_reasons: [
      ...(audio ? [] : ["no recording linked"]),
      ...(nearMatch ? [`differs from "${nearMatch.id}" only by an invisible mark`] : []),
    ],
  });
  console.log(`added   ${id}`);
}

for (const { record, entry, tags, audio } of klallamEdits) {
  entry.klallam = record.klallam;
  entry.codepoints = toCodepoints(record.klallam);
  entry.english = record.english;
  entry.audio = audio;
  entry.tags = tags;
  // The import cannot know whether a speaker approved this, so it says so.
  entry.needs_review = true;
  const reason = "Klallam text was changed by a spreadsheet import; needs a speaker's confirmation";
  entry.review_reasons = [...new Set([...(entry.review_reasons ?? []), reason])];
  console.log(`edited  ${entry.id}  (flagged for review)`);
}

for (const { record, entry, tags, audio, lostRecording } of fieldEdits) {
  entry.english = record.english;
  entry.audio = audio;
  entry.tags = tags;
  // A word left with no recording is the same open question as a new word without one.
  if (lostRecording) {
    entry.needs_review = true;
    entry.review_reasons = [...new Set([...(entry.review_reasons ?? []), "no recording linked"])];
  }
  console.log(`updated ${entry.id}${lostRecording ? "  (flagged for review)" : ""}`);
}

if (absent.length > 0) {
  const removing = new Set(absent.map((e) => e.id));
  lexicon.entries = entries.filter((e) => !removing.has(e.id));
  for (const entry of absent) console.log(`deleted ${entry.id}  (recording left on disk)`);
}

writeLexicon(lexicon);
const lock = writeLock(lexicon.entries);

// The sheet is the source of truth, so it is annotated in place and never rebuilt from
// the lexicon.
stampIds(generatedIds);
if (generatedIds.size > 0) {
  console.log(`\nWrote ${generatedIds.size} new id(s) back into the spreadsheet.`);
}

console.log(`Lock updated to ${lock.hash.slice(0, 16)}...`);
console.log("Verifying...\n");

const result = spawnSync(
  process.execPath,
  [path.join(REPO_ROOT, "tools", "lexicon-cli", "verify.mjs")],
  { stdio: "inherit" }
);

process.exit(result.status ?? 0);
