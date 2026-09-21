/**
 * Sort clinical guidelines by keyword score, then prefer newer years.
 */

export function recencyBoost(
  year: string,
  now: number = new Date().getFullYear(),
): number {
  const parsed = parseInt(year, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  const age = Math.max(0, now - parsed);
  if (age <= 1) return 1;
  if (age <= 3) return 0.5;
  return 0;
}

export function compareScoredGuidelines(
  a: { score: number; year: string },
  b: { score: number; year: string },
  now?: number,
): number {
  const adjA = a.score + recencyBoost(a.year, now);
  const adjB = b.score + recencyBoost(b.year, now);
  if (adjB !== adjA) return adjB - adjA;
  const yearA = parseInt(a.year, 10) || 0;
  const yearB = parseInt(b.year, 10) || 0;
  return yearB - yearA;
}
