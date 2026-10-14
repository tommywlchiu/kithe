// Banned-phrase matcher. Case-insensitive; each phrase matches only as whole words, so "die"
// flags "the pup could die" but not "diary" or "diet", and "ill" does not flag "will" or
// "pillow". A phrase's words may be separated by any run of whitespace. There is no stemming:
// list every inflection explicitly (starve, starved, starving).
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const compileBannedPhrases = (phrases: readonly string[]): RegExp[] =>
  phrases.map(
    (p) =>
      new RegExp(
        `(?<![\\p{L}\\p{N}])${p.split(/\s+/).map(escapeRegExp).join('\\s+')}(?![\\p{L}\\p{N}])`,
        'iu',
      ),
  );

const compiled = new WeakMap<readonly string[], RegExp[]>();

export const findBannedPhrases = (text: string, phrases: readonly string[]): string[] => {
  let patterns = compiled.get(phrases);
  if (!patterns) {
    patterns = compileBannedPhrases(phrases);
    compiled.set(phrases, patterns);
  }
  return phrases.filter((_, i) => patterns[i]!.test(text));
};
