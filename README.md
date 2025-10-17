# Cocktail Manager

Eine moderne Single-Page-Web-App zur Verwaltung der `Cocktail_Liste.csv`. Erstellt mit React, TypeScript, Tailwind CSS und Komponenten im Stil von shadcn/ui.

## Voraussetzungen

- Node.js >= 18 (inkl. npm)
- Optional: pnpm oder yarn, wenn bevorzugt (Anleitungen verwenden npm-Befehle)
- Git, falls das Projekt aus einem Repository geklont wird

## Erstes Setup (Initialisierung)

1. Repository klonen oder Projektverzeichnis entpacken:
   ```bash
   git clone <repo-url>
   cd Cocktailsite
   ```
2. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
3. CSV-Daten prüfen:
   - Die Datei `Cocktail_Liste.csv` im Projektwurzelverzeichnis ist die maßgebliche Quelle.
   - Beim Start von `npm run dev` bzw. `npm run build` wird die Datei automatisch nach `public/Cocktail_Liste.csv` synchronisiert.
   - Passe die CSV bei Bedarf an (UTF-8 ohne BOM, Spaltennamen wie in der Spezifikation) und starte anschließend den gewünschten Befehl erneut oder führe `npm run sync:csv` manuell aus.

## Entwicklungsbetrieb

- Lokalen Dev-Server starten (inkl. HMR):
  ```bash
  npm run dev
  ```
- Standardmäßig erreichbar unter `http://localhost:5173`.
- Änderungen an Komponenten, CSV-Importen oder Styles werden live aktualisiert.

### CSV-Aktualisierung im Entwicklungsmodus

- Passe `Cocktail_Liste.csv` im Projektwurzelverzeichnis an.
- Starte `npm run dev` neu oder führe `npm run sync:csv` aus, damit die Datei automatisch nach `public/` kopiert und der Browser mit den neuesten Daten versorgt wird.
- Änderungen an der CSV werden beim nächsten Laden der Seite ohne Browser-Caching berücksichtigt.

## Produktionsbuild & Vorschau

1. Produktionsbundle erstellen:
   ```bash
   npm run build
   ```
   Das Ergebnis landet im Verzeichnis `dist/`.
2. Lokale Vorschau des Produktionsbuilds starten:
   ```bash
   npm run preview
   ```
   Der Server lauscht standardmäßig auf `http://localhost:4173`.

## Deployment

- Kopiere den Inhalt des Ordners `dist/` auf einen beliebigen statischen Webserver (z. B. Netlify, Vercel, S3).
- Stelle sicher, dass `Cocktail_Liste.csv` im `dist/`-Verzeichnis bleibt (wird beim Build automatisch kopiert).
- Für SPA-Routing `/cocktail/:slug` ggf. Fallback-Regeln (Rewrite auf `index.html`) konfigurieren.

## Projekt aktualisieren (Dependencies & Code)

1. Änderungen aus dem Repository holen:
   ```bash
   git pull
   ```
2. Abhängigkeiten neu installieren/aktualisieren:
   ```bash
   npm install
   ```
3. Optional: Veraltete Abhängigkeiten analysieren
   ```bash
   npm outdated
   ```
4. Tests/Build prüfen:
   ```bash
   npm run build
   ```

## Nützliche npm-Skripte

| Befehl            | Beschreibung                              |
| ----------------- | ------------------------------------------ |
| `npm run dev`     | Entwicklungsserver (Vite) starten (inkl. CSV-Sync) |
| `npm run build`   | Produktionsbuild erzeugen (inkl. CSV-Sync)         |
| `npm run preview` | Produktionsbuild lokal testen                       |
| `npm run sync:csv`| CSV aus dem Projektwurzelverzeichnis nach `public/` kopieren |
| `npm run lint`    | (Falls hinzugefügt) Linting ausführen                |

## Zutaten-Parser & Stammdaten

- Der Editor analysiert das Zutatenfeld live und markiert erkannte Bestandteile farblich.
- Strukturierte Parser-Ergebnisse werden zusammen mit dem Cocktail gespeichert.
- Details zu Regeln, Stammdaten und Tests findest du in [`docs/ingredients.md`](docs/ingredients.md).

## CSV-Workflow

- **Quelle aktualisieren**: Bearbeite `Cocktail_Liste.csv` im Projektwurzelverzeichnis und synchronisiere per `npm run sync:csv` (oder automatisch über `npm run dev`/`npm run build`).
- **Neu/Bearbeiten**: Über `+ Neuer Cocktail` oder "Bearbeiten" lassen sich Datensätze ändern; sie werden im In-Memory-Status der App gehalten.
- **Backup erstellen**: Verwende bei Bedarf `npm run sync:csv`, um die aktuelle Datei erneut zu kopieren, oder entnimm die Version aus dem `public/`-Ordner.

## Fehlerbehebung

- Wenn beim CSV-Import die Spalte `﻿Gruppe` auftaucht, wird sie automatisch zu `Gruppe` normalisiert.
- Bei Problemen mit dem Dev-Server Port via `.env` Datei `VITE_PORT=<port>` setzen oder `npm run dev -- --host --port 5174` verwenden.
- Browser-Cache leeren, falls aktualisierte CSV-Daten nicht angezeigt werden.

Viel Erfolg mit dem Cocktail Manager! 🍹
