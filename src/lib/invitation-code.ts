/**
 * Invitation code generation utilities.
 *
 * Generates memorable two-word hyphen-joined codes (e.g. "swift-panda") for
 * identifying invitation households. Words are fetched from an external random
 * word API so the keyspace is not bounded by any list checked into the
 * repository. Codes are lowercase, URL-safe, and unique within the database.
 */
import { sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db';
import { invitations } from '@/lib/db/schema';

export const MAX_ATTEMPTS = 10;

/**
 * Word length bounds applied after fetching from the API.
 * Filters out overly short words (e.g. "ax") and long/obscure ones
 * (e.g. "methylases", "epicardia").
 */
export const MIN_WORD_LENGTH = 3;
export const MAX_WORD_LENGTH = 8;

/**
 * Fetch this many × extra words per required word so we have enough after
 * filtering by length.
 */
const OVERSAMPLE_FACTOR = 4;

const RANDOM_WORD_API_BASE =
  process.env.RANDOM_WORD_API_URL ?? 'https://random-word-api.herokuapp.com';

/**
 * Fetches `count` random lowercase words from the word API, filtered to
 * common word lengths (MIN_WORD_LENGTH–MAX_WORD_LENGTH characters).
 *
 * Oversamples by OVERSAMPLE_FACTOR to ensure enough words survive the filter.
 *
 * @param count - Number of words to fetch.
 * @returns Array of filtered lowercase words.
 * @throws Error if the API request fails, returns an unexpected shape, or does
 *   not yield enough words after filtering.
 */
async function fetchRandomWords(count: number): Promise<string[]> {
  const url = `${RANDOM_WORD_API_BASE}/word?number=${count * OVERSAMPLE_FACTOR}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Random word API request failed: ${response.status} ${response.statusText}`,
    );
  }

  const words: unknown = await response.json();

  if (!Array.isArray(words) || words.some((w) => typeof w !== 'string')) {
    throw new Error(
      `Unexpected response shape from random word API: ${JSON.stringify(words)}`,
    );
  }

  const filtered = (words as string[])
    .map((w) => w.toLowerCase())
    .filter(
      (w) =>
        w.length >= MIN_WORD_LENGTH &&
        w.length <= MAX_WORD_LENGTH &&
        /^[a-z]+$/.test(w),
    );

  if (filtered.length < count) {
    throw new Error(
      `Word API returned too few usable words after filtering (got ${filtered.length}, need ${count}). Consider increasing OVERSAMPLE_FACTOR.`,
    );
  }

  return filtered.slice(0, count);
}

/**
 * Generates a single invitation code in the format `word-word`.
 *
 * Words are fetched from the external word API so the keyspace is unbounded.
 * The returned code is always lowercase.
 *
 * @returns A two-word hyphen-joined invitation code.
 * @throws Error if the word API request fails.
 */
export async function generateInvitationCode(): Promise<string> {
  const [firstWord, secondWord] = await fetchRandomWords(2);

  return `${firstWord}-${secondWord}`;
}

/**
 * Generates `count` invitation codes using a single API request.
 *
 * Useful when seeding many invitations at once to minimise API round-trips.
 * Words are fetched in one batch (`count × 2` words) and paired in order.
 *
 * @param count - Number of codes to generate.
 * @returns Array of two-word hyphen-joined codes.
 * @throws Error if the word API request fails.
 */
export async function generateInvitationCodeBatch(
  count: number,
): Promise<string[]> {
  const words = await fetchRandomWords(count * 2);

  return Array.from(
    { length: count },
    (_, i) => `${words[i * 2]}-${words[i * 2 + 1]}`,
  );
}

/**
 * Generates an invitation code that is unique within the database.
 *
 * Retries up to MAX_ATTEMPTS times if there is a collision. Throws if all
 * attempts are exhausted.
 *
 * @param db - Drizzle database client.
 * @returns A unique invitation code.
 * @throws Error if MAX_ATTEMPTS collision retries are all exhausted.
 */
export async function generateUniqueInvitationCode(
  db: DbClient,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = await generateInvitationCode();

    const existing = await db.query.invitations.findFirst({
      where: () => sql`${invitations.invitationCode} = ${code} COLLATE NOCASE`,
    });

    if (!existing) {
      return code;
    }
  }

  throw new Error(
    `Failed to generate a unique invitation code after ${MAX_ATTEMPTS} attempts — collision exhausted.`,
  );
}
