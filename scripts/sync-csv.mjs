import { promises as fs } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import Papa from "papaparse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, "..");
const sourcePath = join(projectRoot, "Cocktail_Liste.csv");
const targetDir = join(projectRoot, "public");
const targetPath = join(targetDir, "Cocktail_Liste.csv");
const masterDataDir = join(targetDir, "master-data");
const ingredientListPath = join(masterDataDir, "ingredients.csv");
const unitListPath = join(masterDataDir, "units.csv");
const amountListPath = join(masterDataDir, "amounts.csv");
const structuredJsonPath = join(projectRoot, "server", "storage", "ingredients.json");

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9äöüß\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const FRACTION_MAP = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75
};

const BASE_UNITS = [
  { name: "cl", aliases: ["zentiliter", "centiliter", "cl.", "cL"] },
  { name: "ml", aliases: ["milliliter", "millilitre", "ml.", "mL"] },
  { name: "TL", aliases: ["teelöffel", "teeloeffel", "teaspoon", "tsp"] },
  { name: "EL", aliases: ["esslöffel", "essloeffel", "tablespoon", "tbsp"] },
  { name: "Dash", aliases: ["dash", "spritzer", "dashs"] },
  { name: "Prise", aliases: ["prise", "pinch"] },
  { name: "Stück", aliases: ["stück", "stücke", "piece", "pieces", "stk", "stk."] },
  { name: "Scheibe", aliases: ["scheibe", "scheiben", "slice", "slices"] },
  { name: "handvoll", aliases: ["handvoll", "hand voll", "handfull"] },
  { name: "Barlöffel", aliases: ["barlöffel", "bar loeffel", "bar spoon", "barspoon"] },
  { name: "Filler", aliases: ["auffüllen", "top up", "fill", "filler"] },
  { name: "%", aliases: ["prozent", "percent"] }
];

const normaliseUnitToken = (token) => token.toLowerCase().replace(/[^a-zäöüß%]/g, "");

const unitAliasMap = new Map();
BASE_UNITS.forEach((unit) => {
  unitAliasMap.set(normaliseUnitToken(unit.name), unit.name);
  (unit.aliases ?? []).forEach((alias) => {
    unitAliasMap.set(normaliseUnitToken(alias), unit.name);
  });
});

const resolveUnitAlias = (raw) => unitAliasMap.get(normaliseUnitToken(raw)) ?? null;

const trimPlaceholder = (value) => {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed === "-" ? "" : trimmed;
};

const parseAmountToken = (token) => {
  const trimmed = token.trim();
  if (!trimmed || trimmed === "-") {
    return { amount: null, amountText: null };
  }

  if (FRACTION_MAP[trimmed] !== undefined) {
    return { amount: FRACTION_MAP[trimmed], amountText: trimmed };
  }

  if (/^\d+\/\d+$/.test(trimmed)) {
    const [a, b] = trimmed.split("/").map((part) => Number.parseFloat(part));
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) {
      return { amount: null, amountText: trimmed };
    }
    return { amount: a / b, amountText: trimmed };
  }

  if (/^\d+[.,]\d+$/.test(trimmed)) {
    const parsed = Number.parseFloat(trimmed.replace(/,/g, "."));
    return { amount: Number.isNaN(parsed) ? null : parsed, amountText: trimmed };
  }

  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseFloat(trimmed);
    return { amount: Number.isNaN(parsed) ? null : parsed, amountText: trimmed };
  }

  return { amount: null, amountText: trimmed };
};

const extractNotes = (value) => {
  const matches = value.match(/\(.*?\)/g);
  if (!matches) {
    return { text: value.trim(), notes: null };
  }
  const text = value.replace(/\(.*?\)/g, "").trim();
  const notes = matches.join(" ");
  return { text, notes };
};

const isDecimalComma = (value, index) => {
  const previous = value[index - 1];
  const next = value[index + 1];
  return Boolean(previous && next && /\d/.test(previous) && /\d/.test(next) && next !== " ");
};

const splitIngredientTuples = (value) => {
  const segments = [];
  const length = value.length;
  let start = null;
  let depth = 0;

  const pushSegment = (rawStart, rawEnd) => {
    let segmentStart = rawStart;
    let segmentEnd = rawEnd;

    while (segmentStart < segmentEnd && /\s/.test(value[segmentStart] ?? "")) {
      segmentStart += 1;
    }

    while (segmentEnd > segmentStart && /\s/.test(value[segmentEnd - 1] ?? "")) {
      segmentEnd -= 1;
    }

    if (segmentEnd <= segmentStart) return;
    segments.push(value.slice(segmentStart, segmentEnd));
  };

  for (let index = 0; index <= length; index += 1) {
    const char = value[index] ?? "\n";
    const isLineBreak = char === "\n" || char === "\r" || index === length;
    const isComma = char === ",";

    if (char === "(") {
      depth += 1;
    } else if (char === ")" && depth > 0) {
      depth -= 1;
    }

    if (start === null) {
      if (!isLineBreak && (!isComma || isDecimalComma(value, index))) {
        if (!/\s/.test(char)) {
          start = index;
        }
      }
      continue;
    }

    if (isLineBreak || (isComma && !isDecimalComma(value, index) && depth === 0)) {
      pushSegment(start, index);
      start = null;
      depth = 0;
      continue;
    }
  }

  return segments;
};

const parseSegmentToStructured = (segment) => {
  const raw = segment.trim();
  if (!raw) return null;
  let rest = raw;

  const amountMatch = rest.match(/^(?:-?|\d+[.,]?\d*|\d+\/\d+|[½¼¾])/);
  let amount = null;
  let amountText = null;
  if (amountMatch) {
    const parsedAmount = parseAmountToken(amountMatch[0]);
    amount = parsedAmount.amount;
    amountText = parsedAmount.amountText;
    rest = rest.slice(amountMatch[0].length).trim();
  }

  const unitMatch = rest.match(/^([^\s,()]+(?:\s+[^\s,()]+)?)/);
  let unit = null;
  if (unitMatch) {
    const resolved = resolveUnitAlias(unitMatch[1]);
    if (resolved) {
      unit = resolved;
      rest = rest.slice(unitMatch[0].length).trim();
    }
  }

  const { text: ingredientText, notes } = extractNotes(rest);
  const ingredient = trimPlaceholder(ingredientText) || raw;

  return {
    raw,
    amount,
    amountText: trimPlaceholder(amountText) || null,
    unit: trimPlaceholder(unit) || null,
    ingredient,
    notes: trimPlaceholder(notes) || null
  };
};

const writeListCsv = async (targetPath, values) => {
  const sorted = Array.from(values).sort((a, b) => a.localeCompare(b));
  const data = sorted.length ? sorted.map((value) => ({ value })) : [{ value: "" }];
  const csv = Papa.unparse(data, { columns: ["value"], delimiter: ";" });
  await fs.writeFile(targetPath, csv, "utf8");
};

const normaliseValue = (value) => (typeof value === "string" ? value.trim() : "");

const sanitiseRow = (row = {}) => {
  const cocktail = normaliseValue(row.Cocktail ?? "");
  const rezeptur = normaliseValue(row.Rezeptur ?? "");
  if (!cocktail || !rezeptur) return null;
  return {
    Gruppe: normaliseValue(row.Gruppe ?? row["\ufeffGruppe"] ?? "") || "",
    Cocktail: cocktail,
    Rezeptur: rezeptur,
    Deko: normaliseValue(row.Deko ?? ""),
    Glas: normaliseValue(row.Glas ?? ""),
    Zubereitung: normaliseValue(row.Zubereitung ?? "")
  };
};

const parseCocktails = async (filePath) => {
  const file = await fs.readFile(filePath, "utf8");
  const trimmed = file.replace(/^\ufeff/, "");
  const parsed = Papa.parse(trimmed, {
    header: true,
    skipEmptyLines: true,
    delimiter: ";"
  });
  return parsed.data.map((row) => sanitiseRow(row)).filter((row) => row !== null);
};

const buildStructuredMap = (cocktails) => {
  const map = {};
  cocktails.forEach((cocktail) => {
    const segments = splitIngredientTuples(cocktail.Rezeptur);
    const entries = segments
      .map((segment) => parseSegmentToStructured(segment))
      .filter((entry) => entry !== null);
    if (entries.length) {
      map[slugify(cocktail.Cocktail)] = entries;
    }
  });
  return map;
};

const writeMasterData = async (structured) => {
  await fs.mkdir(masterDataDir, { recursive: true });
  const ingredients = new Set();
  const units = new Set();
  const amounts = new Set();

  Object.values(structured).forEach((entries) => {
    entries.forEach((entry) => {
      if (entry.ingredient) {
        ingredients.add(entry.ingredient);
      }
      if (entry.unit) {
        units.add(entry.unit);
      }
      if (entry.amountText) {
        amounts.add(entry.amountText);
      }
    });
  });

  await writeListCsv(ingredientListPath, ingredients);
  await writeListCsv(unitListPath, units);
  await writeListCsv(amountListPath, amounts);
};

async function main() {
  try {
    await fs.access(sourcePath);
  } catch (error) {
    console.error(`Quelle \'${sourcePath}\' wurde nicht gefunden.`);
    process.exitCode = 1;
    return;
  }

  await fs.mkdir(targetDir, { recursive: true });

  const file = await fs.readFile(sourcePath);
  await fs.writeFile(targetPath, file);

  const cocktails = await parseCocktails(sourcePath);
  const structured = buildStructuredMap(cocktails);
  await fs.mkdir(dirname(structuredJsonPath), { recursive: true });
  await fs.writeFile(structuredJsonPath, JSON.stringify(structured, null, 2), "utf8");
  await writeMasterData(structured);

  console.log(`Cocktail-Liste nach '${targetPath}' synchronisiert.`);
}

main().catch((error) => {
  console.error("Fehler beim Synchronisieren der Cocktail-Liste:", error);
  process.exitCode = 1;
});
