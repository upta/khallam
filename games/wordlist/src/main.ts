import { registerGame, type GameContext } from "@klallam/game-kit";
import type { LexiconEntry } from "@klallam/lexicon";
import styles from "./style.css?inline";

function wordRow(entry: LexiconEntry, context: GameContext): HTMLElement {
  const row = document.createElement("div");
  row.className = "wrow";

  const klallam = document.createElement("span");
  klallam.className = "w-kl";
  klallam.textContent = entry.klallam;

  const arrow = document.createElement("span");
  arrow.className = "w-ar";
  arrow.textContent = "\u2192";

  const english = document.createElement("span");
  english.className = "w-en";
  english.textContent = entry.english;

  row.append(klallam, arrow, english);

  // Only where there is something to play. Most words have no recording yet.
  if (context.canPlay(entry)) {
    const play = document.createElement("button");
    play.type = "button";
    play.className = "w-play";
    play.textContent = "\u{1F50A}";
    play.setAttribute("aria-label", `Play the recording of "${entry.english}"`);
    play.addEventListener("click", () => context.playRecording(entry));
    row.append(play);
  }

  return row;
}

registerGame({
  id: "wordlist",
  name: "Words",
  icon: "\u{1F4D6}",
  layout: "panel",
  start(context) {
    const sheet = document.createElement("style");
    sheet.textContent = styles;

    const list = document.createElement("div");
    list.className = "wlist";

    const words = context.words();
    if (words.length === 0) {
      const note = document.createElement("p");
      note.className = "empty";
      note.textContent = "There are no words in this chapter yet.";
      list.append(note);
    } else {
      list.append(...words.map((entry) => wordRow(entry, context)));
    }

    context.root.append(sheet, list);
  },
});
