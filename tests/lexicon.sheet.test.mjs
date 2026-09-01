import { test } from "node:test";
import assert from "node:assert/strict";
import { readSheet, unzip, writeSheet, patchColumn } from "../tools/lexicon-cli/xlsx.mjs";
import { inspectKlallam, toCodepoints } from "../tools/lexicon-cli/lib.mjs";
import { SHEET_COLUMNS, COLUMNS, rowsToRecords } from "../tools/lexicon-cli/sheet-schema.mjs";

// Klallam is written with escapes here so the source stays ASCII and the test is
// asserting on exact codepoints rather than on whatever an editor saved.
const COMBINING_COMMA_ABOVE = "\u0313";
const COMBINING_COMMA_ABOVE_RIGHT = "\u0315";

function roundTrip(values) {
  const buf = writeSheet({
    columns: SHEET_COLUMNS,
    rows: values.map((v) => [v]),
  });
  return readSheet(buf)
    .slice(1)
    .map((row) => row[0] ?? "");
}

test("the sheet codec preserves combining marks exactly", () => {
  const samples = [
    "p\u0259\u0301q\u0313", // stacked accent then glottalization
    "x\u0323p\u00E1y\u0313",
    "\u010D\u0259\u0301sa\u0294",
    "\u019B\u0313", // lambda with bar plus combining mark
  ];
  assert.deepEqual(roundTrip(samples), samples);
});

test("the two glottalization marks survive as distinct characters", () => {
  const withPlain = "a" + COMBINING_COMMA_ABOVE;
  const withRight = "a" + COMBINING_COMMA_ABOVE_RIGHT;
  const [a, b] = roundTrip([withPlain, withRight]);

  assert.equal(a, withPlain);
  assert.equal(b, withRight);
  assert.notEqual(a, b, "the codec collapsed U+0313 and U+0315 into one mark");
  assert.deepEqual(toCodepoints(a), ["U+0061", "U+0313"]);
  assert.deepEqual(toCodepoints(b), ["U+0061", "U+0315"]);
});

test("the codec does not normalize composed and decomposed forms together", () => {
  const composed = "\u00E1"; // single codepoint
  const decomposed = "a\u0301"; // base plus combining acute
  const [a, b] = roundTrip([composed, decomposed]);

  assert.equal(a, composed);
  assert.equal(b, decomposed);
  assert.equal(toCodepoints(a).length, 1);
  assert.equal(toCodepoints(b).length, 2);
});

test("the codec escapes and restores XML-hostile characters", () => {
  const samples = ["a & b", "<tag>", 'quote " here', "amp &amp; literal"];
  assert.deepEqual(roundTrip(samples), samples);
});

test("interior whitespace is carried through untouched", () => {
  const samples = ["two words", "tab\tseparated"];
  assert.deepEqual(roundTrip(samples), samples);
});

test("a written sheet reads back through the schema", () => {
  const buf = writeSheet({
    columns: SHEET_COLUMNS,
    rows: [["white", "p\u0259\u0301q\u0313", "white", "white.mp3", "colour"]],
  });
  const [record] = rowsToRecords(readSheet(buf));

  assert.equal(record.id, "white");
  assert.equal(record.klallam, "p\u0259\u0301q\u0313");
  assert.equal(record.english, "white");
  assert.equal(record.audio, "white.mp3");
});

test("the sheet carries only fields a speaker can act on", () => {
  const keys = COLUMNS.map((c) => c.key);
  assert.deepEqual(keys, ["id", "klallam", "english", "audio", "tags"]);
  for (const machineFacing of ["codepoints", "review", "needs_review"]) {
    assert.ok(!keys.includes(machineFacing), `${machineFacing} leaked into the sheet`);
  }
});

test("generated columns are locked and editable ones are not", () => {
  const xml = unzip(writeSheet({ columns: SHEET_COLUMNS, rows: [], protect: true }))
    .get("xl/worksheets/sheet1.xml")
    .toString("utf8");

  assert.match(xml, /<sheetProtection\b[^>]*sheet="1"/, "sheet protection was not enabled");
  assert.match(xml, /<sheetProtection\b[^>]*insertRows="0"/, "adding rows would be blocked");
  // Protection must follow the data or Excel rejects the file.
  assert.ok(
    xml.indexOf("<sheetProtection") > xml.indexOf("</sheetData>"),
    "sheetProtection is in the wrong position"
  );

  SHEET_COLUMNS.forEach((column, i) => {
    assert.match(
      xml,
      new RegExp(`<col min="${i + 1}" max="${i + 1}"[^>]*style="${column.style}"`),
      `column ${column.label} did not get style ${column.style}`
    );
  });

  assert.equal(SHEET_COLUMNS[0].style, 3, "the id column should be locked");
  assert.equal(SHEET_COLUMNS[1].style, 2, "the Klallam column must stay editable");
});

test("writing an id back creates the cell without disturbing the row", () => {
  const buf = writeSheet({
    columns: SHEET_COLUMNS,
    rows: [
      ["", "p\u0259\u0301q\u0313", "white", "white.mp3", "colour"],
      ["whistle", "\u0161\u00FApt", "whistle", "whistle.mp3", ""],
    ],
    protect: true,
  });

  const rows = readSheet(patchColumn(buf, 0, new Map([[2, "white"]])));

  assert.equal(rows[1][0], "white", "the generated id was not written");
  assert.equal(rows[1][1], "p\u0259\u0301q\u0313", "the Klallam cell was altered");
  assert.equal(rows[1][2], "white");
  assert.equal(rows[1][3], "white.mp3");
  assert.equal(rows[1][4], "colour");
  assert.deepEqual(rows[2], ["whistle", "\u0161\u00FApt", "whistle", "whistle.mp3"]);
  assert.deepEqual(
    rows[0],
    SHEET_COLUMNS.map((c) => c.label),
    "the header row was disturbed"
  );
});

test("an id written into an empty cell looks like the generated ids around it", () => {
  const buf = writeSheet({
    columns: SHEET_COLUMNS,
    rows: [
      ["", "p\u0259\u0301q\u0313", "white", "", ""],
      ["whistle", "\u0161\u00FApt", "whistle", "", ""],
    ],
    protect: true,
  });

  const xml = unzip(patchColumn(buf, 0, new Map([[2, "white"]])))
    .get("xl/worksheets/sheet1.xml")
    .toString("utf8");

  const styleOf = (ref) => /\bs="(\d+)"/.exec(new RegExp(`<c\\b[^>]*\\br="${ref}"[^>]*>`).exec(xml)[0])?.[1];

  assert.equal(styleOf("A2"), styleOf("A3"), "the written id does not match the ids around it");
  assert.equal(styleOf("A2"), String(SHEET_COLUMNS[0].style), "the id column's style was not used");
});

test("writing an id back replaces an existing value and keeps protection", () => {
  const buf = writeSheet({
    columns: SHEET_COLUMNS,
    rows: [["stale", "p\u0259\u0301q\u0313", "white", "", ""]],
    protect: true,
  });
  const patched = patchColumn(buf, 0, new Map([[2, "white"]]));

  assert.equal(readSheet(patched)[1][0], "white");
  assert.equal(readSheet(patched)[1][1], "p\u0259\u0301q\u0313");
  assert.match(
    unzip(patched).get("xl/worksheets/sheet1.xml").toString("utf8"),
    /<sheetProtection\b/,
    "patching dropped sheet protection"
  );
});

test("patching keeps columns the lexicon does not model", () => {
  const columns = [...SHEET_COLUMNS, { label: "speaker notes", width: 30, style: 2 }];
  const buf = writeSheet({
    columns,
    rows: [["", "p\u0259\u0301q\u0313", "white", "", "", "ask Bea about this one"]],
  });

  const rows = readSheet(patchColumn(buf, 0, new Map([[2, "white"]])));
  assert.equal(rows[1][5], "ask Bea about this one", "an extra column was destroyed");
  assert.equal(rows[1][0], "white");
});

test("Excel AutoCorrect damage is caught", () => {
  const cases = [
    ["\u2019", "curly single quote"],
    ["\u201C", "curly double quote"],
    ["'", "ASCII apostrophe"],
    ["\u00A0", "non-breaking space"],
    ["\u200B", "zero-width space"],
    ["\uFFFD", "replacement character"],
    ["a  b", "double space"],
    ["Q\u0259", "leading capital"],
  ];
  for (const [text, label] of cases) {
    assert.ok(
      inspectKlallam(text).length > 0,
      `inspectKlallam let ${label} through: ${JSON.stringify(text)}`
    );
  }
});

test("clean Klallam text raises no complaints", () => {
  for (const text of ["p\u0259\u0301q\u0313", "x\u0323p\u00E1y\u0313", "\u010D\u0259\u0301sa\u0294"]) {
    assert.deepEqual(inspectKlallam(text), [], `false positive on ${JSON.stringify(text)}`);
  }
});
