import type { ParsedIngredient } from "./lib/ingredients/parser";

export type Cocktail = {
  Gruppe?: string | null;
  Cocktail: string;
  Rezeptur: string;
  Deko?: string | null;
  Glas?: string | null;
  Zubereitung?: string | null;
};

export type StructuredIngredientMap = Record<string, ParsedIngredient[]>;

export type CsvVersionSource = "initial" | "upload" | "manual" | "restore";

export type CsvVersion = {
  id: string;
  label: string;
  createdAt: number;
  source: CsvVersionSource;
  cocktails: Cocktail[];
};

export type CocktailImageMap = Record<string, string>;

export type CocktailMetadataMap = Record<string, number>;

export type CocktailDataset = {
  cocktails: Cocktail[];
  images: CocktailImageMap;
  modified: CocktailMetadataMap;
  structured?: StructuredIngredientMap;
};
