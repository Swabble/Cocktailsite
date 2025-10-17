import { normaliseText } from "./fuzzy";
import type { MasterData } from "./master-data";
import { resolveIngredient, resolveUnit } from "./master-data";

export type IngredientTokenType = "amount" | "unit" | "ingredient" | "notes";

export type IngredientToken = {
  type: IngredientTokenType;
  start: number;
  end: number;
  text: string;
};

export type ParsedIngredient = {
  raw: string;
  amount: number | null;
  amountText: string | null;
  unit: string | null;
  unitRaw: string | null;
  ingredient: string | null;
  ingredientRaw: string | null;
  notes?: string | null;
  confidence: number;
  statuses: {
    amount: "ok" | "empty" | "ambiguous" | "invalid";
    unit: "ok" | "fuzzy" | "new" | "missing";
    ingredient: "ok" | "fuzzy" | "new" | "missing";
  };
  suggestions: {
    units: string[];
    ingredients: string[];
  };
  tokens: IngredientToken[];
};

export type IngredientSegment = {
  text: string;
  start: number;
  end: number;
};

const FRACTION_MAP: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75
};

const parseAmount = (token: string): { value: number | null; status: ParsedIngredient["statuses"]["amount"]; text: string } => {
  const trimmed = token.trim();
  if (!trimmed) {
    return { value: null, status: "empty", text: "" };
  }

  if (trimmed === "-") {
    return { value: null, status: "empty", text: "-" };
  }

  if (FRACTION_MAP[trimmed] !== undefined) {
    return { value: FRACTION_MAP[trimmed], status: "ok", text: trimmed };
  }

  if (/^\d+\/\d+$/.test(trimmed)) {
    const [a, b] = trimmed.split("/").map((part) => Number.parseFloat(part));
    if (b === 0) {
      return { value: null, status: "invalid", text: trimmed };
    }
    return { value: a / b, status: "ok", text: trimmed };
  }

  if (/^\d+[.,]\d+$/.test(trimmed)) {
    const parsed = Number.parseFloat(trimmed.replace(/,/g, "."));
    return { value: Number.isNaN(parsed) ? null : parsed, status: Number.isNaN(parsed) ? "invalid" : "ok", text: trimmed };
  }

  if (/^\d+(?:\s*%?)$/.test(trimmed)) {
    const numeric = trimmed.replace(/%/g, "");
    const parsed = Number.parseFloat(numeric);
    if (Number.isNaN(parsed)) {
      return { value: null, status: "invalid", text: trimmed };
    }
    return { value: parsed, status: trimmed.includes("%") ? "ok" : "ok", text: trimmed };
  }

  if (/^\d+\s*-\s*\d+$/.test(trimmed)) {
    return { value: null, status: "ambiguous", text: trimmed.replace(/\s+/g, "") };
  }

  if (/^\d+-\d+$/.test(trimmed)) {
    return { value: null, status: "ambiguous", text: trimmed };
  }

  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseFloat(trimmed);
    return { value: parsed, status: "ok", text: trimmed };
  }

  return { value: null, status: "invalid", text: trimmed };
};

const clampConfidence = (value: number): number => {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number.parseFloat(value.toFixed(2));
};

const stripConnector = (value: string): string => value.replace(/^(?:von|vom|mit|of)\s+/i, "");

const extractNotes = (value: string): { text: string; notes: string | null } => {
  const matches = value.match(/\(.*?\)/g);
  if (!matches) {
    return { text: value.trim(), notes: null };
  }
  const text = value.replace(/\(.*?\)/g, "").trim();
  const notes = matches.join(" ");
  return { text, notes };
};

const cleanupIngredientRaw = (value: string): string =>
  value
    .replace(/\s+,/g, ",")
    .replace(/,+$/g, "")
    .trim();

const isDecimalComma = (value: string, index: number): boolean => {
  const previous = value[index - 1];
  const next = value[index + 1];
  return Boolean(previous && next && /\d/.test(previous) && /\d/.test(next) && next !== " ");
};

export const splitIngredientTuples = (value: string): IngredientSegment[] => {
  const segments: IngredientSegment[] = [];
  const length = value.length;
  let start: number | null = null;
  let depth = 0;

  const pushSegment = (rawStart: number, rawEnd: number) => {
    let segmentStart = rawStart;
    let segmentEnd = rawEnd;

    while (segmentStart < segmentEnd && /\s/.test(value[segmentStart] ?? "")) {
      segmentStart += 1;
    }

    while (segmentEnd > segmentStart && /\s/.test(value[segmentEnd - 1] ?? "")) {
      segmentEnd -= 1;
    }

    if (segmentEnd <= segmentStart) return;
    segments.push({ text: value.slice(segmentStart, segmentEnd), start: segmentStart, end: segmentEnd });
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

const skipWhitespace = (input: string, position: number): number => {
  const match = input.slice(position).match(/^\s+/);
  if (!match) return position;
  return position + match[0].length;
};

const consumePattern = (input: string, position: number, pattern: RegExp): { match: string | null; next: number } => {
  const segment = input.slice(position);
  const match = segment.match(pattern);
  if (!match) {
    return { match: null, next: position };
  }
  return { match: match[0], next: position + match[0].length };
};

const UNIT_BOUNDARY = /^(?<word>[^\s,()]+)/;

const findUnitCandidate = (
  input: string,
  position: number,
  master: MasterData
): { text: string | null; end: number; status: "ok" | "fuzzy" | "new" | "missing"; resolved: string | null; suggestions: string[] } => {
  let currentPos = skipWhitespace(input, position);
  const firstMatch = consumePattern(input, currentPos, UNIT_BOUNDARY);
  if (!firstMatch.match) {
    return { text: null, end: currentPos, status: "missing", resolved: null, suggestions: [] };
  }

  const firstWord = firstMatch.match;
  const firstResolved = resolveUnit(firstWord, master);
  if (firstResolved.name) {
    return {
      text: firstWord,
      end: firstMatch.next,
      status: firstResolved.status,
      resolved: firstResolved.name,
      suggestions: firstResolved.suggestions
    };
  }

  const afterFirst = skipWhitespace(input, firstMatch.next);
  const secondMatch = consumePattern(input, afterFirst, UNIT_BOUNDARY);
  if (secondMatch.match) {
    const combined = `${firstWord} ${secondMatch.match}`;
    const combinedResolved = resolveUnit(combined, master);
    if (combinedResolved.name) {
      return {
        text: combined,
        end: secondMatch.next,
        status: combinedResolved.status,
        resolved: combinedResolved.name,
        suggestions: combinedResolved.suggestions
      };
    }
  }

  const fallback = resolveUnit(firstWord, master);
  return {
    text: firstWord,
    end: firstMatch.next,
    status: fallback.status,
    resolved: fallback.name,
    suggestions: fallback.suggestions
  };
};

const computeConfidence = (statuses: ParsedIngredient["statuses"]): number => {
  const amountScore = statuses.amount === "ok" ? 1 : statuses.amount === "empty" ? 0.6 : statuses.amount === "ambiguous" ? 0.4 : 0;
  const unitScore = statuses.unit === "ok" ? 1 : statuses.unit === "fuzzy" ? 0.7 : statuses.unit === "missing" ? 0.3 : 0.2;
  const ingredientScore =
    statuses.ingredient === "ok" ? 1 : statuses.ingredient === "fuzzy" ? 0.7 : statuses.ingredient === "missing" ? 0 : 0.3;
  return clampConfidence((amountScore + unitScore + ingredientScore) / 3);
};

export const parseIngredientLine = (line: string, masterData: MasterData): ParsedIngredient => {
  const raw = line;
  const tokens: IngredientToken[] = [];
  let position = 0;
  const length = raw.length;

  position = skipWhitespace(raw, position);
  const remaining = raw.slice(position);

  if (!remaining.trim()) {
    return {
      raw,
      amount: null,
      amountText: null,
      unit: null,
      unitRaw: null,
      ingredient: null,
      ingredientRaw: null,
      notes: null,
      confidence: 0,
      statuses: {
        amount: "empty",
        unit: "missing",
        ingredient: "missing"
      },
      suggestions: {
        units: [],
        ingredients: []
      },
      tokens
    };
  }

  const percentMatch = raw.slice(position).match(/^(\d{1,3})\s*%/);
  let amount: number | null = null;
  let amountText: string | null = null;
  let amountStatus: ParsedIngredient["statuses"]["amount"] = "empty";
  let unit: string | null = null;
  let unitRaw: string | null = null;
  let unitStatus: ParsedIngredient["statuses"]["unit"] = "missing";
  let unitSuggestions: string[] = [];
  let ingredient: string | null = null;
  let ingredientRaw: string | null = null;
  let ingredientStatus: ParsedIngredient["statuses"]["ingredient"] = "missing";
  let ingredientSuggestions: string[] = [];
  let notes: string | null = null;

  if (percentMatch) {
    const [matched] = percentMatch;
    amountText = matched.trim().replace(/\s+/g, "");
    amount = Number.parseFloat(percentMatch[1]);
    amountStatus = Number.isNaN(amount) ? "invalid" : "ok";
    const start = position;
    const end = position + matched.length;
    tokens.push({ type: "amount", start, end, text: raw.slice(start, end) });
    position = skipWhitespace(raw, end);

    const fillerMatch = raw.slice(position).match(/^filler\b/i);
    if (fillerMatch) {
      const fillerText = fillerMatch[0];
      unit = "Filler";
      unitRaw = fillerText;
      unitStatus = "ok";
      const unitStart = position;
      const unitEnd = position + fillerText.length;
      tokens.push({ type: "unit", start: unitStart, end: unitEnd, text: raw.slice(unitStart, unitEnd) });
      position = skipWhitespace(raw, unitEnd);
      const rest = raw.slice(position).trim();
      const cleanedRest = stripConnector(rest);
      const { text, notes: extractedNotes } = extractNotes(cleanedRest);
      ingredientRaw = text;
      ingredient = text || null;
      notes = extractedNotes;
      if (text) {
        const resolved = resolveIngredient(text, masterData);
        ingredient = resolved.name ?? text;
        ingredientStatus = resolved.status;
        ingredientSuggestions = resolved.suggestions;
      } else {
        ingredientStatus = "missing";
      }
      const ingredientStart = position;
      const ingredientEnd = ingredientStart + (text ? text.length : 0);
      if (text) {
        tokens.push({ type: "ingredient", start: ingredientStart, end: ingredientEnd, text });
      }
      if (notes) {
        const noteStart = raw.indexOf(notes, ingredientEnd);
        if (noteStart >= 0) {
          tokens.push({ type: "notes", start: noteStart, end: noteStart + notes.length, text: notes });
        }
      }

      const statuses = {
        amount: amountStatus,
        unit: unitStatus,
        ingredient: ingredientStatus
      } as ParsedIngredient["statuses"];

      return {
        raw,
        amount: Number.isNaN(amount) ? null : amount,
        amountText,
        unit,
        unitRaw,
        ingredient,
        ingredientRaw,
        notes,
        confidence: computeConfidence(statuses),
        statuses,
        suggestions: {
          units: unitSuggestions,
          ingredients: ingredientSuggestions
        },
        tokens
      };
    }
  }

  position = skipWhitespace(raw, position);
  const amountMatch = raw.slice(position).match(/^(?:\d+\s*-\s*\d+|\d+-\d+|\d+[.,]?\d*|\d+\/\d+|[½¼¾]|-)/);

  if (amountMatch) {
    const [matched] = amountMatch;
    const { value, status, text } = parseAmount(matched);
    amount = value;
    amountText = text;
    amountStatus = status;
    const start = position;
    const end = position + matched.length;
    tokens.push({ type: "amount", start, end, text: raw.slice(start, end) });
    position = skipWhitespace(raw, end);
  }

  position = skipWhitespace(raw, position);
  const unitCandidate = findUnitCandidate(raw, position, masterData);
  if (unitCandidate.text) {
    const start = position;
    const end = unitCandidate.end;
    unitRaw = raw.slice(start, end);
    unit = unitCandidate.resolved ?? (normaliseText(unitCandidate.text) || unitCandidate.text);
    unitStatus = unitCandidate.status;
    unitSuggestions = unitCandidate.suggestions;
    tokens.push({ type: "unit", start, end, text: unitRaw });
    position = unitCandidate.end;
  }

  position = skipWhitespace(raw, position);
  const rest = raw.slice(position);
  const cleaned = cleanupIngredientRaw(rest);
  const connectorStripped = stripConnector(cleaned);
  const { text: ingredientText, notes: extractedNotes } = extractNotes(connectorStripped);
  ingredientRaw = ingredientText;
  notes = extractedNotes;

  if (ingredientText) {
    const resolved = resolveIngredient(ingredientText, masterData);
    ingredient = resolved.name ?? ingredientText;
    ingredientStatus = resolved.status;
    ingredientSuggestions = resolved.suggestions;
    tokens.push({ type: "ingredient", start: position, end: position + ingredientText.length, text: ingredientText });
  } else {
    ingredientStatus = "missing";
  }

  if (notes) {
    const noteIndex = raw.indexOf(notes, position);
    if (noteIndex >= 0) {
      tokens.push({ type: "notes", start: noteIndex, end: noteIndex + notes.length, text: notes });
    }
  }

  if (unit && unit.toLowerCase() === "filler" && !ingredient) {
    ingredient = ingredientRaw;
  }

  const statuses: ParsedIngredient["statuses"] = {
    amount: amountStatus,
    unit: unitStatus,
    ingredient: ingredientStatus
  };

  return {
    raw,
    amount: amountStatus === "ok" ? amount : null,
    amountText,
    unit,
    unitRaw,
    ingredient,
    ingredientRaw,
    notes,
    confidence: computeConfidence(statuses),
    statuses,
    suggestions: {
      units: unitSuggestions,
      ingredients: ingredientSuggestions
    },
    tokens
  };
};
