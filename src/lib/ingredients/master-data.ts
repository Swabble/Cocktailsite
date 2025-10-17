import type { Cocktail } from "@/types";
import { ingredientsFromRezeptur } from "@/lib/utils";
import { normaliseText, suggest } from "./fuzzy";

export type MasterRecord = {
  name: string;
  aliases?: string[];
  popularity?: number;
};

export type MasterData = {
  units: MasterRecord[];
  ingredients: MasterRecord[];
  unitIndex: Map<string, MasterRecord>;
  ingredientIndex: Map<string, MasterRecord>;
  unitValues: string[];
  ingredientValues: string[];
};

const BASE_UNITS: MasterRecord[] = [
  { name: "cl", aliases: ["zentiliter", "centiliter", "cL", "cl."] },
  { name: "ml", aliases: ["milliliter", "millilitre", "mL", "ml."] },
  { name: "TL", aliases: ["teelöffel", "teeloeffel", "teaspoon", "tsp"] },
  { name: "EL", aliases: ["esslöffel", "essloeffel", "tablespoon", "tbsp"] },
  { name: "Dash", aliases: ["dash", "spritzer", "dashs"] },
  { name: "Prise", aliases: ["prise", "pinch"] },
  { name: "Stück", aliases: ["stück", "stücke", "piece", "pieces", "stk", "stk."] },
  { name: "Scheibe", aliases: ["scheibe", "scheiben", "slice", "slices"] },
  { name: "handvoll", aliases: ["handvoll", "hand voll", "handfull"] },
  { name: "Barlöffel", aliases: ["barlöffel", "bar loeffel", "bar spoon", "barspoon"] },
  { name: "Filler", aliases: ["auffüllen", "top up", "fill", "filler"] },
  { name: "%", aliases: ["%", "prozent", "percent"] }
];

const BASE_INGREDIENTS: MasterRecord[] = [
  { name: "Rum", aliases: ["weisser rum", "brauner rum"] },
  { name: "Bacardi" },
  { name: "Wodka", aliases: ["vodka"] },
  { name: "Gin" },
  { name: "Tequila" },
  { name: "Triple Sec", aliases: ["cointreau"] },
  { name: "Limettensaft", aliases: ["limettensaft frisch", "lime juice"] },
  { name: "Zitronensaft", aliases: ["lemon juice", "zitronensaft frisch"] },
  { name: "Zuckersirup", aliases: ["zucker sirup", "sirup"] },
  { name: "Angostura Bitters", aliases: ["angostura", "angostora"] },
  { name: "Maracuja", aliases: ["passion fruit", "maracuja nectar"] },
  { name: "Minze", aliases: ["frische minze", "mint"] },
  { name: "Eiswürfel", aliases: ["eis", "ice"] },
  { name: "Espresso" }
];

const buildIndex = (records: MasterRecord[]): Map<string, MasterRecord> => {
  const map = new Map<string, MasterRecord>();
  records.forEach((record) => {
    const baseKey = normaliseText(record.name);
    map.set(baseKey, record);
    record.aliases?.forEach((alias) => {
      map.set(normaliseText(alias), record);
    });
  });
  return map;
};

const mergeRecords = (base: MasterRecord[], dynamic: MasterRecord[]): MasterRecord[] => {
  const map = new Map<string, MasterRecord>();
  base.forEach((record) => {
    map.set(record.name, { ...record, aliases: record.aliases ? [...record.aliases] : undefined });
  });

  dynamic.forEach((record) => {
    const existing = map.get(record.name);
    if (existing) {
      const aliasSet = new Set([...(existing.aliases ?? []), ...(record.aliases ?? [])]);
      existing.aliases = Array.from(aliasSet);
      existing.popularity = Math.max(existing.popularity ?? 0, record.popularity ?? 0);
    } else {
      map.set(record.name, { ...record, aliases: record.aliases ? [...record.aliases] : undefined });
    }
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

const extractDynamicIngredients = (cocktails: Cocktail[]): MasterRecord[] => {
  const counts = new Map<string, number>();
  cocktails.forEach((cocktail) => {
    ingredientsFromRezeptur(cocktail.Rezeptur)
      .map((ingredient) => ingredient.replace(/\(.*?\)/g, "").trim())
      .filter((ingredient) => ingredient.length > 0)
      .forEach((ingredient) => {
        const key = ingredient.replace(/^\d+\s*[a-zA-Z%]+\s+/u, "").trim();
        if (!key) return;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
  });

  return Array.from(counts.entries()).map(([name, popularity]) => ({
    name,
    popularity
  }));
};

let cachedKey = "";
let cachedData: MasterData | null = null;

export const buildMasterData = (cocktails: Cocktail[]): MasterData => {
  const key = JSON.stringify(cocktails.map((cocktail) => cocktail.Cocktail));
  if (cachedData && cachedKey === key) {
    return cachedData;
  }

  const dynamicIngredients = extractDynamicIngredients(cocktails);
  const ingredients = mergeRecords(BASE_INGREDIENTS, dynamicIngredients);
  const units = mergeRecords(BASE_UNITS, []);

  const master: MasterData = {
    units,
    ingredients,
    unitIndex: buildIndex(units),
    ingredientIndex: buildIndex(ingredients),
    unitValues: units.map((unit) => unit.name),
    ingredientValues: ingredients.map((ingredient) => ingredient.name)
  };

  cachedKey = key;
  cachedData = master;
  return master;
};

export const resolveUnit = (
  raw: string,
  masterData: MasterData
): { name: string | null; status: "ok" | "fuzzy" | "new" | "missing"; suggestions: string[] } => {
  const cleaned = raw.replace(/[.,]+$/g, "");
  if (!cleaned.trim()) {
    return { name: null, status: "missing", suggestions: [] };
  }

  const normalised = normaliseText(cleaned);
  const direct = masterData.unitIndex.get(normalised);
  if (direct) {
    return { name: direct.name, status: "ok", suggestions: [] };
  }

  const alternatives = suggest(cleaned, masterData.unitValues, { minScore: 0.7 });
  if (alternatives.length) {
    return {
      name: alternatives[0].value,
      status: alternatives[0].score >= 0.85 ? "ok" : "fuzzy",
      suggestions: alternatives.map((entry) => entry.value)
    };
  }

  return { name: null, status: "new", suggestions: masterData.unitValues.slice(0, 5) };
};

export const resolveIngredient = (
  raw: string,
  masterData: MasterData
): { name: string | null; status: "ok" | "fuzzy" | "new" | "missing"; suggestions: string[] } => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { name: null, status: "missing", suggestions: [] };
  }

  const normalised = normaliseText(trimmed);
  const direct = masterData.ingredientIndex.get(normalised);
  if (direct) {
    return { name: direct.name, status: "ok", suggestions: [] };
  }

  const alternatives = suggest(trimmed, masterData.ingredientValues, { minScore: 0.6 });
  if (alternatives.length) {
    return {
      name: alternatives[0].value,
      status: alternatives[0].score >= 0.8 ? "ok" : "fuzzy",
      suggestions: alternatives.map((entry) => entry.value)
    };
  }

  return { name: null, status: "new", suggestions: masterData.ingredientValues.slice(0, 5) };
};
