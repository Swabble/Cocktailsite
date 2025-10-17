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

const ensureDirectories = async () => {
  await fs.mkdir(path.dirname(publicCsvPath), { recursive: true });
  await fs.mkdir(imagesDir, { recursive: true });
  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  await fs.mkdir(path.dirname(structuredPath), { recursive: true });

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

const cleanStructured = (structured, allowedSlugs) => {
  if (!structured || typeof structured !== "object") return {};
  return Object.fromEntries(
    Object.entries(structured)
      .filter(([slug]) => allowedSlugs.has(slug))
      .map(([slug, entries]) => [slug, Array.isArray(entries) ? entries : []])
  );
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
    const cleanedStructured = cleanStructured(structured, allowedSlugs);
    await writeStructured(cleanedStructured);

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

    if (!sanitised.length) {
      res.status(400).json({ error: "Mindestens ein Cocktail wird benötigt." });
      return;
    }

    const previous = await parseCocktailCsvFile();
    await writeCsvFiles(sanitised);

    const changed = collectChangedSlugs(previous, sanitised);
    changedSlugs.forEach((slug) => changed.add(slugify(slug)));

    const manifest = await readManifest();
    const allowedSlugs = new Set(sanitised.map((cocktail) => slugify(cocktail.Cocktail)));
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

    res.json({
      cocktails: sanitised,
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
