import { playWord } from "./audio";
import { TUNING } from "./config";

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className: string, label: string): HTMLButtonElement {
  const node = make("button", className, label);
  node.type = "button";
  return node;
}

export interface MissedWord {
  klallam: string;
  english: string;
  audioUrl: string;
}

export interface GameUi {
  /** The box Phaser draws into. */
  readonly gameParent: HTMLElement;
  renderLevels(names: readonly string[], onPick: (index: number) => void): void;
  showChooser(): void;
  hideChooser(): void;
  onChangeLevel(handler: () => void): void;
  onReplay(handler: () => void): void;
  onPlayAgain(handler: () => void): void;
  showWord(klallam: string): void;
  clearWord(): void;
  showScore(levelName: string, caught: number, outOf: number): void;
  showSummary(
    caught: number,
    outOf: number,
    missed: readonly MissedWord[],
    levelNote: string
  ): void;
  hideSummary(): void;
}

/** Builds the game's own furniture inside the root it is given, owning nothing outside it. */
export function createUi(root: ShadowRoot | HTMLElement): GameUi {
  const app = make("div");
  app.id = "app";

  const changeLevelButton = button("control change-level", "Change level");
  const banner = make("p", "banner");
  banner.setAttribute("aria-live", "polite");

  const gameParent = make("div");
  gameParent.id = "game";

  const replayButton = button("control", "Hear it again");
  const score = make("p", "score");
  score.setAttribute("aria-live", "polite");
  const controls = make("div", "controls");
  controls.append(replayButton, score);

  const levelButtons = make("div", "level-buttons");
  const overlay = make("div", "start-overlay");
  overlay.append(make("h2", "chooser-title", "Choose a level"), levelButtons);

  const summaryScore = make("h2", "summary-score");
  const summaryLevel = make("p", "summary-lead");
  const summaryLead = make("p", "summary-lead");
  const missedList = make("ul", "missed");
  const playAgainButton = button("start-button", "Play again");
  const summaryChangeLevelButton = button("start-button", "Change level");
  const summaryActions = make("div", "summary-actions");
  summaryActions.append(playAgainButton, summaryChangeLevelButton);
  const summary = make("div", "summary");
  summary.hidden = true;
  summary.append(summaryScore, summaryLevel, summaryLead, missedList, summaryActions);

  app.append(changeLevelButton, banner, gameParent, controls, overlay, summary);
  root.append(app);

  replayButton.hidden = !TUNING.allowAudioReplay;
  changeLevelButton.hidden = true;

  return {
    gameParent,
    renderLevels(names, onPick) {
      levelButtons.replaceChildren(
        ...names.map((name, index) => {
          const level = button("start-button", name);
          level.addEventListener("click", () => {
            // A button keeping focus would swallow the space bar, which the game uses to dive.
            level.blur();
            onPick(index);
          });
          return level;
        })
      );
    },
    showChooser() {
      overlay.hidden = false;
      changeLevelButton.hidden = true;
    },
    hideChooser() {
      overlay.hidden = true;
      changeLevelButton.hidden = false;
    },
    onChangeLevel(handler) {
      for (const control of [changeLevelButton, summaryChangeLevelButton]) {
        control.addEventListener("click", () => {
          control.blur();
          handler();
        });
      }
    },
    onReplay(handler) {
      replayButton.addEventListener("click", () => {
        replayButton.blur();
        handler();
      });
    },
    showWord(klallam) {
      // Klallam reaches the page only as text content, never as markup.
      banner.textContent = klallam;
    },
    clearWord() {
      banner.textContent = "";
    },
    showScore(levelName, caught, outOf) {
      score.textContent = `${levelName} - caught ${caught} of ${outOf}`;
    },
    onPlayAgain(handler) {
      playAgainButton.addEventListener("click", () => {
        playAgainButton.blur();
        handler();
      });
    },
    showSummary(caught, outOf, missed, levelNote) {
      summaryScore.textContent = `You caught ${caught} of ${outOf}`;
      summaryLevel.textContent = levelNote;
      summaryLead.textContent =
        missed.length === 0
          ? "Every word. Nothing to go back over."
          : "These ones got away. Listen to them again:";

      missedList.replaceChildren(
        ...missed.map((word) => {
          const item = make("li");

          // Built as text, never markup, so no mark can be lost to HTML parsing.
          const klallam = make("span", "missed-klallam", word.klallam);
          const english = make("span", "missed-english", word.english);

          const play = button("control", "Hear it");
          play.addEventListener("click", () => {
            play.blur();
            playWord(word.audioUrl);
          });

          item.append(klallam, english, play);
          return item;
        })
      );

      controls.hidden = true;
      summary.hidden = false;
    },
    hideSummary() {
      summary.hidden = true;
      controls.hidden = false;
    },
  };
}
