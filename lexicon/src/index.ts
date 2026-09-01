import lexiconData from "../lexicon.json";
import tagsData from "../tags.json";

export { pickDistractors, phoneticDistance } from "./phonetics.mjs";

export interface LexiconEntry {
  id: string;
  /** Authoritative Klallam text. Never transform, normalize, or reformat this. */
  klallam: string;
  codepoints: string[];
  english: string;
  audio: string | null;
  image: string | null;
  tags: string[];
  needs_review: boolean;
  review_reasons: string[];
}

export interface Lexicon {
  version: number;
  source: string;
  entries: LexiconEntry[];
}

/** A chapter a word may be tagged with. */
export interface Chapter {
  tag: string;
  label: string;
  order: number;
}

const lexicon = lexiconData as unknown as Lexicon;
const chapters = (tagsData as unknown as { chapters: Chapter[] }).chapters;

/** The chapters, in the order they are meant to read. */
export function getChapters(): Chapter[] {
  return [...chapters].sort((a, b) => a.order - b.order);
}

export interface WordQuery {
  requireAudio?: boolean;
  includeNeedsReview?: boolean;
  tags?: string[];
}

export function getWords(query: WordQuery = {}): LexiconEntry[] {
  const { requireAudio = false, includeNeedsReview = true, tags } = query;
  return lexicon.entries.filter((entry) => {
    if (requireAudio && !entry.audio) return false;
    if (!includeNeedsReview && entry.needs_review) return false;
    if (tags?.length && !tags.some((tag) => entry.tags.includes(tag))) return false;
    return true;
  });
}

/** Words safe to put in front of a learner: confirmed text with a recording. */
export function getPlayableWords(): LexiconEntry[] {
  return getWords({ requireAudio: true, includeNeedsReview: false });
}

export function getWordById(id: string): LexiconEntry | undefined {
  return lexicon.entries.find((entry) => entry.id === id);
}

export function audioUrl(entry: LexiconEntry, basePath = "/audio"): string | null {
  return entry.audio ? `${basePath}/${encodeURIComponent(entry.audio)}` : null;
}

export function getLexiconVersion(): number {
  return lexicon.version;
}
