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
import { HelpCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { useCocktailContext } from "@/context/CocktailContext";
import { buildMasterData } from "@/lib/ingredients/master-data";
import {
  parseIngredientLine,
  splitIngredientTuples,
  type IngredientTokenType,
  type ParsedIngredient
} from "@/lib/ingredients/parser";

const DEBOUNCE_MS = 150;

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
  const { cocktails, structuredIngredients } = useCocktailContext();
  const masterData = useMemo(() => buildMasterData(cocktails, structuredIngredients), [cocktails, structuredIngredients]);
  const segments = useMemo(() => splitIngredientTuples(value), [value]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [parsed, setParsed] = useState<ParsedIngredient[]>(() =>
    segments.map((segment) => parseIngredientLine(segment.text, masterData))
  );
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const [activeToken, setActiveToken] = useState<IngredientTokenType | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showSyntax, setShowSyntax] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = segments.map((segment) => parseIngredientLine(segment.text, masterData));
      setParsed(next);
      onParsedChange?.(next);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [segments, masterData, onParsedChange]);

  const highlighted = useMemo(() => {
    const nodes: ReactNode[] = [];
    let pointer = 0;

    segments.forEach((segment, index) => {
      if (pointer < segment.start) {
        nodes.push(<span key={`gap-${index}`}>{value.slice(pointer, segment.start)}</span>);
      }

      const entry = parsed[index];
      const raw = entry?.raw ?? segment.text ?? "";
      const sortedTokens = entry ? [...entry.tokens].sort((a, b) => a.start - b.start) : [];
      let localPointer = 0;
      const segmentNodes: ReactNode[] = [];

      sortedTokens.forEach((token, tokenIndex) => {
        if (localPointer < token.start) {
          segmentNodes.push(
            <span key={`segment-${index}-plain-${tokenIndex}`}>{raw.slice(localPointer, token.start)}</span>
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
          (token.type === "unit" && entry?.statuses.unit !== "ok") ||
          (token.type === "ingredient" && entry?.statuses.ingredient !== "ok") ||
          (token.type === "amount" && entry?.statuses.amount !== "ok");

        segmentNodes.push(
          <span
            key={`segment-${index}-token-${tokenIndex}-${token.start}`}
            className={cn(baseClass, emphasiseNew && "ingredient-token-new")}
          >
            {raw.slice(token.start, token.end)}
          </span>
        );
        localPointer = token.end;
      });

      if (localPointer < raw.length) {
        segmentNodes.push(<span key={`segment-${index}-tail`}>{raw.slice(localPointer)}</span>);
      }

      if (segmentNodes.length === 0) {
        segmentNodes.push(<span key={`segment-${index}-empty`}>&nbsp;</span>);
      }

      nodes.push(<Fragment key={`segment-${index}`}>{segmentNodes}</Fragment>);
      pointer = segment.end;
    });

    if (pointer < value.length) {
      nodes.push(<span key="tail-text">{value.slice(pointer)}</span>);
    }

    if (nodes.length === 0) {
      nodes.push(<span key="empty">&nbsp;</span>);
    }

    return nodes;
  }, [parsed, segments, value]);

  const updateActiveContext = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const caret = textarea.selectionStart ?? 0;

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (caret >= segment.start && caret <= segment.end) {
        const entry = parsed[index];
        const relative = Math.max(0, Math.min(segment.text.length, caret - segment.start));
        const token = entry?.tokens.find((candidate) => relative >= candidate.start && relative <= candidate.end);
        setActiveSegment(index);
        setActiveToken(token?.type ?? null);
        return;
      }
    }

    setActiveSegment(null);
    setActiveToken(null);
  }, [parsed, segments]);

  const handleInternalChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const activeEntry = activeSegment !== null ? parsed[activeSegment] : undefined;
  const suggestionSource =
    activeToken === "unit" ? activeEntry?.suggestions.units : activeEntry?.suggestions.ingredients;
  const suggestions = suggestionSource?.slice(0, 2) ?? [];

  const applySuggestion = useCallback(
    (replacement: string) => {
      if (activeSegment === null || !activeEntry || !replacement) return;
      const segment = segments[activeSegment];
      if (!segment) return;

      const tokens = activeEntry.tokens.filter((token) => token.type === activeToken);
      const target = tokens[0];
      let nextValue = value;
      let caretPosition = segment.start;

      if (target) {
        const absoluteStart = segment.start + target.start;
        const absoluteEnd = segment.start + target.end;
        nextValue = `${value.slice(0, absoluteStart)}${replacement}${value.slice(absoluteEnd)}`;
        caretPosition = absoluteStart + replacement.length;
      } else if (activeToken === "unit") {
        const prefix = value.slice(0, segment.start);
        const suffix = value.slice(segment.start);
        const insert = `${replacement} `;
        nextValue = `${prefix}${insert}${suffix}`.replace(/\s{2,}/g, " ");
        caretPosition = prefix.length + insert.length;
      } else if (activeToken === "ingredient") {
        const prefix = value.slice(0, segment.end);
        const suffix = value.slice(segment.end);
        const needsSpace = prefix.length > 0 && !/\s$/.test(prefix);
        const insert = `${needsSpace ? " " : ""}${replacement}`;
        nextValue = `${prefix}${insert}${suffix}`;
        caretPosition = prefix.length + insert.length;
      }

      onChange(nextValue);

      window.requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.setSelectionRange(caretPosition, caretPosition);
          updateActiveContext();
        }
      });
    },
    [activeEntry, activeSegment, activeToken, onChange, segments, updateActiveContext, value]
  );

  const handleKeyNavigation = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      window.requestAnimationFrame(updateActiveContext);
    }

    if (event.key === "Enter" && suggestions.length > 0 && activeToken) {
      event.preventDefault();
      applySuggestion(suggestions[0]);
    }
  };

  const handleInsertTuple = useCallback(() => {
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const trimmedBefore = before.trimEnd();
    const needsSeparator =
      trimmedBefore.length > 0 && !trimmedBefore.endsWith(",") && !trimmedBefore.endsWith("\n");
    const baseSeparator = needsSeparator ? "," : "";
    const needsSpace = baseSeparator.length > 0 && !before.endsWith(" ");
    const insert = `${baseSeparator}${needsSpace ? " " : ""}`;
    const nextValue = `${before}${insert}${after}`;
    const nextCaret = caret + insert.length;

    onChange(nextValue);

    window.requestAnimationFrame(() => {
      const target = textareaRef.current;
      if (target) {
        target.setSelectionRange(nextCaret, nextCaret);
        updateActiveContext();
      }
    });
  }, [onChange, updateActiveContext, value]);

  const newEntitySummary = useMemo(
    () =>
      parsed.reduce(
        (acc, entry) => ({
          units: acc.units + (entry.statuses.unit === "new" ? 1 : 0),
          ingredients: acc.ingredients + (entry.statuses.ingredient === "new" ? 1 : 0)
        }),
        { units: 0, ingredients: 0 }
      ),
    [parsed]
  );

  const hasNewEntities = newEntitySummary.units > 0 || newEntitySummary.ingredients > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hasNewEntities ? (
          <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700 shadow-soft">
            {newEntitySummary.units + newEntitySummary.ingredients} neue Angaben erkannt
            <button
              type="button"
              onClick={handleInsertTuple}
              className="rounded-full bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-amber-500"
            >
              Kombination bestätigen
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Trenne mehrere Angaben mit Kommas oder Zeilenumbrüchen.</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleInsertTuple}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-soft hover:bg-slate-50"
          >
            + Kombination
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSyntax((previous) => !previous)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-soft hover:bg-slate-50"
              aria-label="Syntaxhilfe anzeigen"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            {showSyntax ? (
              <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-soft">
                <p className="font-semibold text-slate-700">Eingabesyntax</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Format: Menge, Maßeinheit, Zutat – getrennt durch Kommas oder Zeilenumbrüche.</li>
                  <li>Mehrteilige Zutaten sind erlaubt, bis zum nächsten Komma oder Zeilenende.</li>
                  <li>Menge oder Einheit können mit einem "-" ausgelassen werden.</li>
                  <li>Die Anzeige blendet "-" aus – nur echte Werte erscheinen.</li>
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative">
        {isFocused && suggestions.length > 0 && activeToken ? (
          <div className="pointer-events-auto absolute right-3 top-3 z-10 flex flex-wrap justify-end gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applySuggestion(suggestion)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-soft hover:bg-slate-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        <Textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={handleInternalChange}
          placeholder={placeholder}
          onClick={updateActiveContext}
          onKeyUp={updateActiveContext}
          onSelect={updateActiveContext}
          onFocus={() => {
            setIsFocused(true);
            updateActiveContext();
          }}
          onBlur={() => {
            setIsFocused(false);
            setActiveToken(null);
          }}
          onKeyDown={handleKeyNavigation}
          className={cn(
            "min-h-[200px] resize-y overflow-auto pr-16 text-transparent caret-slate-800 placeholder:text-slate-400",
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
    </div>
  );
};

export type { ParsedIngredient };
export default IngredientInput;
