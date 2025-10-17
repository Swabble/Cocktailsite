# Zutaten-Parser

Dieser Überblick beschreibt den Live-Parser für das Zutatenfeld des Cocktail-Editors.

## Eingabeformat

- **Eine Zutat pro Zeile.** Beispiele:
  - `2 cl Bacardi`
  - `1 Dash Angostora`
  - `Filler Maracuja`
  - `50% Filler maracuja`
  - `- handvoll Minze`
  - `½ EL Limettensaft (frisch)`
- Mengenangaben (inkl. Brüche, Bereiche oder `-` als Platzhalter) werden automatisch erkannt.
- Maßeinheiten werden anhand der Stammdaten normalisiert (z. B. `cl`, `ml`, `Dash`, `Filler`).
- Zutaten-Namen werden gegen vorhandene Stammdaten sowie Aliasse abgeglichen.
- Notizen in Klammern werden gesondert gespeichert.

## Visualisierung & Status

- Menge = blau, Einheit = grün, Zutat = violett, Notizen = orange.
- Unklare oder neue Angaben erhalten einen roten, gestrichelten Unterstrich.
- Rechts neben jeder Zeile erscheinen Badges:
  - `✅` alles ok
  - `≈` fuzzy/unscharf
  - `🆕` unbekannter Eintrag
  - `⚠️` unvollständige/mehrdeutige Angaben

## Vorschläge & Autovervollständigung

- Bei Fokus auf Einheit oder Zutat werden Vorschläge aus den Stammdaten eingeblendet.
- Auswahl per Maus oder `Enter` (ersetzt das aktuelle Token).
- Stammdaten umfassen Einheiten, Aliasse und Zutaten aus der CSV sowie statische Basiseinträge.

## Validierung

- Speichern wird verhindert, wenn Menge ungültig oder Einheit/Zutat fehlt.
- Mehrdeutige bzw. fuzzy Treffer lösen eine Warnung aus, blockieren aber nicht.
- Strukturierte Ergebnisse (`ParsedIngredient[]`) werden beim Speichern an den Server übermittelt und versioniert.

## Stammdaten

- Quelle: `buildMasterData` (`src/lib/ingredients/master-data.ts`) kombiniert Basislisten mit CSV-Inhalten.
- Fuzzy-Matching via `similarity`/Levenshtein (`src/lib/ingredients/fuzzy.ts`).
- Persistente strukturierte Zutaten werden in `server/storage/ingredients.json` abgelegt.

## Tests

- Unit-Tests (`jest`): `src/lib/ingredients/__tests__/parser.test.ts` decken zentrale Beispiele ab.
- `npm test` ausführen, um Parserfälle zu überprüfen.

## Erweiterung

- Neue Einheiten/Aliasse in `BASE_UNITS` bzw. `BASE_INGREDIENTS` ergänzen.
- Frontend-Styling in `src/styles/ingredients.css` anpassen.
- Parser-Regeln in `src/lib/ingredients/parser.ts` erweitern.
