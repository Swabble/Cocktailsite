import { promises as fs } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, "..");
const sourcePath = join(projectRoot, "Cocktail_Liste.csv");
const targetDir = join(projectRoot, "public");
const targetPath = join(targetDir, "Cocktail_Liste.csv");

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

  console.log(`Cocktail-Liste nach '${targetPath}' synchronisiert.`);
}

main().catch((error) => {
  console.error("Fehler beim Synchronisieren der Cocktail-Liste:", error);
  process.exitCode = 1;
});
