import { getChapters, getWords, type Chapter } from "@klallam/lexicon";
import { ensureKlallamFont, getPoints } from "@klallam/game-kit";
import "./style.css";

// Loaded before anything shows a word, so no Klallam is ever drawn in a fallback font.
void ensureKlallamFont();

const score = document.querySelector("#total-score");
if (score !== null) score.textContent = String(getPoints());

interface Decoration {
  color: string;
  icon: string;
}

// Colour and icon are decoration, not lexicon data. A chapter with no entry here still
// shows; it just shows plainly.
const DECORATION: Record<string, Decoration> = {
  "ch-1.1": { color: "blue", icon: "\u{1F3C3}" },
  "ch-1.2": { color: "green", icon: "\u{1F91D}" },
  "ch-4": { color: "teal", icon: "\u{1F3E0}" },
  "ch-6": { color: "orange", icon: "\u2728" },
  pronouns: { color: "purple", icon: "\u{1F64B}" },
};

function chapterCard(chapter: Chapter): HTMLElement {
  const decoration = DECORATION[chapter.tag];
  const count = getWords({ tags: [chapter.tag] }).length;

  const card = document.createElement("button");
  card.type = "button";
  card.className = decoration === undefined ? "scard" : `scard ${decoration.color}`;
  card.dataset["chapter"] = chapter.tag;

  if (decoration !== undefined) {
    const icon = document.createElement("span");
    icon.className = "s-emoji";
    icon.textContent = decoration.icon;
    card.append(icon);
  }

  const name = document.createElement("span");
  name.className = "s-name";
  name.textContent = chapter.label;

  const words = document.createElement("span");
  words.className = "s-count";
  words.textContent = count === 1 ? "1 word" : `${count} words`;

  card.append(name, words);
  return card;
}

const grid = document.querySelector("#subj-grid");
if (grid !== null) grid.replaceChildren(...getChapters().map(chapterCard));
