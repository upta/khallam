import { registerGame } from "@klallam/game-kit";
import type { LexiconEntry } from "@klallam/lexicon";
import styles from "./style.css?inline";

function shuffle(items: readonly LexiconEntry[]): LexiconEntry[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as LexiconEntry, out[i] as LexiconEntry];
  }
  return out;
}

function element(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

registerGame({
  id: "flashcards",
  name: "Flashcards",
  icon: "\u{1F4C7}",
  layout: "panel",
  start(context) {
    const sheet = document.createElement("style");
    sheet.textContent = styles;

    const words = context.words();
    if (words.length === 0) {
      context.root.append(sheet, element("p", "empty", "There are no words in this chapter yet."));
      return;
    }

    let deck = shuffle(words);
    let index = 0;
    let flipped = false;

    const position = document.createElement("span");
    const percent = document.createElement("span");
    const info = element("div", "fc-info");
    info.append(position, percent);

    const fill = element("div", "fc-fill");
    const bar = element("div", "fc-bar");
    bar.append(fill);

    const progress = element("div", "fc-prog-wrap");
    progress.append(info, bar);

    const klallam = element("div", "fc-word");
    const front = element("div", "fc-face fc-front");
    front.append(element("div", "fc-tag", "Klallam"), klallam);

    const english = element("div", "fc-eng");
    const back = element("div", "fc-face fc-back");
    back.append(element("div", "fc-tag", "English"), english);

    const inner = element("div", "fc-inner");
    inner.append(front, back);

    const scene = document.createElement("button");
    scene.type = "button";
    scene.className = "fc-scene";
    scene.append(inner);

    const previous = element("button", "btn-circ", "\u2190");
    previous.setAttribute("aria-label", "Previous card");
    const shuffleButton = element("button", "btn-pill", "\u{1F500} Shuffle");
    const next = element("button", "btn-circ", "\u2192");
    next.setAttribute("aria-label", "Next card");

    const controls = element("div", "fc-ctrls");
    controls.append(previous, shuffleButton, next);

    const wrap = element("div", "fc-wrap");
    wrap.append(
      progress,
      scene,
      element("div", "fc-hint", "Tap the card to flip it \u00B7 \u2190 \u2192 to move"),
      controls
    );

    function draw(): void {
      const word = deck[index];
      if (word === undefined) return;
      klallam.textContent = word.klallam;
      english.textContent = word.english;
      position.textContent = `Card ${index + 1} of ${deck.length}`;
      const done = Math.round(((index + 1) / deck.length) * 100);
      percent.textContent = `${done}%`;
      fill.style.width = `${done}%`;
      scene.classList.toggle("flipped", flipped);
      scene.setAttribute("aria-label", flipped ? "Card, English side" : "Card, Klallam side");
    }

    function show(nextIndex: number): void {
      index = nextIndex;
      if (!flipped) {
        draw();
        return;
      }
      flipped = false;
      scene.classList.add("instant");
      draw();
      void scene.offsetWidth; // Applies the turn before the animation is allowed back.
      scene.classList.remove("instant");
    }

    function step(by: number): void {
      show((index + by + deck.length) % deck.length);
    }

    scene.addEventListener("click", () => {
      flipped = !flipped;
      draw();
    });
    previous.addEventListener("click", () => step(-1));
    next.addEventListener("click", () => step(1));
    shuffleButton.addEventListener("click", () => {
      deck = shuffle(words);
      show(0);
    });

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      step(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKeyDown);

    draw();
    context.root.append(sheet, wrap);

    return () => window.removeEventListener("keydown", onKeyDown);
  },
});
