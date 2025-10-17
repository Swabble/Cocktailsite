import type { Cocktail } from "@/types";

export const normaliseKey = (key: string): string => key.replace(/^\ufeff/, "").trim();

export const normaliseValue = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9äöüß\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export const ingredientsFromRezeptur = (rezeptur: string): string[] =>
  rezeptur
    .split(/\r?\n|,/)
    .map((ingredient) => ingredient.trim())
    .filter((ingredient) => ingredient.length > 0);

const ingredientFilterNormaliser = (ingredient: string): string =>
  ingredient
    .replace(/^\d+(?:[.,]\d+)?\s*cl\s+/i, "")
    .replace(/^\d+(?:[.,]\d+)?\s*(ml|zentiliter|milliliter)\s+/i, "")
    .trim();

export const ingredientsForFilter = (rezeptur: string): string[] => {
  const normalised = ingredientsFromRezeptur(rezeptur)
    .map((ingredient) => ingredientFilterNormaliser(ingredient))
    .filter((ingredient) => ingredient.length > 0);

  return Array.from(new Set(normalised));
};

export const searchCocktails = (cocktails: Cocktail[], query: string): Cocktail[] => {
  const normalisedQuery = query.toLowerCase().trim();
  if (!normalisedQuery) return cocktails;

  const tokens = normalisedQuery.split(/\s+/).filter(Boolean);
  if (!tokens.length) return cocktails;

  return cocktails.filter((cocktail) => {
    const fields = [
      cocktail.Cocktail,
      cocktail.Rezeptur,
      cocktail.Gruppe ?? "",
      cocktail.Zubereitung ?? "",
      ...ingredientsFromRezeptur(cocktail.Rezeptur)
    ]
      .map((field) => field?.toLowerCase().replace(/\s+/g, " ") ?? "")
      .filter((field) => field.length > 0);

    if (!fields.length) return false;

    return tokens.every((token) => fields.some((field) => field.includes(token)));
  });
};

const collectUniqueValues = (
  cocktails: Cocktail[],
  accessor: (cocktail: Cocktail) => string | null | undefined
): string[] => {
  const values = new Set<string>();
  cocktails.forEach((cocktail) => {
    const value = accessor(cocktail)?.trim();
    if (value) {
      values.add(value);
    }
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b));
};

export const getUniqueGroups = (cocktails: Cocktail[]): string[] =>
  collectUniqueValues(cocktails, (cocktail) => cocktail.Gruppe);

export const getUniqueDecorations = (cocktails: Cocktail[]): string[] =>
  collectUniqueValues(cocktails, (cocktail) => cocktail.Deko);

export const getUniqueGlasses = (cocktails: Cocktail[]): string[] =>
  collectUniqueValues(cocktails, (cocktail) => cocktail.Glas);

export const cocktailsEqual = (a: Cocktail, b: Cocktail): boolean => {
  const normalise = (value: string | null | undefined) => value?.trim() ?? "";
  return (
    normalise(a.Cocktail) === normalise(b.Cocktail) &&
    normalise(a.Gruppe ?? "") === normalise(b.Gruppe ?? "") &&
    normalise(a.Rezeptur) === normalise(b.Rezeptur) &&
    normalise(a.Deko ?? "") === normalise(b.Deko ?? "") &&
    normalise(a.Glas ?? "") === normalise(b.Glas ?? "") &&
    normalise(a.Zubereitung ?? "") === normalise(b.Zubereitung ?? "")
  );
};
