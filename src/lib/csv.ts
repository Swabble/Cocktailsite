import Papa from "papaparse";
import type { Cocktail } from "@/types";
import { ingredientsFromRezeptur, normaliseKey, normaliseValue, slugify } from "./utils";

export const CSV_COLUMNS = ["Gruppe", "Cocktail", "Rezeptur", "Deko", "Glas", "Zubereitung"] as const;

export type ParsedCocktailCsv = {
  cocktails: Cocktail[];
  errors: string[];
  warnings: string[];
};

const sanitiseCocktailRow = (row: Record<string, string> | undefined): Cocktail | null => {
  const safeRow = row ?? {};
  const cocktail = normaliseValue(safeRow["Cocktail"] ?? "");
  const rezeptur = normaliseValue(safeRow["Rezeptur"] ?? "");

  if (!cocktail || !rezeptur) {
    return null;
  }

  return {
    Gruppe: normaliseValue(safeRow["Gruppe"] ?? safeRow["\ufeffGruppe"] ?? "") || undefined,
    Cocktail: cocktail,
    Rezeptur: rezeptur,
    Deko: normaliseValue(safeRow["Deko"] ?? "") || undefined,
    Glas: normaliseValue(safeRow["Glas"] ?? "") || undefined,
    Zubereitung: normaliseValue(safeRow["Zubereitung"] ?? "") || undefined
  };
};

export const parseCocktailCsvStrict = (text: string): ParsedCocktailCsv => {
  const trimmed = text.replace(/^\ufeff/, "");
  const parsed = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normaliseKey,
    delimiter: ";"
  });

  const errors: string[] = [];
  const warnings: string[] = [];

  if (parsed.errors.length) {
    parsed.errors.forEach((error) => {
      errors.push(`Zeile ${error.row ?? "?"}: ${error.message}`);
    });
  }

  const fields = parsed.meta.fields?.map((field) => normaliseKey(field ?? "")) ?? [];
  const missingColumns = CSV_COLUMNS.filter((column) => !fields.includes(column));
  if (missingColumns.length > 0) {
    errors.push(`Folgende Spalten fehlen: ${missingColumns.join(", ")}`);
  }

  const mapped = parsed.data
    .map((row) => sanitiseCocktailRow(row))
    .filter((row): row is Cocktail => row !== null);

  const invalidRows = parsed.data.length - mapped.length;
  if (invalidRows > 0) {
    errors.push(
      `${invalidRows} Zeile(n) enthalten keinen Wert für die Pflichtfelder "Cocktail" und "Rezeptur".`
    );
  }

  if (mapped.length === 0) {
    errors.push("Keine gültigen Cocktail-Datensätze gefunden.");
  }

  return {
    cocktails: mapped,
    errors,
    warnings
  };
};

export const parseCocktailCsv = async (text: string): Promise<Cocktail[]> => {
  const result = parseCocktailCsvStrict(text);
  if (result.errors.length) {
    console.warn("Fehler beim CSV-Parsing", result.errors);
  }
  return result.cocktails;
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
    columns: [...CSV_COLUMNS],
    delimiter: ";"
  });
};

export const createSlugMap = (cocktails: Cocktail[]): Record<string, Cocktail> => {
  return cocktails.reduce<Record<string, Cocktail>>((acc, cocktail) => {
    acc[slugify(cocktail.Cocktail)] = cocktail;
    return acc;
  }, {});
};

export const parseRezeptur = ingredientsFromRezeptur;
