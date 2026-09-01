import { audioUrl, pickDistractors, type LexiconEntry } from "@klallam/lexicon";
import { TUNING, type Level } from "./config";
import { getMemory, type WordRecord } from "./memory";

/** Where the game serves the lexicon recordings from. See the audio plugin in vite.config.ts. */
const AUDIO_BASE = `${import.meta.env.BASE_URL}audio`;

export interface Choice {
  english: string;
  correct: boolean;
}

export interface RoundWord {
  id: string;
  klallam: string;
  english: string;
  audioUrl: string;
  choices: Choice[];
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function distractorsFor(
  entry: LexiconEntry,
  pool: readonly LexiconEntry[],
  level: Level,
  random: () => number
): string[] {
  const wanted = level.salmonPerWord - 1;
  const picked = pickDistractors({
    target: entry,
    pool,
    count: wanted,
    chance: level.phoneticDistractorChance,
    poolSize: TUNING.phoneticNeighborPool,
    random,
  });
  if (picked.length < wanted) {
    throw new Error(
      `Not enough distinct translations to fill ${level.salmonPerWord} salmon for "${entry.id}".`
    );
  }
  return picked.map((candidate) => candidate.english);
}

function restRounds(box: number): number {
  return TUNING.boxRestRounds[box - 1] ?? TUNING.boxRestRounds[TUNING.boxRestRounds.length - 1] ?? 0;
}

/** How many rounds past due a word is. Negative means it is still resting. */
function overdueBy(record: WordRecord, round: number): number {
  return round - record.lastRound - restRounds(record.box);
}

/**
 * Words due for review, most overdue first, topped up with words never seen. Ties are
 * broken by the lower box, so the shakiest words come back first.
 */
function chooseWords(
  pool: readonly LexiconEntry[],
  level: Level,
  random: () => number
): LexiconEntry[] {
  const { round, words } = getMemory();
  const unseen = shuffle(
    pool.filter((entry) => words[entry.id] === undefined),
    random
  );
  const due = pool
    .flatMap((entry) => {
      const record = words[entry.id];
      if (record === undefined) return [];
      const overdue = overdueBy(record, round);
      return overdue >= 0 ? [{ entry, record, overdue }] : [];
    })
    .sort((a, b) => b.overdue - a.overdue || a.record.box - b.record.box)
    .map((item) => item.entry);

  const chosen: LexiconEntry[] = [];
  const taken = new Set<string>();
  const take = (entries: readonly LexiconEntry[], limit: number) => {
    for (const entry of entries) {
      if (chosen.length >= limit) return;
      if (taken.has(entry.id)) continue;
      taken.add(entry.id);
      chosen.push(entry);
    }
  };

  take(unseen, Math.min(level.newWordsPerRound, TUNING.wordsPerRound));
  take(due, TUNING.wordsPerRound);

  // Nothing is known on a first play, and on a quiet day little is due. Rather than a
  // short round, fill up with new words and then with whatever has rested longest.
  take(unseen, TUNING.wordsPerRound);
  const restedLongest = pool
    .flatMap((entry) => {
      const record = words[entry.id];
      return record === undefined ? [] : [{ entry, lastRound: record.lastRound }];
    })
    .sort((a, b) => a.lastRound - b.lastRound)
    .map((item) => item.entry);
  take(restedLongest, TUNING.wordsPerRound);

  return shuffle(chosen, random);
}

export function buildRound(
  pool: readonly LexiconEntry[],
  level: Level,
  random: () => number = Math.random
): RoundWord[] {
  const needed = Math.max(TUNING.wordsPerRound, level.salmonPerWord);
  if (pool.length < needed) {
    throw new Error(
      `A round needs ${needed} confirmed words with recordings, but only ${pool.length} are available. ` +
        "Add or confirm words in lexicon/lexicon.xlsx, then run the update-lexicon workflow."
    );
  }

  return chooseWords(pool, level, random)
    .slice(0, TUNING.wordsPerRound)
    .map((entry) => {
      const url = audioUrl(entry, AUDIO_BASE);
      if (url === null) {
        throw new Error(`Word "${entry.id}" reached the round without a recording.`);
      }
      const choices = shuffle(
        [
          { english: entry.english, correct: true },
          ...distractorsFor(entry, pool, level, random).map((english) => ({
            english,
            correct: false,
          })),
        ],
        random
      );
      return { id: entry.id, klallam: entry.klallam, english: entry.english, audioUrl: url, choices };
    });
}
