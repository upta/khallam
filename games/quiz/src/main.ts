import { registerGame } from "@klallam/game-kit";
import type { LexiconEntry } from "@klallam/lexicon";
import styles from "./style.css?inline";

const OPTIONS = 4;
const POINTS_PER_ANSWER = 5;
const PAUSE_BEFORE_NEXT = 1500;

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

/** The right meaning plus three others, never the same meaning twice. */
function optionsFor(word: LexiconEntry, pool: readonly LexiconEntry[]): string[] {
  const others = [...new Set(pool.map((entry) => entry.english))].filter(
    (meaning) => meaning !== word.english
  );
  return shuffle([word.english, ...shuffle(others).slice(0, OPTIONS - 1)]);
}

registerGame({
  id: "quiz",
  name: "Quiz",
  icon: "\u2753",
  layout: "panel",
  start(context) {
    const sheet = document.createElement("style");
    sheet.textContent = styles;

    const words = context.words();
    const meanings = new Set(words.map((entry) => entry.english)).size;
    if (meanings < OPTIONS) {
      const note =
        meanings === 0
          ? "There are no words in this chapter yet."
          : `A quiz question needs four different meanings to choose between, and this chapter has ${meanings}.`;
      context.root.append(sheet, element("p", "empty", note));
      return;
    }

    const body = element("div", "quiz");
    let deck = shuffle(words);
    let index = 0;
    let score = 0;
    let timer: number | null = null;

    function finished(): void {
      const earned = score * POINTS_PER_ANSWER;
      context.awardPoints(earned);
      context.finish({ score, outOf: deck.length });

      const well = score >= Math.ceil(deck.length * 0.75);
      const done = element("div", "done");
      done.append(
        element("div", "emoji", well ? "\u{1F389}" : "\u{1F44D}"),
        element("h2", "", well ? "Excellent!" : "Good effort!"),
        element(
          "p",
          "",
          `${score} of ${deck.length} correct \u2014 +${earned} points earned!`
        )
      );

      const again = element("button", "btn-act", "Play Again");
      again.addEventListener("click", () => {
        deck = shuffle(words);
        index = 0;
        score = 0;
        draw();
      });
      done.append(again);
      body.replaceChildren(done);
    }

    function draw(): void {
      const word = deck[index];
      if (word === undefined) {
        finished();
        return;
      }

      const row = element("div", "q-row");
      row.append(
        element("span", "q-label", `Question ${index + 1} / ${deck.length}`),
        element("span", "q-num", `\u2705 ${score}`)
      );

      const box = element("div", "qbox");
      box.append(
        element("div", "q-prompt", "What does this Klallam word mean?"),
        element("div", "q-word", word.klallam)
      );

      const feedback = element("div", "q-fb");
      const choices = element("div", "q-opts");
      let answered = false;

      const buttons = optionsFor(word, deck).map((meaning) => {
        const option = element("button", "opt", meaning) as HTMLButtonElement;
        option.type = "button";
        option.addEventListener("click", () => {
          if (answered) return;
          answered = true;
          for (const other of buttons) {
            other.disabled = true;
            if (other.textContent === word.english) other.classList.add("correct");
          }
          if (meaning === word.english) {
            score += 1;
            feedback.className = "q-fb fb-ok";
            feedback.textContent = `\u2713 Correct! +${POINTS_PER_ANSWER} pts`;
          } else {
            option.classList.add("wrong");
            feedback.className = "q-fb fb-bad";
            feedback.textContent = `\u2717 Answer: ${word.english}`;
          }
          timer = window.setTimeout(() => {
            index += 1;
            draw();
          }, PAUSE_BEFORE_NEXT);
        });
        return option;
      });

      choices.append(...buttons);
      body.replaceChildren(row, box, choices, feedback);
    }

    draw();
    context.root.append(sheet, body);

    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  },
});
