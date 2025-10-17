/**
 * Utility helpers for fuzzy matching within ingredient parsing.
 */

export const normaliseText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

export const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, (_, i) => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
};

export const similarity = (a: string, b: string): number => {
  const normalisedA = normaliseText(a);
  const normalisedB = normaliseText(b);
  if (!normalisedA.length && !normalisedB.length) return 1;
  if (!normalisedA.length || !normalisedB.length) return 0;
  const distance = levenshtein(normalisedA, normalisedB);
  const maxLength = Math.max(normalisedA.length, normalisedB.length);
  return 1 - distance / maxLength;
};

export type Suggestion = {
  value: string;
  score: number;
};

export const suggest = (
  query: string,
  values: string[],
  { limit = 5, minScore = 0.6 }: { limit?: number; minScore?: number } = {}
): Suggestion[] => {
  if (!values.length) return [];
  if (!query.trim()) {
    return values.slice(0, limit).map((value) => ({ value, score: 1 }));
  }

  return values
    .map((value) => ({ value, score: similarity(query, value) }))
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))
    .slice(0, limit);
};
