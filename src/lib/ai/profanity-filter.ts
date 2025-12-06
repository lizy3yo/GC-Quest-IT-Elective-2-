/**
 * Simple profanity filter used by the chatbot API.
 * - containsProfanity(text): boolean
 * - findProfanity(text): string[]  (list of matched words)
 *
 * Implementation notes:
 * - Normalizes tokens by removing non-alphanumeric characters to catch common obfuscation like f*** or s.h.i.t
 * - Uses a small curated blacklist. This is intentionally conservative and can be extended or replaced
 *   with a more comprehensive third-party library if desired.
 */

const BAD_WORDS = [
  'fuck', 'fucker', 'fucking',
  'shit', 'shitty',
  'bitch', 'bastard', 'asshole',
  'dick', 'damn', 'cunt', 'crap',
  'prick', 'motherfucker', 'whore'
];

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findProfanity(text: string | undefined | null): string[] {
  if (!text) return [];
  const matches = new Set<string>();
  const lowered = String(text).toLowerCase();

  // Check token-by-token (helps with obfuscation like f***, s.h.i.t)
  const tokens = lowered.split(/\s+/);
  for (const t of tokens) {
    const norm = normalizeToken(t);
    if (!norm) continue;
    for (const bad of BAD_WORDS) {
      if (norm.includes(bad)) {
        matches.add(bad);
      }
    }
  }

  // As a fallback, check the whole cleaned text for matches
  const cleanedWhole = normalizeToken(lowered);
  for (const bad of BAD_WORDS) {
    if (cleanedWhole.includes(bad)) matches.add(bad);
  }

  return Array.from(matches);
}

export function containsProfanity(text: string | undefined | null): boolean {
  return findProfanity(text).length > 0;
}

export default {
  containsProfanity,
  findProfanity
};
