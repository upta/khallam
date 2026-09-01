// Storage is missing in some browsers and throws outright in others. Every path here
// has a working fallback, because losing progress must never stop a game running.

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Play carries on; this much just will not be remembered.
  }
}

export interface GameStorage {
  /** Null when nothing is stored, storage is unavailable, or the value will not parse. */
  read(key: string): unknown;
  write(key: string, value: unknown): void;
  remove(key: string): void;
}

/**
 * Each game's progress sits under its own id, so two games can use the same short key
 * without colliding. The joined form is the whole storage name, which is what lets a
 * game keep the exact name it already stores under.
 */
export function storageFor(gameId: string): GameStorage {
  const fullKey = (key: string) => `${gameId}.${key}`;
  return {
    read(key) {
      const raw = readRaw(fullKey(key));
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    },
    write(key, value) {
      writeRaw(fullKey(key), JSON.stringify(value));
    },
    remove(key) {
      try {
        window.localStorage.removeItem(fullKey(key));
      } catch {
        // Nothing to do; the stale value is harmless.
      }
    },
  };
}

const POINTS_KEY = "klallam.points.v1";

export function getPoints(): number {
  const raw = readRaw(POINTS_KEY);
  if (raw === null) return 0;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

/** Points are site-wide, so a learner sees one total however many games earned it. */
export function awardPoints(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return getPoints();
  const total = getPoints() + Math.trunc(points);
  writeRaw(POINTS_KEY, String(total));
  return total;
}
