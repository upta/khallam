import { getChapters, getWords, type Chapter } from "@klallam/lexicon";
import { ensureKlallamFont, getPoints, placeGame } from "@klallam/game-kit";
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

interface GameTab {
  id: string;
  label: string;
  icon: string;
  /** Downloaded only when the game is chosen, which is what registers its tag. */
  load: () => Promise<unknown>;
}

const GAMES: GameTab[] = [
  {
    id: "fishybird",
    label: "FishyBird",
    icon: "\u{1F41F}",
    load: () => import("@klallam/fishybird"),
  },
];

const grid = document.querySelector("#subj-grid");
const panel = document.querySelector("#game-area");
const panelIcon = document.querySelector("#g-icon");
const panelBadge = document.querySelector("#g-badge");
const panelTabs = document.querySelector("#g-tabs");
const panelBody = document.querySelector("#g-body");

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
  card.addEventListener("click", () => openChapter(chapter));
  return card;
}

function message(text: string): HTMLElement {
  const note = document.createElement("p");
  note.className = "panel-note";
  note.textContent = text;
  return note;
}

function openChapter(chapter: Chapter): void {
  if (panel === null || panelTabs === null || panelBody === null) return;
  const decoration = DECORATION[chapter.tag];

  for (const card of document.querySelectorAll(".scard")) {
    card.classList.toggle("active", card.getAttribute("data-chapter") === chapter.tag);
  }

  if (panelIcon !== null) panelIcon.textContent = decoration?.icon ?? "";
  if (panelBadge !== null) {
    panelBadge.className =
      decoration === undefined ? "subj-badge" : `subj-badge sb-${decoration.color}`;
    panelBadge.textContent = chapter.label;
  }

  panelTabs.replaceChildren(...GAMES.map((game) => gameTab(game, chapter)));
  panelBody.replaceChildren(message("Choose a game to start."));
  panel.classList.add("visible");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function gameTab(game: GameTab, chapter: Chapter): HTMLElement {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "gtab";
  tab.dataset["game"] = game.id;
  tab.textContent = `${game.icon} ${game.label}`;
  tab.addEventListener("click", () => void startGame(game, chapter));
  return tab;
}

async function startGame(game: GameTab, chapter: Chapter): Promise<void> {
  if (panelTabs === null || panelBody === null) return;
  const decoration = DECORATION[chapter.tag];

  for (const tab of panelTabs.querySelectorAll(".gtab")) {
    const active = tab.getAttribute("data-game") === game.id;
    tab.className =
      active && decoration !== undefined ? `gtab active ${decoration.color}` : "gtab";
  }

  panelBody.replaceChildren(message(`Loading ${game.label}...`));
  try {
    await game.load();
    // Every playable word for now. Narrowing this to the chapter is a change here and
    // nowhere else.
    panelBody.replaceChildren(placeGame(game.id, playableWordIds()));
  } catch (error) {
    console.error(`${game.label} did not start:`, error);
    panelBody.replaceChildren(message(`${game.label} could not be started.`));
  }
}

function playableWordIds(): string[] {
  return getWords({ requireAudio: true, includeNeedsReview: false }).map((entry) => entry.id);
}

if (grid !== null) grid.replaceChildren(...getChapters().map(chapterCard));
