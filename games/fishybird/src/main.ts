import { registerGame } from "@klallam/game-kit";
import type { LexiconEntry } from "@klallam/lexicon";
import Phaser from "phaser";
import { playCatchChime, playWord } from "./audio";
import { LEVELS, TUNING, clampLevelIndex, levelAt, type Level } from "./config";
import { recordAnswer, startRound } from "./memory";
import {
  containsPoint,
  createCatchBurst,
  createSalmon,
  interceptPoint,
  positionAt,
  type Salmon,
} from "./salmon";
import { createUi, type GameUi } from "./ui";
import { buildRound, type RoundWord } from "./words";
import styles from "./style.css?inline";

const WIDTH = 960;
const HEIGHT = 540;
const SEA_Y = 360;
const ORCA_HIDDEN_Y = HEIGHT + 120;
// High enough that the body clears the waterline rather than resting on it.
const ORCA_PEAK_Y = SEA_Y - 70;
// The orca's head is its left end, and a positive angle turns clockwise, which lifts
// that end. Level at the top of the arc.
const ORCA_TILT = 28;
// It leaves the water right of centre and re-enters left of it, about a body length
// apart, because nothing jumps straight up out of the water.
const ORCA_ENTRY_X = WIDTH / 2 + 140;
const ORCA_EXIT_X = WIDTH / 2 - 140;
const EAGLE_PERCH_Y = 110;
// Centred so the shallowest fish still clears the waterline and the deepest the seabed.
const SALMON_LANE_Y = 450;
const SALMON_START_X = WIDTH + 160;
// A fish already tapped waits here rather than leaving before the eagle can reach it.
const LANE_MIN_X = 90;
// How close to an edge the eagle may perch, so it always has room to turn.
const EAGLE_MARGIN_X = 120;

function drawSea(scene: Phaser.Scene): void {
  scene.add.rectangle(WIDTH / 2, (HEIGHT + SEA_Y) / 2, WIDTH, HEIGHT - SEA_Y, 0x0a5470);
  scene.add.rectangle(WIDTH / 2, SEA_Y, WIDTH, 6, 0x7fc8de);
}

// Shapes drawn in code, so swapping in real artwork later changes no layout.
function createOrca(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const body = scene.add.ellipse(0, 0, 260, 90, 0x101c24);
  const belly = scene.add.ellipse(30, 26, 170, 38, 0xf2fbff);
  const eyePatch = scene.add.ellipse(-78, -14, 30, 16, 0xf2fbff);
  const fin = scene.add.triangle(-10, -60, 0, 30, 34, -30, 62, 30, 0x101c24);
  return scene.add.container(WIDTH / 2, ORCA_HIDDEN_Y, [body, belly, eyePatch, fin]);
}

function createEagle(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const tail = scene.add.triangle(-56, 2, 0, -18, 0, 18, 36, 0, 0xf6fbfd);
  const body = scene.add.ellipse(0, 0, 108, 46, 0x4a2c12);
  const wing = scene.add.triangle(-4, -18, 0, 22, 42, -28, 82, 18, 0x33200c);
  const head = scene.add.circle(50, -8, 21, 0xf6fbfd);
  const beak = scene.add.triangle(68, -4, 0, -9, 0, 9, 24, 0, 0xf0b429);
  return scene.add.container(WIDTH / 2, EAGLE_PERCH_Y, [tail, body, wing, head, beak]);
}

class RoundScene extends Phaser.Scene {
  private level: Level = levelAt(0);
  private levelIndex = 0;
  private round: RoundWord[] = [];
  private index = 0;
  private orca!: Phaser.GameObjects.Container;
  private eagle!: Phaser.GameObjects.Container;
  private flying = false;
  private salmon: Salmon[] = [];
  private waiting: Salmon[] = [];
  /** Bolting for the left edge. Out of this list is the only way a fish can be tapped. */
  private fleeing: Salmon[] = [];
  /** Tapped and answered for, still swimming until the eagle reaches it. */
  private targeted: Salmon | null = null;
  private runStartedAt = 0;
  private released = 0;
  private caught = 0;
  private wrongThisWord = false;
  /** Wrong grabs at the group in the water now, against the level's allowance. */
  private wrongGrabs = 0;
  private roundOver = false;
  private wordInPlay = false;
  private missed: RoundWord[] = [];

  constructor(
    private readonly ui: GameUi,
    private readonly pool: readonly LexiconEntry[],
    private readonly onFinished: (caught: number, outOf: number) => void
  ) {
    super("round");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#123c50");
    drawSea(this);
    this.orca = createOrca(this);
    this.eagle = createEagle(this);
    this.eagle.setDepth(10);

    this.ui.renderLevels(
      LEVELS.map((level) => level.name),
      (index) => this.beginRound(index)
    );
    this.ui.onReplay(() => this.replayWord());
    this.ui.onChangeLevel(() => this.abandonRound());
    this.ui.onPlayAgain(() => this.beginRound(this.levelIndex));

    // The tap is the answer. Whatever the eagle passes on its way there is not.
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) =>
      this.tapAt(pointer.worldX, pointer.worldY)
    );
  }

  /**
   * Puts the scene back the way a round finds it. Every start and every stop goes
   * through here, so no level can inherit the last one's fish, timers or bird.
   */
  private stopPlay(): void {
    // A queued advance from the last round would otherwise fire into the new one.
    this.time.removeAllEvents();
    this.wordInPlay = false;
    this.wrongThisWord = false;
    this.wrongGrabs = 0;
    this.runStartedAt = 0;
    this.clearSalmon();
    this.hideOrca();
    this.perchEagle();
  }

  private perchEagle(): void {
    this.tweens.killTweensOf(this.eagle);
    this.eagle.setPosition(WIDTH / 2, EAGLE_PERCH_Y);
    this.eagle.scaleX = 1;
    this.flying = false;
  }

  private beginRound(index: number): void {
    this.levelIndex = clampLevelIndex(index);
    this.level = levelAt(this.levelIndex);
    this.ui.hideSummary();
    this.ui.hideChooser();
    this.stopPlay();
    startRound();
    this.round = buildRound(this.pool, this.level);
    this.index = 0;
    this.caught = 0;
    this.missed = [];
    this.roundOver = false;
    this.ui.showScore(this.level.name, 0, this.round.length);
    this.presentWord();
  }

  private abandonRound(): void {
    this.roundOver = true;
    this.stopPlay();
    this.ui.clearWord();
    this.ui.hideSummary();
    this.ui.showChooser();
  }

  private tapAt(x: number, y: number): void {
    if (this.flying || this.roundOver || !this.wordInPlay) return;
    const hit = this.salmonUnder(x, y);
    if (hit === undefined) return;
    this.strike(hit);
  }

  /** Nearest of whatever the tap covered, so two overlapping fish cannot both claim it. */
  private salmonUnder(x: number, y: number): Salmon | undefined {
    const time = this.time.now;
    let best: Salmon | undefined;
    let bestDistance = Infinity;
    for (const salmon of this.salmon) {
      if (!containsPoint(salmon, time, x, y, TUNING.tapPadding)) continue;
      const at = positionAt(salmon, time);
      const distance = Math.hypot(at.x - x, at.y - y);
      if (distance >= bestDistance) continue;
      bestDistance = distance;
      best = salmon;
    }
    return best;
  }

  private strike(salmon: Salmon): void {
    this.salmon = this.salmon.filter((other) => other !== salmon);
    this.targeted = salmon;
    const aim = interceptPoint(salmon, this.eagle.x, this.eagle.y, this.time.now);
    this.flyTo(Math.max(aim.x, LANE_MIN_X), aim.y, aim.flightMs, () => {
      // A round can end mid-flight, taking the fish with it.
      if (this.targeted !== salmon) return;
      this.targeted = null;
      if (salmon.choice.correct) this.catchCorrect(salmon);
      else this.catchWrong(salmon);
    });
  }

  private flyTo(x: number, y: number, durationMs: number, onArrive: () => void): void {
    this.flying = true;
    this.faceTowards(x);
    this.tweens.add({
      targets: this.eagle,
      x,
      y,
      duration: durationMs,
      ease: "Quad.easeIn",
      onComplete: () => {
        onArrive();
        this.returnToPerch();
      },
    });
  }

  private returnToPerch(): void {
    const x = Phaser.Math.Clamp(this.eagle.x, EAGLE_MARGIN_X, WIDTH - EAGLE_MARGIN_X);
    this.faceTowards(x);
    this.tweens.add({
      targets: this.eagle,
      x,
      y: EAGLE_PERCH_Y,
      duration: TUNING.eagleReturnMs,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.flying = false;
      },
    });
  }

  /** The art faces right, so flying left means mirroring it. */
  private faceTowards(x: number): void {
    if (x === this.eagle.x) return;
    this.eagle.scaleX = x < this.eagle.x ? -1 : 1;
  }

  private get currentWord(): RoundWord | undefined {
    return this.round[this.index];
  }

  private hideOrca(): void {
    this.tweens.killTweensOf(this.orca);
    this.orca.y = ORCA_HIDDEN_Y;
    this.orca.x = ORCA_ENTRY_X;
    this.orca.angle = ORCA_TILT;
  }

  private presentWord(): void {
    if (this.currentWord === undefined) return;

    this.ui.clearWord();
    this.hideOrca();

    this.tweens.add({
      targets: this.orca,
      y: ORCA_PEAK_Y,
      duration: TUNING.orcaIntroMs,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.revealWord();
        this.tweens.add({
          targets: this.orca,
          y: ORCA_HIDDEN_Y,
          duration: TUNING.orcaIntroMs,
          ease: "Sine.easeIn",
        });
        this.tweens.add({
          targets: this.orca,
          x: ORCA_EXIT_X,
          duration: TUNING.orcaIntroMs,
          ease: "Linear",
        });
        this.tweens.add({
          targets: this.orca,
          angle: -ORCA_TILT,
          duration: TUNING.orcaIntroMs,
          ease: "Cubic.easeOut",
        });
      },
    });

    // Horizontal travel is even across the whole jump. Only the vertical speed
    // changes, which is what makes the path read as an arc rather than a swerve.
    this.tweens.add({
      targets: this.orca,
      x: WIDTH / 2,
      duration: TUNING.orcaIntroMs,
      ease: "Linear",
    });

    // The angle is tweened apart from the height, and lags it, because most of the
    // climb happens below the waterline. Levelling it in step with the height would
    // leave the orca flat by the time anyone can see it.
    this.tweens.add({
      targets: this.orca,
      angle: 0,
      duration: TUNING.orcaIntroMs,
      ease: "Cubic.easeIn",
    });
  }

  private revealWord(): void {
    const word = this.currentWord;
    if (word === undefined) return;
    this.ui.showWord(word.klallam);
    if (TUNING.autoPlayAudioOnReveal) playWord(word.audioUrl);
    this.startSalmonRun(word);
  }

  private startSalmonRun(word: RoundWord): void {
    this.clearSalmon();
    this.wrongThisWord = false;
    this.wrongGrabs = 0;
    this.waiting = word.choices.map((choice) =>
      createSalmon(this, choice, {
        startX: SALMON_START_X,
        laneY: SALMON_LANE_Y,
        speed: this.level.salmonSpeed,
      })
    );
    this.wordInPlay = true;
    this.runStartedAt = this.time.now;
    this.released = 0;
  }

  // Release times come from the clock rather than a frame-counted timer, so the gap
  // between fish is the level's gap even while the scene is warming up.
  private releaseDueSalmon(time: number): void {
    while (this.waiting.length > 0) {
      const due = this.runStartedAt + this.released * this.level.spawnIntervalMs;
      if (time < due) return;
      const next = this.waiting.shift();
      if (next === undefined) return;
      next.releasedAt = due;
      this.released += 1;
      this.salmon.push(next);
    }
  }

  private clearSalmon(): void {
    const all = [...this.salmon, ...this.waiting, ...this.fleeing];
    if (this.targeted !== null) all.push(this.targeted);
    for (const salmon of all) {
      this.tweens.killTweensOf(salmon.container);
      salmon.container.destroy();
    }
    this.salmon = [];
    this.waiting = [];
    this.fleeing = [];
    this.targeted = null;
    this.released = 0;
  }

  /** Everything still in the water bolts, and anything queued never arrives. */
  private scatter(): void {
    for (const salmon of this.waiting) salmon.container.destroy();
    this.waiting = [];
    this.released = 0;
    for (const salmon of this.salmon) this.flee(salmon);
    this.salmon = [];
  }

  private flee(salmon: Salmon): void {
    this.fleeing.push(salmon);
    const distance = salmon.container.x + salmon.halfWidth;
    const speed = salmon.speed * TUNING.scatterSpeedMultiplier;
    this.tweens.add({
      targets: salmon.container,
      x: -salmon.halfWidth,
      alpha: 0,
      duration: Math.max(TUNING.eagleMinFlightMs, (distance / speed) * 1000),
      ease: "Quad.easeIn",
      onComplete: () => {
        this.fleeing = this.fleeing.filter((other) => other !== salmon);
        salmon.container.destroy();
      },
    });
  }

  override update(time: number, _delta: number): void {
    if (this.wordInPlay) this.releaseDueSalmon(time);
    this.salmon = this.salmon.filter((salmon) => {
      const at = positionAt(salmon, time);
      salmon.container.setPosition(at.x, at.y);
      if (at.x + salmon.halfWidth >= 0) return true;
      salmon.container.destroy();
      return false;
    });
    if (this.targeted !== null) {
      const at = positionAt(this.targeted, time);
      this.targeted.container.setPosition(Math.max(at.x, LANE_MIN_X), at.y);
    }

    // Every salmon for this word has gone by. That was the chance to catch it.
    if (
      this.wordInPlay &&
      this.waiting.length === 0 &&
      this.salmon.length === 0 &&
      this.targeted === null
    ) {
      this.missWord();
    }
  }

  private catchCorrect(salmon: Salmon): void {
    playCatchChime();
    const burst = createCatchBurst(this, salmon.container.x, salmon.container.y);
    salmon.container.destroy();
    this.tweens.add({
      targets: burst,
      scale: 1.8,
      alpha: 0,
      angle: 90,
      duration: TUNING.celebrateMs,
      onComplete: () => burst.destroy(),
    });

    this.caught += 1;
    this.ui.showScore(this.level.name, this.caught, this.round.length);
    // A word only counts as known if nothing was caught wrongly on the way to it.
    if (this.currentWord !== undefined) {
      recordAnswer(this.currentWord.id, !this.wrongThisWord);
    }
    this.wordInPlay = false;
    this.scatter();
    this.time.delayedCall(TUNING.celebrateMs, () => this.advance());
  }

  private missWord(): void {
    this.wordInPlay = false;
    this.recordMiss();
    this.clearSalmon();
    this.advance();
  }

  private recordMiss(): void {
    const word = this.currentWord;
    if (word === undefined) return;
    this.missed.push(word);
    recordAnswer(word.id, false);
  }

  private catchWrong(salmon: Salmon): void {
    const word = this.currentWord;
    this.wrongThisWord = true;
    this.wrongGrabs += 1;
    // Gated by its own setting: hearing the word again after a miss is teaching,
    // not the same thing as the player asking for a replay.
    if (TUNING.replayAudioOnWrong && word !== undefined) playWord(word.audioUrl);

    // It wriggles free and bolts, so a wrong answer reads as a miss without relying on colour.
    this.tweens.add({
      targets: salmon.container,
      angle: { from: -18, to: 18 },
      duration: TUNING.escapeMs / 6,
      yoyo: true,
      repeat: 2,
    });
    this.flee(salmon);

    if (this.wrongGrabs > this.level.retriesPerGroup) {
      this.wordInPlay = false;
      this.scatter();
      this.recordMiss();
      // The advance waits, so the shoal is seen leaving rather than blinking out.
      this.time.delayedCall(TUNING.escapeMs, () => this.advance());
    }

    if (TUNING.wrongAnswerEndsRun) this.endRound();
  }

  private advance(): void {
    this.index += 1;
    if (this.index >= this.round.length) {
      this.endRound();
      return;
    }
    this.presentWord();
  }

  private endRound(): void {
    this.roundOver = true;
    this.stopPlay();
    this.ui.clearWord();

    this.ui.showSummary(
      this.caught,
      this.round.length,
      this.missed.map((word) => ({
        klallam: word.klallam,
        english: word.english,
        audioUrl: word.audioUrl,
      })),
      this.level.name
    );

    this.onFinished(this.caught, this.round.length);
  }

  private replayWord(): void {
    const word = this.currentWord;
    if (word === undefined || !TUNING.allowAudioReplay) return;
    playWord(word.audioUrl);
  }
}

registerGame({
  id: "fishybird",
  name: "FishyBird",
  icon: "fish",
  layout: "fullscreen",
  start(context) {
    const sheet = document.createElement("style");
    sheet.textContent = styles;
    context.root.append(sheet);

    const ui = createUi(context.root);
    const scene = new RoundScene(ui, context.words(), (caught, outOf) => {
      context.finish({ score: caught, outOf });
    });

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      // The element itself, not its name: a name is looked up on the document, which
      // cannot see inside the game's own sealed-off root.
      parent: ui.gameParent,
      width: WIDTH,
      height: HEIGHT,
      // Everything is positioned against 960 by 540 whatever the screen does, taps included.
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
      },
      scene: [scene],
    });

    return () => game.destroy(true);
  },
});
