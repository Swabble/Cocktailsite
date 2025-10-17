import express from "express";
import cors from "cors";
import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";

const app = express();
const PORT = Number.parseInt(process.env.PORT ?? "3001", 10);

app.use(cors());
app.use(express.json({ limit: "20mb" }));

const rootDir = process.cwd();
const csvPath = path.join(rootDir, "Cocktail_Liste.csv");
const publicCsvPath = path.join(rootDir, "public", "Cocktail_Liste.csv");
const imagesDir = path.join(rootDir, "public", "cocktail-images");
const imageManifestPath = path.join(rootDir, "public", "cocktail-images.json");
const metadataPath = path.join(rootDir, "server", "storage", "modifications.json");
const structuredPath = path.join(rootDir, "server", "storage", "ingredients.json");
const masterDataDir = path.join(rootDir, "public", "master-data");
const ingredientListPath = path.join(masterDataDir, "ingredients.csv");
const unitListPath = path.join(masterDataDir, "units.csv");
const amountListPath = path.join(masterDataDir, "amounts.csv");

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

const cocktailsEqual = (a, b) => {
  const normalise = (value) => (value ?? "").toString().trim();
  return (
    normalise(a.Cocktail) === normalise(b.Cocktail) &&
    normalise(a.Gruppe ?? "") === normalise(b.Gruppe ?? "") &&
    normalise(a.Rezeptur) === normalise(b.Rezeptur) &&
    normalise(a.Deko ?? "") === normalise(b.Deko ?? "") &&
    normalise(a.Glas ?? "") === normalise(b.Glas ?? "") &&
    normalise(a.Zubereitung ?? "") === normalise(b.Zubereitung ?? "")
  );
};

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

const resolveUnitAlias = (raw) => {
  const normalised = normaliseUnitToken(raw);
  return unitAliasMap.get(normalised) ?? null;
};

const trimPlaceholder = (value) => {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed === "-" ? "" : trimmed;
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
    segments.push({ text: value.slice(segmentStart, segmentEnd) });
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
  const raw = segment?.text?.trim() ?? "";
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
    amountText: trimPlaceholder(amountText),
    unit: trimPlaceholder(unit),
    ingredient,
    notes: trimPlaceholder(notes) || null
  };
};

const ensureDirectories = async () => {
  await fs.mkdir(path.dirname(publicCsvPath), { recursive: true });
  await fs.mkdir(imagesDir, { recursive: true });
  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  await fs.mkdir(path.dirname(structuredPath), { recursive: true });
  await fs.mkdir(masterDataDir, { recursive: true });

  try {
    await fs.access(imageManifestPath);
  } catch {
    await fs.writeFile(imageManifestPath, JSON.stringify({}, null, 2), "utf8");
  }

  try {
    await fs.access(metadataPath);
  } catch {
    await fs.writeFile(metadataPath, JSON.stringify({}, null, 2), "utf8");
  }

  try {
    await fs.access(structuredPath);
  } catch {
    await fs.writeFile(structuredPath, JSON.stringify({}, null, 2), "utf8");
  }

  const emptyCsv = "value\n";
  const ensureCsv = async (target) => {
    try {
      await fs.access(target);
    } catch {
      await fs.writeFile(target, emptyCsv, "utf8");
    }
  };

  await ensureCsv(ingredientListPath);
  await ensureCsv(unitListPath);
  await ensureCsv(amountListPath);
};

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
    .filter((row) => row !== null);

  return cocktails.map((row) => ({
    ...row,
    Gruppe: row.Gruppe || "",
    Deko: row.Deko || "",
    Glas: row.Glas || "",
    Zubereitung: row.Zubereitung || ""
  }));
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

const serialiseCocktailsToCsv = (cocktails) => {
  const data = cocktails.map((cocktail) => ({
    Gruppe: normaliseValue(cocktail.Gruppe ?? ""),
    Cocktail: normaliseValue(cocktail.Cocktail ?? ""),
    Rezeptur: normaliseValue(cocktail.Rezeptur ?? ""),
    Deko: normaliseValue(cocktail.Deko ?? ""),
    Glas: normaliseValue(cocktail.Glas ?? ""),
    Zubereitung: normaliseValue(cocktail.Zubereitung ?? "")
  }));

  return Papa.unparse(data, {
    columns: [...CSV_COLUMNS],
    delimiter: ";"
  });
};

const writeCsvFiles = async (cocktails) => {
  const csvString = serialiseCocktailsToCsv(cocktails);
  await fs.writeFile(csvPath, csvString, "utf8");
  await fs.writeFile(publicCsvPath, csvString, "utf8");
};

const readManifest = async () => {
  try {
    const raw = await fs.readFile(imageManifestPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeManifest = async (manifest) => {
  await fs.writeFile(imageManifestPath, JSON.stringify(manifest, null, 2), "utf8");
};

const readMetadata = async () => {
  try {
    const raw = await fs.readFile(metadataPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeMetadata = async (metadata) => {
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
};

const readStructured = async () => {
  try {
    const raw = await fs.readFile(structuredPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeStructured = async (structured) => {
  await fs.writeFile(structuredPath, JSON.stringify(structured, null, 2), "utf8");
};

const fileNameFromManifestEntry = (entry) => entry?.split("?")[0] ?? null;

const removeImageFile = async (entry) => {
  const fileName = fileNameFromManifestEntry(entry);
  if (!fileName) return;
  try {
    await fs.unlink(path.join(imagesDir, fileName));
  } catch {
    /* ignore */
  }
};

const applyImageCleanup = async (manifest, allowedSlugs) => {
  const cleaned = {};
  const removals = [];
  Object.entries(manifest).forEach(([slug, entry]) => {
    if (allowedSlugs.has(slug)) {
      cleaned[slug] = entry;
    } else {
      removals.push(entry);
    }
  });

  await Promise.all(removals.map((entry) => removeImageFile(entry)));
  if (removals.length) {
    await writeManifest(cleaned);
  }
  return cleaned;
};

const collectChangedSlugs = (previous, next) => {
  const previousMap = new Map(previous.map((cocktail) => [slugify(cocktail.Cocktail), cocktail]));
  const nextMap = new Map(next.map((cocktail) => [slugify(cocktail.Cocktail), cocktail]));
  const changed = new Set();

  nextMap.forEach((value, slug) => {
    const reference = previousMap.get(slug);
    if (!reference || !cocktailsEqual(reference, value)) {
      changed.add(slug);
    }
  });

  previousMap.forEach((_, slug) => {
    if (!nextMap.has(slug)) {
      changed.add(slug);
    }
  });

  return changed;
};

const sanitiseStructuredEntry = (entry) => {
  if (!entry || typeof entry !== "object") return null;
  const raw = trimPlaceholder(entry.raw) || "";
  const amount = typeof entry.amount === "number" && Number.isFinite(entry.amount) ? entry.amount : null;
  const amountText = trimPlaceholder(entry.amountText);
  const unit = trimPlaceholder(entry.unit);
  const ingredient = trimPlaceholder(entry.ingredient) || raw;
  const notes = trimPlaceholder(entry.notes) || null;
  if (!ingredient) return null;
  return {
    raw,
    amount,
    amountText: amountText || null,
    unit: unit || null,
    ingredient,
    notes
  };
};

const cleanStructured = (structured, allowedSlugs) => {
  if (!structured || typeof structured !== "object") return {};
  return Object.fromEntries(
    Object.entries(structured)
      .filter(([slug]) => allowedSlugs.has(slug))
      .map(([slug, entries]) => {
        if (!Array.isArray(entries)) return [slug, []];
        const sanitised = entries
          .map((entry) => sanitiseStructuredEntry(entry))
          .filter((entry) => entry !== null);
        return [slug, sanitised];
      })
  );
};

const generateStructuredFromCocktails = (cocktails) => {
  const map = {};
  cocktails.forEach((cocktail) => {
    const slug = slugify(cocktail.Cocktail);
    const segments = splitIngredientTuples(cocktail.Rezeptur);
    const entries = segments
      .map((segment) => parseSegmentToStructured(segment))
      .filter((entry) => entry !== null);
    if (entries.length) {
      map[slug] = entries;
    }
  });
  return map;
};

const writeListCsv = async (targetPath, values) => {
  const sorted = Array.from(values).sort((a, b) => a.localeCompare(b));
  const data = sorted.length ? sorted.map((value) => ({ value })) : [{ value: "" }];
  const csv = Papa.unparse(data, { columns: ["value"], delimiter: ";" });
  await fs.writeFile(targetPath, csv, "utf8");
};

const writeMasterLists = async (structured) => {
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

app.get("/api/cocktails", async (_req, res) => {
  try {
    const cocktails = await parseCocktailCsvFile();
    const manifest = await readManifest();
    const metadata = await readMetadata();
    const structured = await readStructured();
    const allowedSlugs = new Set(cocktails.map((cocktail) => slugify(cocktail.Cocktail)));

    const cleanedManifest = await applyImageCleanup(manifest, allowedSlugs);
    const cleanedMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([slug]) => allowedSlugs.has(slug))
    );
    await writeMetadata(cleanedMetadata);
    let cleanedStructured = cleanStructured(structured, allowedSlugs);
    if (Object.keys(cleanedStructured).length === 0) {
      cleanedStructured = generateStructuredFromCocktails(cocktails);
    }
    await writeStructured(cleanedStructured);
    await writeMasterLists(cleanedStructured);

    res.json({
      cocktails,
      images: cleanedManifest,
      modified: cleanedMetadata,
      structured: cleanedStructured
    });
  } catch (error) {
    console.error("Fehler beim Laden der Cocktails:", error);
    res.status(500).json({ error: "Cocktails konnten nicht geladen werden." });
  }
});

app.post("/api/cocktails", async (req, res) => {
  const { cocktails: rawCocktails, changedSlugs = [], structured: rawStructured } = req.body ?? {};

  if (!Array.isArray(rawCocktails)) {
    res.status(400).json({ error: "Feld 'cocktails' ist erforderlich." });
    return;
  }

  try {
    const sanitised = rawCocktails
      .map((row) => sanitiseCocktailRow(row))
      .filter((row) => row !== null)
      .map((row) => ({
        ...row,
        Gruppe: row.Gruppe || "",
        Deko: row.Deko || "",
        Glas: row.Glas || "",
        Zubereitung: row.Zubereitung || ""
      }));

    const deduped = dedupeCocktails(sanitised);

    if (!deduped.length) {
      res.status(400).json({ error: "Mindestens ein Cocktail wird benötigt." });
      return;
    }

    const previous = await parseCocktailCsvFile();
    await writeCsvFiles(deduped);

    const changed = collectChangedSlugs(previous, deduped);
    changedSlugs.forEach((slug) => changed.add(slugify(slug)));

    const manifest = await readManifest();
    const allowedSlugs = new Set(deduped.map((cocktail) => slugify(cocktail.Cocktail)));
    const cleanedManifest = await applyImageCleanup(manifest, allowedSlugs);

    const metadata = await readMetadata();
    const timestamp = Date.now();
    const updatedMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([slug]) => allowedSlugs.has(slug))
    );
    changed.forEach((slug) => {
      if (allowedSlugs.has(slug)) {
        updatedMetadata[slug] = timestamp;
      }
    });
    await writeMetadata(updatedMetadata);

    const structuredInput = cleanStructured(rawStructured, allowedSlugs);
    await writeStructured(structuredInput);
    await writeMasterLists(structuredInput);

    res.json({
      cocktails: deduped,
      images: cleanedManifest,
      modified: updatedMetadata,
      structured: structuredInput
    });
  } catch (error) {
    console.error("Fehler beim Speichern der Cocktails:", error);
    res.status(500).json({ error: "Cocktails konnten nicht gespeichert werden." });
  }
});

app.post("/api/cocktails/image", async (req, res) => {
  const { slug, dataUrl } = req.body ?? {};
  if (!slug || typeof slug !== "string" || !dataUrl || typeof dataUrl !== "string") {
    res.status(400).json({ error: "Slug und dataUrl werden benötigt." });
    return;
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: "Ungültiges Bildformat." });
    return;
  }

  try {
    const mimeType = match[1];
    const extension = mimeType.split("/")[1] ?? "png";
    const buffer = Buffer.from(match[2], "base64");
    const manifest = await readManifest();

    if (manifest[slug]) {
      await removeImageFile(manifest[slug]);
    }

    const fileName = `${slug}-${Date.now()}.${extension}`;
    await fs.writeFile(path.join(imagesDir, fileName), buffer);
    const publicPath = `/cocktail-images/${fileName}`;
    manifest[slug] = `${publicPath}?t=${Date.now()}`;
    await writeManifest(manifest);

    res.json({ images: manifest });
  } catch (error) {
    console.error("Fehler beim Speichern des Bildes:", error);
    res.status(500).json({ error: "Bild konnte nicht gespeichert werden." });
  }
});

app.delete("/api/cocktails/image/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!slug) {
    res.status(400).json({ error: "Slug wird benötigt." });
    return;
  }

  try {
    const manifest = await readManifest();
    if (manifest[slug]) {
      await removeImageFile(manifest[slug]);
      delete manifest[slug];
      await writeManifest(manifest);
    }

    res.json({ images: manifest });
  } catch (error) {
    console.error("Fehler beim Entfernen des Bildes:", error);
    res.status(500).json({ error: "Bild konnte nicht gelöscht werden." });
  }
});

app.post("/api/cocktails/image/rename", async (req, res) => {
  const { oldSlug, newSlug } = req.body ?? {};
  if (!oldSlug || !newSlug) {
    res.status(400).json({ error: "Alter und neuer Slug werden benötigt." });
    return;
  }

  try {
    const manifest = await readManifest();
    const entry = manifest[oldSlug];
    if (entry) {
      const fileName = fileNameFromManifestEntry(entry);
      if (fileName) {
        const extension = path.extname(fileName);
        const newFileName = `${newSlug}-${Date.now()}${extension}`;
        const oldPath = path.join(imagesDir, fileName);
        const newPath = path.join(imagesDir, newFileName);
        try {
          await fs.rename(oldPath, newPath);
        } catch {
          await fs.copyFile(oldPath, newPath);
          await fs.unlink(oldPath);
        }
        manifest[newSlug] = `/cocktail-images/${newFileName}?t=${Date.now()}`;
        delete manifest[oldSlug];
        await writeManifest(manifest);
      }
    }

    res.json({ images: manifest });
  } catch (error) {
    console.error("Fehler beim Umbenennen des Bildes:", error);
    res.status(500).json({ error: "Bild konnte nicht umbenannt werden." });
  }
});

ensureDirectories()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Cocktail-API läuft auf Port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Fehler beim Starten des Servers:", error);
    process.exit(1);
  });
