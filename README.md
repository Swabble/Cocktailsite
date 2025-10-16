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
   - Die Datei `Cocktail_Liste.csv` liegt sowohl im Projektwurzelverzeichnis als auch unter `public/` für den direkten Browserzugriff.
   - Passe die CSV bei Bedarf an (UTF-8 ohne BOM, Spaltennamen wie in der Spezifikation).

## Entwicklungsbetrieb

- Lokalen Dev-Server starten (inkl. HMR):
  ```bash
  npm run dev
  ```
- Standardmäßig erreichbar unter `http://localhost:5173`.
- Änderungen an Komponenten, CSV-Importen oder Styles werden live aktualisiert.

### CSV-Aktualisierung im Entwicklungsmodus

- Datei `public/Cocktail_Liste.csv` anpassen oder über die UI neue Cocktails anlegen.
- Über die Buttons "Import CSV" oder "Export CSV" können Daten im Browser ausgetauscht werden.
- Exportierte Dateien können zurück nach `public/Cocktail_Liste.csv` kopiert werden, um sie als neuen Ausgangsstand zu verwenden.

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
| `npm run dev`     | Entwicklungsserver (Vite) starten          |
| `npm run build`   | Produktionsbuild erzeugen                  |
| `npm run preview` | Produktionsbuild lokal testen              |
| `npm run lint`    | (Falls hinzugefügt) Linting ausführen      |

## CSV-Import/Export-Workflow

- **Import**: Über den Button "Import CSV" eine kompatible CSV-Datei auswählen; der aktuelle In-Memory-Status wird ersetzt.
- **Export**: Button "Export CSV" herunterladen; Datei enthält dieselben Spaltenüberschriften und kann als Backup dienen.
- **Neu/Bearbeiten**: Über `+ Neuer Cocktail` oder "Bearbeiten" lassen sich Datensätze ändern. Änderungen wirken sich sofort auf den Export aus.

## Fehlerbehebung

- Wenn beim CSV-Import die Spalte `﻿Gruppe` auftaucht, wird sie automatisch zu `Gruppe` normalisiert.
- Bei Problemen mit dem Dev-Server Port via `.env` Datei `VITE_PORT=<port>` setzen oder `npm run dev -- --host --port 5174` verwenden.
- Browser-Cache leeren, falls aktualisierte CSV-Daten nicht angezeigt werden.

Viel Erfolg mit dem Cocktail Manager! 🍹
