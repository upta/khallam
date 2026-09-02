import { registerGame } from "@klallam/game-kit";
import type { LexiconEntry } from "@klallam/lexicon";
import styles from "./style.css?inline";

const PAIRS_PER_ROUND = 6;
const POINTS_PER_PAIR = 10;
const WRONG_PAIR_PAUSE = 400;
const PAUSE_BEFORE_DONE = 500;

function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function element(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Two words meaning the same thing would make a right pairing look wrong. */
function oneWordPerMeaning(words: readonly LexiconEntry[]): LexiconEntry[] {
  const seen = new Set<string>();
  return words.filter((entry) => {
    if (seen.has(entry.english)) return false;
    seen.add(entry.english);
    return true;
  });
}

registerGame({
  id: "matching",
  name: "Match",
  icon: "\u{1F517}",
  layout: "panel",
  start(context) {
    const sheet = document.createElement("style");
    sheet.textContent = styles;

    const usable = oneWordPerMeaning(context.words());
    if (usable.length < 2) {
      const note =
        usable.length === 0
          ? "There are no words in this chapter yet."
          : "Matching needs at least two words with different meanings.";
      context.root.append(sheet, element("p", "empty", note));
      return;
    }

    const body = element("div", "matching");
    const timers = new Set<number>();
    const wait = (run: () => void, ms: number): void => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        run();
      }, ms);
      timers.add(id);
    };

    function finished(pairs: number): void {
      const done = element("div", "done");
      done.append(
        element("div", "emoji", "\u{1F38A}"),
        element("h2", "", "All Matched!"),
        element("p", "", `Perfect! +${pairs * POINTS_PER_PAIR} points earned.`)
      );
      const again = element("button", "btn-act", "Play Again");
      again.addEventListener("click", draw);
      done.append(again);
      body.replaceChildren(done);
    }

    function draw(): void {
      const pairs = shuffle(usable).slice(0, PAIRS_PER_ROUND);
      let matched = 0;
      let chosenKlallam: HTMLButtonElement | null = null;
      let chosenEnglish: HTMLButtonElement | null = null;

      const status = element("div", "match-status", `Matched: 0 / ${pairs.length}`);

      function choose(button: HTMLButtonElement, side: "k" | "e"): void {
        if (button.classList.contains("matched")) return;
        const previous = side === "k" ? chosenKlallam : chosenEnglish;
        previous?.classList.remove("sel");
        button.classList.add("sel");
        if (side === "k") chosenKlallam = button;
        else chosenEnglish = button;

        const klallam = chosenKlallam;
        const english = chosenEnglish;
        if (klallam === null || english === null) return;
        chosenKlallam = null;
        chosenEnglish = null;

        if (klallam.dataset["word"] !== english.dataset["word"]) {
          klallam.classList.add("bad");
          english.classList.add("bad");
          wait(() => {
            klallam.classList.remove("bad", "sel");
            english.classList.remove("bad", "sel");
          }, WRONG_PAIR_PAUSE);
          return;
        }

        for (const paired of [klallam, english]) {
          paired.classList.remove("sel");
          paired.classList.add("matched");
        }
        matched += 1;
        status.textContent = `Matched: ${matched} / ${pairs.length}`;
        context.awardPoints(POINTS_PER_PAIR);
        if (matched === pairs.length) {
          context.finish({ score: matched, outOf: pairs.length });
          wait(() => finished(pairs.length), PAUSE_BEFORE_DONE);
        }
      }

      function column(side: "k" | "e"): HTMLElement {
        const col = element("div", "match-col");
        col.append(
          ...shuffle(pairs).map((entry) => {
            const button = element(
              "button",
              side === "k" ? "mbtn mk" : "mbtn me",
              side === "k" ? entry.klallam : entry.english
            ) as HTMLButtonElement;
            button.type = "button";
            button.dataset["word"] = entry.id;
            button.addEventListener("click", () => choose(button, side));
            return button;
          })
        );
        return col;
      }

      const grid = element("div", "match-grid");
      grid.append(column("k"), column("e"));

      body.replaceChildren(
        element(
          "p",
          "match-note",
          "Match each Klallam word to its English meaning \u2014 select one from each column!"
        ),
        grid,
        status
      );
    }

    draw();
    context.root.append(sheet, body);

    return () => {
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
    };
  },
});
