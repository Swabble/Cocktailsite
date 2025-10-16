import Papa from "papaparse";
import type { Cocktail } from "@/types";
import { ingredientsFromRezeptur, normaliseKey, normaliseValue, slugify } from "./utils";

const CSV_COLUMNS = ["Gruppe", "Cocktail", "Rezeptur", "Deko", "Glas", "Zubereitung"] as const;

export const parseCocktailCsv = async (text: string): Promise<Cocktail[]> => {
  const trimmed = text.replace(/^\ufeff/, "");
  const parsed = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normaliseKey
  });

  if (parsed.errors.length) {
    console.warn("Fehler beim CSV-Parsing", parsed.errors);
  }

  const records: Cocktail[] = parsed.data.map((row) => {
    const safeRow = row ?? {};
    return {
      Gruppe: normaliseValue(safeRow["Gruppe"] ?? safeRow["\ufeffGruppe"] ?? "") || undefined,
      Cocktail: normaliseValue(safeRow["Cocktail"] ?? ""),
      Rezeptur: normaliseValue(safeRow["Rezeptur"] ?? ""),
      Deko: normaliseValue(safeRow["Deko"] ?? "") || undefined,
      Glas: normaliseValue(safeRow["Glas"] ?? "") || undefined,
      Zubereitung: normaliseValue(safeRow["Zubereitung"] ?? "") || undefined
    };
  });

  return records.filter((record) => record.Cocktail && record.Rezeptur);
};

export const serialiseCocktailsToCsv = (cocktails: Cocktail[]): string => {
  const data = cocktails.map((cocktail) => ({
    Gruppe: cocktail.Gruppe ?? "",
    Cocktail: cocktail.Cocktail,
    Rezeptur: cocktail.Rezeptur,
    Deko: cocktail.Deko ?? "",
    Glas: cocktail.Glas ?? "",
    Zubereitung: cocktail.Zubereitung ?? ""
  }));

  return Papa.unparse(data, {
    columns: [...CSV_COLUMNS]
  });
};

export const createSlugMap = (cocktails: Cocktail[]): Record<string, Cocktail> => {
  return cocktails.reduce<Record<string, Cocktail>>((acc, cocktail) => {
    acc[slugify(cocktail.Cocktail)] = cocktail;
    return acc;
  }, {});
};

export const parseRezeptur = ingredientsFromRezeptur;
