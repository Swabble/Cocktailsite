import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import Papa from "papaparse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const csvPath = path.join(projectRoot, "Cocktail_Liste.csv");
const databasePath = path.join(projectRoot, "server", "storage", "cocktails.db.json");

const CSV_COLUMNS = ["Gruppe", "Cocktail", "Rezeptur", "Deko", "Glas", "Zubereitung"];

const normaliseKey = (key) => key.replace(/^\ufeff/, "").trim();
const normaliseValue = (value) => (typeof value === "string" ? value.trim() : "");

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9äöüß\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const sanitiseCocktailRow = (row = {}) => {
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

const dedupeCocktails = (cocktails) => {
  const result = [];
  const lookup = new Map();

  cocktails.forEach((cocktail) => {
    if (!cocktail || typeof cocktail !== "object") return;
    const slug = slugify(cocktail.Cocktail ?? "");
    if (!slug) return;

    if (lookup.has(slug)) {
      const index = lookup.get(slug);
      result[index] = cocktail;
    } else {
      lookup.set(slug, result.length);
      result.push(cocktail);
    }
  });

  return result;
};

const parseCocktailCsvFile = async () => {
  const file = await fs.readFile(csvPath, "utf8");
  const trimmed = file.replace(/^\ufeff/, "");
  const parsed = Papa.parse(trimmed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normaliseKey,
    delimiter: ";"
  });

  const cocktails = parsed.data
    .map((row) => sanitiseCocktailRow(row))
    .filter((row) => row !== null)
    .map((row) => ({
      ...row,
      Gruppe: row.Gruppe || "",
      Deko: row.Deko || "",
      Glas: row.Glas || "",
      Zubereitung: row.Zubereitung || ""
    }));

  return dedupeCocktails(cocktails);
};

const buildState = (cocktails) => {
  const now = new Date().toISOString();
  const state = {
    cocktails: {},
    revisions: {}
  };

  cocktails.forEach((cocktail, index) => {
    const slug = slugify(cocktail.Cocktail ?? "");
    if (!slug) {
      return;
    }

    const snapshot = Object.fromEntries(
      CSV_COLUMNS.map((column) => [column, cocktail[column] ?? ""])
    );

    state.cocktails[slug] = {
      id: crypto.randomUUID(),
      slug,
      data: snapshot,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      order: index
    };

    state.revisions[slug] = [
      {
        revisionId: crypto.randomUUID(),
        timestamp: now,
        version: 1,
        operation: "import",
        snapshot
      }
    ];
  });

  return state;
};

const main = async () => {
  const cocktails = await parseCocktailCsvFile();
  const state = buildState(cocktails);
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await fs.writeFile(databasePath, JSON.stringify(state, null, 2), "utf8");
  console.log(`CSV-Datenbank mit ${cocktails.length} Cocktails erstellt.`);
};

main().catch((error) => {
  console.error("Fehler beim Erstellen der CSV-Datenbank:", error);
  process.exitCode = 1;
});
