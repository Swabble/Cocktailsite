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
    .split(",")
    .map((ingredient) => ingredient.trim())
    .filter((ingredient) => ingredient.length > 0);

export const searchCocktails = (cocktails: Cocktail[], query: string): Cocktail[] => {
  const normalisedQuery = query.toLowerCase().trim();
  if (!normalisedQuery) return cocktails;

  return cocktails.filter((cocktail) => {
    const fields = [
      cocktail.Cocktail,
      cocktail.Rezeptur,
      cocktail.Gruppe ?? "",
      cocktail.Zubereitung ?? ""
    ];

    return fields.some((field) =>
      field ? field.toLowerCase().replace(/\s+/g, " ").includes(normalisedQuery) : false
    );
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
