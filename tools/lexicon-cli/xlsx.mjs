/**
 * Minimal .xlsx reader and writer.
 *
 * Deliberately dependency-free. The published `xlsx` package on the public npm
 * registry carries unpatched advisories, and a spreadsheet parser sitting in the
 * path of irreplaceable language data is not somewhere to accept unaudited code.
 * An .xlsx is a ZIP of XML, and node:zlib already ships with everything needed.
 *
 * The one rule this file exists to uphold: text is carried through byte for byte.
 * Nothing here calls .normalize(), trims interior whitespace, or "repairs" input.
 */
import zlib from "node:zlib";

const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

/* ------------------------------------------------------------------ ZIP --- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(buf) {
  // The EOCD sits at the tail, after a comment of at most 64 KiB.
  const floor = Math.max(0, buf.length - 66_000);
  for (let i = buf.length - 22; i >= floor; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error("Not a valid .xlsx file (no ZIP end-of-central-directory record).");
}

/** Read every member of a ZIP archive into memory, keyed by path. */
export function unzip(buf) {
  const eocd = findEndOfCentralDirectory(buf);
  const count = buf.readUInt16LE(eocd + 10);
  let cursor = buf.readUInt32LE(eocd + 16);

  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Corrupt .xlsx: bad central directory signature.");
    }
    const method = buf.readUInt16LE(cursor + 10);
    const compressedSize = buf.readUInt32LE(cursor + 20);
    const uncompressedSize = buf.readUInt32LE(cursor + 24);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const localOffset = buf.readUInt32LE(cursor + 42);
    const name = buf.toString("utf8", cursor + 46, cursor + 46 + nameLen);
    cursor += 46 + nameLen + extraLen + commentLen;

    // A spreadsheet of words has no business being this large; refuse zip bombs.
    if (uncompressedSize > MAX_ENTRY_BYTES) {
      throw new Error(`Refusing to read oversized entry "${name}" from .xlsx.`);
    }
    if (buf.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error("Corrupt .xlsx: bad local file header.");
    }
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const raw = buf.subarray(start, start + compressedSize);

    files.set(
      name,
      method === 0
        ? Buffer.from(raw)
        : zlib.inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES })
    );
  }
  return files;
}

/** Build a ZIP archive. Timestamps are fixed so identical content yields identical bytes. */
export function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const [name, content] of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const body = zlib.deflateRawSync(content);
    const crc = crc32(content);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10); // time 00:00
    local.writeUInt16LE(0x21, 12); // date 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBuf, eocd]);
}

/* ------------------------------------------------------------------ XML --- */

export function xmlEscape(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function xmlUnescape(text) {
  return text.replace(
    /&#x([0-9a-fA-F]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/g,
    (_all, hex, dec, named) => {
      if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
      if (dec !== undefined) return String.fromCodePoint(parseInt(dec, 10));
      return NAMED_ENTITIES[named];
    }
  );
}

/** Excel escapes characters XML cannot carry as _x0041_ sequences. */
function decodeExcelEscapes(text) {
  return text.replace(/_x([0-9A-Fa-f]{4})_/g, (all, hex) => {
    const code = parseInt(hex, 16);
    // _x005F_ is how a literal "_x" prefix is itself escaped.
    return code === 0x5f ? all : String.fromCodePoint(code);
  });
}

function collectText(fragment) {
  let out = "";
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g;
  let match;
  while ((match = re.exec(fragment))) out += xmlUnescape(match[1] ?? "");
  return decodeExcelEscapes(out);
}

function parseSharedStrings(xml) {
  const strings = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  let match;
  while ((match = re.exec(xml))) strings.push(collectText(match[1] ?? ""));
  return strings;
}

function columnIndex(ref) {
  const letters = /^([A-Z]+)/.exec(ref);
  if (!letters) return -1;
  let n = 0;
  for (const ch of letters[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function cellValue(attrs, inner, shared) {
  const type = /\bt="([^"]*)"/.exec(attrs)?.[1] ?? "n";
  if (type === "inlineStr") return collectText(inner);
  const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1];
  if (raw === undefined) return "";
  if (type === "s") return shared[Number(raw)] ?? "";
  return decodeExcelEscapes(xmlUnescape(raw));
}

/**
 * Read the first worksheet as an array of string arrays. Empty cells become "",
 * and gaps in the cell references are preserved as empty columns.
 */
export function readSheet(buf) {
  const files = unzip(buf);

  const sheetPath =
    [...files.keys()]
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .sort()[0] ?? null;
  if (!sheetPath) throw new Error("That .xlsx contains no worksheet.");

  const sharedBuf = files.get("xl/sharedStrings.xml");
  const shared = sharedBuf ? parseSharedStrings(sharedBuf.toString("utf8")) : [];
  const xml = files.get(sheetPath).toString("utf8");

  const rows = [];
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(xml))) {
    const cells = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[2]))) {
      const attrs = cellMatch[1];
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const index = ref ? columnIndex(ref) : cells.length;
      while (cells.length < index) cells.push("");
      cells[index] = cellValue(attrs, cellMatch[2] ?? "", shared);
    }
    rows.push(cells);
  }
  return rows;
}

function worksheetPath(files) {
  const found =
    [...files.keys()]
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .sort()[0] ?? null;
  if (!found) throw new Error("That .xlsx contains no worksheet.");
  return found;
}

/**
 * Set values in one column of an existing workbook, leaving every other byte alone.
 *
 * Used to write generated ids back after an import. Rebuilding the whole sheet
 * would silently discard anything the editor put there that the lexicon does not
 * model, which would make the spreadsheet stop being the source of truth.
 */
function columnStyle(xml, targetColumn) {
  const cols = /<col\b([^>]*)\/>/g;
  let match;
  while ((match = cols.exec(xml))) {
    const min = Number(/\bmin="(\d+)"/.exec(match[1])?.[1]);
    const max = Number(/\bmax="(\d+)"/.exec(match[1])?.[1]);
    const style = /\bstyle="(\d+)"/.exec(match[1])?.[1];
    if (style && min <= targetColumn + 1 && targetColumn + 1 <= max) return style;
  }
  return undefined;
}

export function patchColumn(buf, targetColumn, valuesByRow) {
  const files = unzip(buf);
  const sheetPath = worksheetPath(files);
  let xml = files.get(sheetPath).toString("utf8");
  const col = columnName(targetColumn);
  // A row typed by hand has no id cell to copy an appearance from, so it takes the
  // column's own. Without this an id lands as ordinary text and reads as hand-typed.
  const fallbackStyle = columnStyle(xml, targetColumn);

  for (const [rowNumber, value] of valuesByRow) {
    const rowMatch = new RegExp(
      `(<row\\b[^>]*\\br="${rowNumber}"[^>]*>)([\\s\\S]*?)(</row>)`
    ).exec(xml);
    if (!rowMatch) continue;

    const [whole, open, body, close] = rowMatch;
    const ref = `${col}${rowNumber}`;
    const existing = new RegExp(
      `<c\\b[^>]*\\br="${ref}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`
    ).exec(body);

    const style = (existing ? /\bs="(\d+)"/.exec(existing[0])?.[1] : undefined) ?? fallbackStyle;
    const cell =
      `<c r="${ref}"${style ? ` s="${style}"` : ""} t="inlineStr">` +
      `<is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;

    let patched;
    if (existing) {
      patched = body.slice(0, existing.index) + cell + body.slice(existing.index + existing[0].length);
    } else {
      // Cells have to stay in column order or Excel rejects the row.
      let insertAt = body.length;
      const cellRe = /<c\b([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g;
      let m;
      while ((m = cellRe.exec(body))) {
        const other = /\br="([A-Z]+)\d+"/.exec(m[1])?.[1];
        if (other && columnIndex(other) > targetColumn) {
          insertAt = m.index;
          break;
        }
      }
      patched = body.slice(0, insertAt) + cell + body.slice(insertAt);
    }

    xml = xml.slice(0, rowMatch.index) + open + patched + close + xml.slice(rowMatch.index + whole.length);
  }

  files.set(sheetPath, Buffer.from(xml, "utf8"));

  const names = [...files.keys()];
  const ordered = ["[Content_Types].xml", ...names.filter((n) => n !== "[Content_Types].xml")];
  return zip(ordered.filter((n) => files.has(n)).map((n) => [n, files.get(n)]));
}

/* --------------------------------------------------------------- writing --- */
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

// Style 1 = bold header, 2 = editable text, 3 = greyed generated text.
// Styles 2 and 3 carry the lock flag that sheet protection acts on.
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><i/><color rgb="FF808080"/><sz val="10"/><name val="Consolas"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDEDED"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyProtection="1"><protection locked="0"/></xf><xf numFmtId="49" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1" applyProtection="1"><protection locked="1"/></xf></cellXfs></styleSheet>`;

// Locks the generated columns without getting in the way of ordinary editing.
// Row insert/delete and sorting stay enabled: entries are matched by id, never by
// position, so reordering the sheet cannot corrupt an import.
const SHEET_PROTECTION =
  '<sheetProtection sheet="1" objects="1" scenarios="1" formatCells="0" formatColumns="0"' +
  ' formatRows="0" insertRows="0" deleteRows="0" sort="0" autoFilter="0"' +
  ' selectLockedCells="0" selectUnlockedCells="0"/>';

function columnName(index) {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - rem) / 26);
  }
  return name;
}

/**
 * Write a single-sheet workbook.
 *
 * Every cell is emitted as an inline string with the Text number format, so Excel
 * never reinterprets a value as a number, date, or formula on the way back in.
 *
 * The lock flag is applied to whole columns rather than to written cells. If it
 * were per-cell, every cell in the empty region below the data would inherit the
 * default locked style and nobody could add a new word.
 */
export function writeSheet({ sheetName = "Sheet1", columns, rows, protect = false }) {
  const lines = [];

  const headerCells = columns
    .map(
      (column, col) =>
        `<c r="${columnName(col)}1" s="1" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(column.label)}</t></is></c>`
    )
    .join("");
  lines.push(`<row r="1">${headerCells}</row>`);

  rows.forEach((row, index) => {
    const r = index + 2;
    const cells = row
      .map((value, col) => {
        if (value === "" || value === null || value === undefined) return "";
        const style = columns[col]?.style ?? 2;
        return `<c r="${columnName(col)}${r}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(value))}</t></is></c>`;
      })
      .join("");
    lines.push(`<row r="${r}">${cells}</row>`);
  });

  const cols = `<cols>${columns
    .map(
      (column, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${column.width}" customWidth="1" style="${column.style}"/>`
    )
    .join("")}</cols>`;

  // sheetProtection must follow sheetData; Excel rejects the file otherwise.
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${lines.join("")}</sheetData>${protect ? SHEET_PROTECTION : ""}</worksheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  return zip([
    ["[Content_Types].xml", Buffer.from(CONTENT_TYPES, "utf8")],
    ["_rels/.rels", Buffer.from(ROOT_RELS, "utf8")],
    ["xl/workbook.xml", Buffer.from(workbookXml, "utf8")],
    ["xl/_rels/workbook.xml.rels", Buffer.from(WORKBOOK_RELS, "utf8")],
    ["xl/styles.xml", Buffer.from(STYLES, "utf8")],
    ["xl/worksheets/sheet1.xml", Buffer.from(sheetXml, "utf8")],
  ]);
}
