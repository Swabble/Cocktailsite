import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { useCocktailContext } from "@/context/CocktailContext";
import { buildMasterData } from "@/lib/ingredients/master-data";
import {
  parseIngredientLine,
  type IngredientTokenType,
  type ParsedIngredient
} from "@/lib/ingredients/parser";

const DEBOUNCE_MS = 150;

const amountStatusMeta: Record<ParsedIngredient["statuses"]["amount"], { icon: string; label: string; tone: "muted" | "warning" | "danger" }> = {
  ok: { icon: "✅", label: "Menge ok", tone: "muted" },
  empty: { icon: "▫️", label: "Menge optional", tone: "muted" },
  ambiguous: { icon: "⚠️", label: "Menge unklar", tone: "warning" },
  invalid: { icon: "⛔", label: "Menge ungültig", tone: "danger" }
};

const entityStatusMeta: Record<"unit" | "ingredient", Record<ParsedIngredient["statuses"]["unit"], { icon: string; label: string; tone: "muted" | "warning" | "danger" }>> = {
  unit: {
    ok: { icon: "✅", label: "Einheit ok", tone: "muted" },
    fuzzy: { icon: "≈", label: "Einheit unscharf", tone: "warning" },
    new: { icon: "🆕", label: "Neue Einheit", tone: "warning" },
    missing: { icon: "⚠️", label: "Einheit fehlt", tone: "danger" }
  },
  ingredient: {
    ok: { icon: "✅", label: "Zutat ok", tone: "muted" },
    fuzzy: { icon: "≈", label: "Zutat unscharf", tone: "warning" },
    new: { icon: "🆕", label: "Neue Zutat", tone: "warning" },
    missing: { icon: "⚠️", label: "Zutat fehlt", tone: "danger" }
  }
};

type IngredientInputProps = {
  id: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
  onParsedChange?: (parsed: ParsedIngredient[]) => void;
};

const getLines = (value: string): string[] => value.split(/\r?\n/);

const sumWithNewlines = (lines: string[], index: number): number => {
  let total = 0;
  for (let i = 0; i < index; i += 1) {
    total += lines[i]?.length ?? 0;
    total += 1; // newline
  }
  return total;
};

const IngredientInput = ({ id, value, placeholder, error, onChange, onParsedChange }: IngredientInputProps) => {
  const { cocktails } = useCocktailContext();
  const masterData = useMemo(() => buildMasterData(cocktails), [cocktails]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [parsed, setParsed] = useState<ParsedIngredient[]>(() =>
    getLines(value).map((line) => parseIngredientLine(line, masterData))
  );
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [activeToken, setActiveToken] = useState<IngredientTokenType | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const lines = getLines(value);
      const next = lines.map((line) => parseIngredientLine(line, masterData));
      setParsed(next);
      onParsedChange?.(next);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [value, masterData, onParsedChange]);

  const highlighted = useMemo(() => {
    return parsed.map((entry, lineIndex) => {
      const elements: ReactNode[] = [];
      const raw = entry.raw ?? "";
      const sortedTokens = [...entry.tokens].sort((a, b) => a.start - b.start);
      let pointer = 0;

      sortedTokens.forEach((token, tokenIndex) => {
        if (pointer < token.start) {
          elements.push(
            <span key={`text-${lineIndex}-${tokenIndex}-plain`}>{raw.slice(pointer, token.start)}</span>
          );
        }

        const baseClass =
          token.type === "amount"
            ? "ingredient-token-amount"
            : token.type === "unit"
              ? "ingredient-token-unit"
              : token.type === "ingredient"
                ? "ingredient-token-ingredient"
                : "ingredient-token-notes";

        const emphasiseNew =
          (token.type === "unit" && entry.statuses.unit !== "ok") ||
          (token.type === "ingredient" && entry.statuses.ingredient !== "ok") ||
          (token.type === "amount" && entry.statuses.amount !== "ok");

        elements.push(
          <span
            key={`token-${lineIndex}-${tokenIndex}-${token.start}`}
            className={cn(baseClass, emphasiseNew && "ingredient-token-new")}
          >
            {raw.slice(token.start, token.end)}
          </span>
        );
        pointer = token.end;
      });

      if (pointer < raw.length) {
        elements.push(<span key={`text-${lineIndex}-tail`}>{raw.slice(pointer)}</span>);
      }

      if (raw.length === 0) {
        elements.push(<span key={`empty-${lineIndex}`}>&nbsp;</span>);
      }

      return (
        <Fragment key={`highlight-${lineIndex}`}>
          {elements}
          {lineIndex < parsed.length - 1 ? "\n" : null}
        </Fragment>
      );
    });
  }, [parsed]);

  const handleInternalChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const updateActiveContext = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const caret = textarea.selectionStart ?? 0;
    const lines = getLines(value);
    let offset = 0;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const start = offset;
      const end = start + line.length;
      if (caret <= end || index === lines.length - 1) {
        const relative = Math.max(0, Math.min(line.length, caret - start));
        const entry = parsed[index];
        const token = entry?.tokens.find((candidate) => relative >= candidate.start && relative <= candidate.end);
        setActiveLine(index);
        setActiveToken(token?.type ?? null);
        setShowSuggestions(Boolean(token));
        return;
      }
      offset = end + 1;
    }
    setActiveLine(null);
    setActiveToken(null);
    setShowSuggestions(false);
  }, [parsed, value]);

  const handleKeyNavigation = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      setTimeout(updateActiveContext, 0);
    }
    if (event.key === "Enter" && showSuggestions && suggestions.length > 0 && activeToken) {
      event.preventDefault();
      applySuggestion(suggestions[0]);
    }
  };

  const activeEntry = activeLine !== null ? parsed[activeLine] : undefined;
  const suggestionSource = activeToken === "unit" ? activeEntry?.suggestions.units : activeEntry?.suggestions.ingredients;
  const suggestions = suggestionSource?.slice(0, 5) ?? [];

  const applySuggestion = useCallback(
    (replacement: string) => {
      if (activeLine === null || !activeEntry || !replacement) return;
      const lines = getLines(value);
      const currentLine = lines[activeLine] ?? "";
      const tokens = activeEntry.tokens.filter((token) => token.type === activeToken);
      const target = tokens[0];
      let nextLine = currentLine;

      if (target) {
        nextLine = `${currentLine.slice(0, target.start)}${replacement}${currentLine.slice(target.end)}`;
      } else if (activeToken === "unit") {
        nextLine = `${replacement} ${currentLine}`.trim();
      } else if (activeToken === "ingredient") {
        nextLine = currentLine ? `${currentLine} ${replacement}` : replacement;
      }

      lines[activeLine] = nextLine;
      const combined = lines.join("\n");
      onChange(combined);

      window.requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const base = sumWithNewlines(lines, activeLine);
        const cursorPosition = base + (target ? target.start + replacement.length : nextLine.length);
        textarea.setSelectionRange(cursorPosition, cursorPosition);
        updateActiveContext();
      });
    },
    [activeEntry, activeLine, activeToken, onChange, updateActiveContext, value]
  );

  const newEntitiesCount = useMemo(() => {
    return parsed.reduce(
      (acc, entry) => ({
        units: acc.units + (entry.statuses.unit === "new" ? 1 : 0),
        ingredients: acc.ingredients + (entry.statuses.ingredient === "new" ? 1 : 0)
      }),
      { units: 0, ingredients: 0 }
    );
  }, [parsed]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={handleInternalChange}
          placeholder={placeholder}
          onClick={updateActiveContext}
          onKeyUp={updateActiveContext}
          onSelect={updateActiveContext}
          onFocus={updateActiveContext}
          onKeyDown={handleKeyNavigation}
          className={cn(
            "min-h-[200px] resize-y overflow-auto pr-12 text-transparent caret-slate-800 placeholder:text-slate-400",
            error ? "border-red-400 focus-visible:border-red-400" : ""
          )}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <pre
          aria-hidden="true"
          className={cn(
            "ingredient-highlight-layer pointer-events-none absolute inset-0 rounded-2xl px-3 py-2 text-sm text-transparent",
            value ? "opacity-100" : "opacity-0"
          )}
        >
          <span className="text-slate-800">{highlighted}</span>
        </pre>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-500">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        {parsed.map((entry, index) => {
          const amountMeta = amountStatusMeta[entry.statuses.amount];
          const unitMeta = entityStatusMeta.unit[entry.statuses.unit];
          const ingredientMeta = entityStatusMeta.ingredient[entry.statuses.ingredient];
          return (
            <div key={`status-${index}`} className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-600">Zeile {index + 1}</span>
                <span className="truncate text-slate-400">{entry.raw || "(leer)"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    amountMeta.tone === "warning" && "border-amber-300 text-amber-600",
                    amountMeta.tone === "danger" && "border-red-300 text-red-600"
                  )}
                >
                  <span className="mr-1" aria-hidden="true">
                    {amountMeta.icon}
                  </span>
                  {amountMeta.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    unitMeta.tone === "warning" && "border-amber-300 text-amber-600",
                    unitMeta.tone === "danger" && "border-red-300 text-red-600"
                  )}
                >
                  <span className="mr-1" aria-hidden="true">
                    {unitMeta.icon}
                  </span>
                  {unitMeta.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    ingredientMeta.tone === "warning" && "border-amber-300 text-amber-600",
                    ingredientMeta.tone === "danger" && "border-red-300 text-red-600"
                  )}
                >
                  <span className="mr-1" aria-hidden="true">
                    {ingredientMeta.icon}
                  </span>
                  {ingredientMeta.label}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>

      {showSuggestions && suggestions.length > 0 && activeToken ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-soft">
          <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Vorschläge für {activeToken === "unit" ? "Einheit" : "Zutat"}
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => applySuggestion(suggestion)}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                >
                  <span>{suggestion}</span>
                  <span className="text-xs text-slate-400">Enter zum Übernehmen</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(newEntitiesCount.units > 0 || newEntitiesCount.ingredients > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Es gibt {newEntitiesCount.units + newEntitiesCount.ingredients} neue Angaben.
          Bitte prüfe, ob neue Einheiten/Zutaten angelegt werden sollen.
        </div>
      )}
    </div>
  );
};

export type { ParsedIngredient };
export default IngredientInput;
