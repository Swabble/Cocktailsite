export type Cocktail = {
  Gruppe?: string | null;
  Cocktail: string;
  Rezeptur: string;
  Deko?: string | null;
  Glas?: string | null;
  Zubereitung?: string | null;
};

export type CsvVersionSource = "initial" | "upload" | "manual" | "restore";

export type CsvVersion = {
  id: string;
  label: string;
  createdAt: number;
  source: CsvVersionSource;
  cocktails: Cocktail[];
};

export type CocktailImageMap = Record<string, string>;
