import { getChapters, getWords, type Chapter } from "@klallam/lexicon";
import {
  ensureKlallamFont,
  getPoints,
  placeGame,
  GAME_FINISHED_EVENT,
} from "@klallam/game-kit";
import "./style.css";

// Loaded before anything shows a word, so no Klallam is ever drawn in a fallback font.
void ensureKlallamFont();

const score = document.querySelector("#total-score");

function showPoints(): void {
  if (score !== null) score.textContent = String(getPoints());
}

showPoints();

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
  /** The words the site hands this game for the chosen chapter, by lexicon id. */
  wordsToHand: (chapter: Chapter) => string[];
  /** Downloaded only when the game is chosen, which is what registers its tag. */
  load: () => Promise<unknown>;
}

const GAMES: GameTab[] = [
  {
    id: "fishybird",
    label: "FishyBird",
    icon: "\u{1F41F}",
    // Says every word out loud, so it is given only words that can be spoken. Every
    // playable word for now; narrowing this to the chapter is a change here and nowhere
    // else.
    wordsToHand: () => spokenWordIds(),
    load: () => import("@klallam/fishybird"),
  },
  {
    id: "flashcards",
    label: "Flashcards",
    icon: "\u{1F4C7}",
    wordsToHand: (chapter) => chapterWordIds(chapter),
    load: () => import("@klallam/flashcards"),
  },
  {
    id: "quiz",
    label: "Quiz",
    icon: "\u2753",
    wordsToHand: (chapter) => chapterWordIds(chapter),
    load: () => import("@klallam/quiz"),
  },
  {
    id: "matching",
    label: "Match",
    icon: "\u{1F517}",
    wordsToHand: (chapter) => chapterWordIds(chapter),
    load: () => import("@klallam/matching"),
  },
  {
    id: "wordlist",
    label: "Words",
    icon: "\u{1F4D6}",
    wordsToHand: (chapter) => chapterWordIds(chapter),
    load: () => import("@klallam/wordlist"),
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
  card.addEventListener("click", () => {
    history.pushState(null, "", addressFor(chapter.tag, null));
    showChapter(chapter, true);
  });
  return card;
}

function message(text: string): HTMLElement {
  const note = document.createElement("p");
  note.className = "panel-note";
  note.textContent = text;
  return note;
}

function addressFor(chapterTag: string | null, gameId: string | null): string {
  const params = new URLSearchParams();
  if (chapterTag !== null) params.set("chapter", chapterTag);
  if (gameId !== null) params.set("game", gameId);
  const query = params.toString();
  return query === "" ? location.pathname : `${location.pathname}?${query}`;
}

function closePanel(): void {
  for (const card of document.querySelectorAll(".scard")) card.classList.remove("active");
  panel?.classList.remove("visible");
  panelTabs?.replaceChildren();
  // Empties the panel, which is also what stops a game that was running in it.
  panelBody?.replaceChildren();
}

function showChapter(chapter: Chapter, scroll: boolean): void {
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
  if (scroll) panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function gameTab(game: GameTab, chapter: Chapter): HTMLElement {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "gtab";
  tab.dataset["game"] = game.id;
  tab.textContent = `${game.icon} ${game.label}`;
  tab.addEventListener("click", () => {
    history.pushState(null, "", addressFor(chapter.tag, game.id));
    void showGame(game, chapter);
  });
  return tab;
}

async function showGame(game: GameTab, chapter: Chapter): Promise<void> {
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
    panelBody.replaceChildren(placeGame(game.id, game.wordsToHand(chapter)));
  } catch (error) {
    console.error(`${game.label} did not start:`, error);
    panelBody.replaceChildren(message(`${game.label} could not be started.`));
  }
}

/** Words with a recording, which are the only ones a game may say out loud. */
function spokenWordIds(): string[] {
  return getWords({ requireAudio: true, includeNeedsReview: false }).map((entry) => entry.id);
}

/** Every word tagged with the chapter. Being flagged for review does not hide a word. */
function chapterWordIds(chapter: Chapter): string[] {
  return getWords({ tags: [chapter.tag] }).map((entry) => entry.id);
}

/** The address is what says which chapter and game are open, so back and reload work. */
function showWhatTheAddressAsksFor(scroll: boolean): void {
  const params = new URLSearchParams(location.search);
  const chapter = getChapters().find((item) => item.tag === params.get("chapter"));
  if (chapter === undefined) {
    closePanel();
    return;
  }
  showChapter(chapter, scroll);
  const game = GAMES.find((item) => item.id === params.get("game"));
  if (game !== undefined) void showGame(game, chapter);
}

if (grid !== null) grid.replaceChildren(...getChapters().map(chapterCard));
// A game awards its points as a round ends, which is when the header can catch up.
panelBody?.addEventListener(GAME_FINISHED_EVENT, showPoints);
window.addEventListener("popstate", () => showWhatTheAddressAsksFor(false));
showWhatTheAddressAsksFor(true);
