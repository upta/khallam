/**
 * The shape of lexicon.xlsx, shared by the export and import commands.
 *
 * Only fields a speaker can act on appear here. Codepoints and review flags are
 * machine-facing: they live in lexicon.json, the import report, and the review
 * page, where a technical reader will actually look at them.
 *
 * Columns are matched by header text rather than position, so a speaker can
 * reorder, hide, or sort columns in Excel without breaking the import.
 */

export const COLUMNS = [
  { key: "id", label: "id (filled in for you)", width: 24, editable: false },
  { key: "klallam", label: "Klallam", width: 22, editable: true },
  { key: "english", label: "English", width: 30, editable: true },
  { key: "audio", label: "audio file", width: 22, editable: true },
  { key: "tags", label: "tags (comma separated)", width: 24, editable: true },
];

// Style 2 is unlocked and editable, style 3 is locked and greyed out.
export const SHEET_COLUMNS = COLUMNS.map((c) => ({
  label: c.label,
  width: c.width,
  style: c.editable ? 2 : 3,
}));

export function entryToRow(entry) {
  return [
    entry.id,
    entry.klallam,
    entry.english,
    entry.audio ?? "",
    (entry.tags ?? []).join(", "),
  ];
}

function normalize(header) {
  return header.toLowerCase().replace(/[^a-z]/g, "");
}

function mapColumns(headerRow) {
  const index = {};
  headerRow.forEach((cell, i) => {
    const norm = normalize(cell ?? "");
    for (const column of COLUMNS) {
      if (index[column.key] === undefined && norm.startsWith(column.key)) {
        index[column.key] = i;
      }
    }
  });
  for (const key of ["id", "klallam", "english"]) {
    if (index[key] === undefined) {
      throw new Error(
        `the sheet has no "${key}" column. Row 1 must keep its headers: ` +
          COLUMNS.map((c) => c.label).join(", ")
      );
    }
  }
  return index;
}

/** Where each known column sits in a given sheet, matched by header text. */
export function findColumnIndexes(rows) {
  if (rows.length === 0) throw new Error("The sheet is empty.");
  return mapColumns(rows[0]);
}

/**
 * Turn raw sheet rows into records. Only outer whitespace is stripped, and only
 * because Excel adds it invisibly; interior characters are never touched.
 */
export function rowsToRecords(rows) {
  if (rows.length === 0) throw new Error("The sheet is empty.");
  const index = mapColumns(rows[0]);
  const get = (row, key) => (index[key] === undefined ? "" : (row[index[key]] ?? "").trim());

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const record = {
      row: i + 1,
      id: get(row, "id"),
      klallam: get(row, "klallam"),
      english: get(row, "english"),
      audio: get(row, "audio"),
      tags: get(row, "tags"),
      untrimmedKlallam: index.klallam === undefined ? "" : (row[index.klallam] ?? ""),
    };
    if (!record.id && !record.klallam && !record.english) continue;
    records.push(record);
  }
  return records;
}

/**
 * Tags name chapters, so a stray capital or space must not make a second chapter.
 * Case is folded away deliberately: a tag can never be case-meaningful.
 */
export function parseTags(value) {
  const seen = new Set();
  for (const tag of value.split(",")) {
    const cleaned = tag.trim().toLowerCase();
    if (cleaned) seen.add(cleaned);
  }
  return [...seen];
}
