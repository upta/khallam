import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./lib.mjs";

// Klallam text belongs in the lexicon package. If a non-ASCII character shows up
// in game, site or tool source, an agent has inlined a word where it cannot be verified.
const SCAN_ROOTS = ["games", "packages", "site", "tools"];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".html", ".css"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);

const violations = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(item.name)) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      walk(full);
    } else if (SCAN_EXTENSIONS.has(path.extname(item.name))) {
      scan(full);
    }
  }
}

function scan(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    // eslint-disable-next-line no-control-regex
    const match = line.match(/[^\x00-\x7F]/);
    if (match) {
      violations.push({
        file: path.relative(REPO_ROOT, file),
        line: index + 1,
        char: "U+" + match[0].codePointAt(0).toString(16).toUpperCase().padStart(4, "0"),
      });
    }
  });
}

for (const root of SCAN_ROOTS) walk(path.join(REPO_ROOT, root));

if (violations.length > 0) {
  console.error("Non-ASCII characters found in source code:\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.char}`);
  }
  console.error(
    "\nKlallam text must live only in lexicon/lexicon.json, where it is codepoint-verified and locked."
  );
  console.error("In source code, write characters as escapes such as \\u0313.");
  process.exit(1);
}

console.log("ASCII guard passed. No Klallam text inlined in source code.");
