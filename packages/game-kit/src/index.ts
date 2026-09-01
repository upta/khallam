import { getWords, type LexiconEntry } from "@klallam/lexicon";
import { playRecording, playRecordingUrl, recordingUrl } from "./audio";
import { awardPoints, getPoints, storageFor, type GameStorage } from "./storage";

export type { GameStorage } from "./storage";
export { getPoints } from "./storage";
export { recordingUrl } from "./audio";

/** Whether the game wants the whole screen or is happy in a panel on a page. */
export type GameLayout = "fullscreen" | "panel";

export interface GameWordQuery {
  tags?: string[];
}

export interface GameResult {
  score: number;
  outOf: number;
}

/** Everything a game is given. A game should reach for nothing outside this. */
export interface GameContext {
  /** The sealed-off root to draw in. Nothing here leaks out to the page. */
  readonly root: ShadowRoot;
  /** Words safe to teach: confirmed text with a recording. */
  words(query?: GameWordQuery): LexiconEntry[];
  playRecording(entry: LexiconEntry): void;
  playRecordingUrl(url: string): void;
  recordingUrl(entry: LexiconEntry): string | null;
  /** Progress storage, kept under this game's own id. */
  readonly storage: GameStorage;
  /** Adds to the site-wide total and returns it. */
  awardPoints(points: number): number;
  /** Says a round is over, so whatever placed the game can react. */
  finish(result: GameResult): void;
}

/** Returned by a game that has something to undo when it is taken off the page. */
export type GameTeardown = () => void;

export interface GameDefinition {
  /** ASCII slug. Becomes the tag name and the storage name. Never shown to a player. */
  id: string;
  name: string;
  /** A short glyph or an image URL, for whatever lists the games. */
  icon: string;
  layout: GameLayout;
  start(context: GameContext): GameTeardown | void;
}

/** The event a placed game fires when a round ends. */
export const GAME_FINISHED_EVENT = "klallam-game-finished";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

const HOST_CSS = `
  :host { display: block; position: relative; }
  :host([hidden]) { display: none; }
  :host([data-layout="fullscreen"]) { width: 100%; height: 100%; }
`;

export function tagNameFor(gameId: string): string {
  return `klallam-${gameId}`;
}

/**
 * Turns a game into a tag the site can place. Everything the game draws lives inside
 * that tag, so the page's styling cannot reach in and the game's cannot reach out.
 */
export function registerGame(definition: GameDefinition): string {
  if (!ID_PATTERN.test(definition.id)) {
    throw new Error(
      `Game id "${definition.id}" must be lowercase ASCII letters, digits and dashes, starting with a letter.`
    );
  }

  const tag = tagNameFor(definition.id);
  if (customElements.get(tag) !== undefined) return tag;

  class GameElement extends HTMLElement {
    private teardown: GameTeardown | null = null;

    connectedCallback(): void {
      if (this.teardown !== null) return;

      const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = HOST_CSS;
      root.append(style);
      this.dataset["layout"] = definition.layout;

      const context: GameContext = {
        root,
        words: (query = {}) =>
          getWords({ ...query, requireAudio: true, includeNeedsReview: false }),
        playRecording,
        playRecordingUrl,
        recordingUrl,
        storage: storageFor(definition.id),
        awardPoints,
        finish: (result) => {
          this.dispatchEvent(
            new CustomEvent<GameResult>(GAME_FINISHED_EVENT, {
              detail: result,
              bubbles: true,
              composed: true,
            })
          );
        },
      };

      this.teardown = definition.start(context) ?? (() => {});
    }

    disconnectedCallback(): void {
      this.teardown?.();
      this.teardown = null;
    }
  }

  customElements.define(tag, GameElement);
  return tag;
}
