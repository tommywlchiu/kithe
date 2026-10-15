/**
 * Crash reports may carry error text, and error text can carry a step count, a goal, or a
 * timestamp. Every run of digits becomes "#" before a report leaves the phone (invariant 3).
 */
export function scrubNumbers(text: string): string {
  return text.replace(/\d+(?:[.,:]\d+)*/g, '#');
}
