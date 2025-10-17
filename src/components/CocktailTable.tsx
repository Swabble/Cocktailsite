import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronUp, Filter, Star } from "lucide-react";
import type { Cocktail } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ingredientsForFilter, slugify } from "@/lib/utils";

type SortKey = "Cocktail" | "Gruppe" | "Rezeptur" | "Deko" | "Glas" | "Zubereitung";
type ColumnKey = SortKey;

type ColumnFilters = Record<ColumnKey, string[]>;

const EMPTY_TOKEN = "__EMPTY__";

const createEmptyFilters = (): ColumnFilters => ({
  Cocktail: [],
  Gruppe: [],
  Rezeptur: [],
  Deko: [],
  Glas: [],
  Zubereitung: []
});

type Props = {
  cocktails: Cocktail[];
  isLoading: boolean;
  error?: Error;
  onSelect: (cocktail: Cocktail) => void;
  highlightedSlugs: string[];
  favorites: string[];
};

const columns: { key: ColumnKey; label: string }[] = [
  { key: "Gruppe", label: "Gruppe" },
  { key: "Cocktail", label: "Cocktail" },
  { key: "Rezeptur", label: "Rezeptur" },
  { key: "Deko", label: "Deko" },
  { key: "Glas", label: "Glas" },
  { key: "Zubereitung", label: "Zubereitung" }
];

const CocktailTable = ({
  cocktails,
  isLoading,
  error,
  onSelect,
  highlightedSlugs,
  favorites
}: Props) => {
  const [sortKey, setSortKey] = useState<SortKey>("Cocktail");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState<ColumnFilters>(() => createEmptyFilters());
  const [animationKey, setAnimationKey] = useState(0);
  const [expandedSlugs, setExpandedSlugs] = useState<string[]>([]);

  const highlightedSet = useMemo(
    () => new Set(highlightedSlugs.map((slug) => slug)),
    [highlightedSlugs]
  );

  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  const columnOptions = useMemo(() => {
    const optionMap: Record<ColumnKey, Set<string>> = {
      Cocktail: new Set<string>(),
      Gruppe: new Set<string>(),
      Rezeptur: new Set<string>(),
      Deko: new Set<string>(),
      Glas: new Set<string>(),
      Zubereitung: new Set<string>()
    };

    cocktails.forEach((cocktail) => {
      columns.forEach((column) => {
        if (column.key === "Rezeptur") {
          const ingredients = ingredientsForFilter(cocktail.Rezeptur);
          if (!ingredients.length) {
            optionMap.Rezeptur.add(EMPTY_TOKEN);
          } else {
            ingredients.forEach((ingredient) => optionMap.Rezeptur.add(ingredient));
          }
          return;
        }

        const raw = (cocktail[column.key as keyof Cocktail] ?? "") as string;
        const normalised = raw && raw.trim().length > 0 ? raw.trim() : EMPTY_TOKEN;
        optionMap[column.key].add(normalised);
      });
    });

    const sortValues = (values: Set<string>) =>
      Array.from(values).sort((a, b) => a.localeCompare(b));

    return {
      Cocktail: sortValues(optionMap.Cocktail),
      Gruppe: sortValues(optionMap.Gruppe),
      Rezeptur: sortValues(optionMap.Rezeptur),
      Deko: sortValues(optionMap.Deko),
      Glas: sortValues(optionMap.Glas),
      Zubereitung: sortValues(optionMap.Zubereitung)
    } satisfies Record<ColumnKey, string[]>;
  }, [cocktails]);

  const filteredByColumn = useMemo(() => {
    const activeFilters = Object.entries(filters) as [ColumnKey, string[]][];
    return cocktails.filter((cocktail) =>
      activeFilters.every(([key, selected]) => {
        if (!selected.length) return true;

        if (key === "Rezeptur") {
          const ingredients = ingredientsForFilter(cocktail.Rezeptur);
          if (!ingredients.length) {
            return selected.includes(EMPTY_TOKEN);
          }
          return selected.some((ingredient) => ingredients.includes(ingredient));
        }

        const raw = (cocktail[key as keyof Cocktail] ?? "") as string;
        const normalised = raw && raw.trim().length > 0 ? raw.trim() : EMPTY_TOKEN;
        return selected.includes(normalised);
      })
    );
  }, [cocktails, filters]);

  const sortedCocktails = useMemo(() => {
    const sorted = [...filteredByColumn].sort((a, b) => {
      const slugA = slugify(a.Cocktail);
      const slugB = slugify(b.Cocktail);
      const aHighlighted = highlightedSet.has(slugA);
      const bHighlighted = highlightedSet.has(slugB);
      if (aHighlighted !== bHighlighted) {
        return aHighlighted ? -1 : 1;
      }

      const valueA = (a[sortKey] ?? "").toString().toLowerCase();
      const valueB = (b[sortKey] ?? "").toString().toLowerCase();
      if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredByColumn, highlightedSet, sortDirection, sortKey]);

  useEffect(() => {
    setAnimationKey((previous) => previous + 1);
  }, [sortedCocktails, filters, sortKey, sortDirection]);

  useEffect(() => {
    setExpandedSlugs((previous) =>
      previous.filter((slug) =>
        sortedCocktails.some((cocktail) => slugify(cocktail.Cocktail) === slug)
      )
    );
  }, [sortedCocktails]);

  const toggleCard = useCallback((slug: string) => {
    setExpandedSlugs((previous) =>
      previous.includes(slug)
        ? previous.filter((entry) => entry !== slug)
        : [...previous, slug]
    );
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const handleFilterChange = (key: ColumnKey, values: string[]) => {
    setFilters((previous) => ({ ...previous, [key]: values }));
  };

  const resetFilters = () => setFilters(createEmptyFilters());

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center text-slate-500 shadow-soft">
        Daten werden geladen …
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center text-red-500 shadow-soft">
        Beim Laden ist ein Fehler aufgetreten: {error.message}
      </div>
    );
  }

  if (cocktails.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center text-slate-500 shadow-soft">
        Keine Cocktails gefunden.
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in-50" key={animationKey}>
      <div className="rounded-2xl bg-white p-4 shadow-soft lg:hidden">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Filter</h2>
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs">
            Zurücksetzen
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {columns.map((column) => (
            <div key={`mobile-${column.key}`} className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {column.label}
              </p>
              <FilterDropdown
                label={column.label}
                values={columnOptions[column.key]}
                selected={filters[column.key]}
                onChange={(next) => handleFilterChange(column.key, next)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-soft" data-table-container>
        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow className="cursor-default bg-slate-50/70">
                {columns.map((column) => (
                  <TableHead key={column.key} className="text-slate-700">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex items-center gap-1 text-left font-semibold"
                        onClick={() => handleSort(column.key)}
                        aria-label={`${column.label} sortieren`}
                      >
                        {column.label}
                        {sortKey === column.key && (
                          sortDirection === "asc" ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )
                        )}
                      </button>
                      <FilterDropdown
                        label={column.label}
                        values={columnOptions[column.key]}
                        selected={filters[column.key]}
                        onChange={(next) => handleFilterChange(column.key, next)}
                        compact
                      />
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCocktails.map((cocktail, index) => {
                const slug = slugify(cocktail.Cocktail);
                const isHighlighted = highlightedSet.has(slug);
                const isFavorite = favoritesSet.has(slug);
                return (
                  <TableRow
                    key={cocktail.Cocktail}
                    onClick={() => onSelect(cocktail)}
                    className={cn(
                      "cursor-pointer border-l-4 border-transparent transition-all duration-300",
                      index % 2 === 0 ? "bg-white" : "bg-slate-100",
                      "hover:bg-slate-100/90",
                      isHighlighted &&
                        "border-amber-400 bg-amber-50/80 hover:bg-amber-100 focus-visible:bg-amber-100"
                    )}
                  >
                    <TableCell className="capitalize">{cocktail.Gruppe || "–"}</TableCell>
                    <TableCell className="font-medium text-slate-900">
                      <span className="flex items-center gap-2">
                        {cocktail.Cocktail}
                        {isFavorite && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                      </span>
                    </TableCell>
                    <TableCell>{cocktail.Rezeptur}</TableCell>
                    <TableCell>{cocktail.Deko || "–"}</TableCell>
                    <TableCell>{cocktail.Glas || "–"}</TableCell>
                    <TableCell>{cocktail.Zubereitung || "–"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 p-4 lg:hidden">
          {sortedCocktails.map((cocktail) => {
            const slug = slugify(cocktail.Cocktail);
            const isHighlighted = highlightedSet.has(slug);
            const isFavorite = favoritesSet.has(slug);
            const isExpanded = expandedSlugs.includes(slug);
            const handleSelect = () => onSelect(cocktail);
            return (
              <div
                key={cocktail.Cocktail}
                className={cn(
                  "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition",
                  "hover:-translate-y-0.5 hover:shadow-md",
                  isHighlighted && "border-amber-400/80 bg-amber-50/80",
                  isFavorite && !isHighlighted && "border-amber-200"
                )}
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => toggleCard(slug)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleCard(slug);
                    }
                  }}
                  className="flex cursor-pointer flex-col gap-4 focus:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{cocktail.Cocktail}</p>
                      {cocktail.Gruppe && (
                        <p className="text-xs uppercase tracking-wide text-slate-500">{cocktail.Gruppe}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isFavorite && <Star className="h-5 w-5 fill-amber-400 text-amber-400" />}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSelect();
                        }}
                        aria-label={`Details zu ${cocktail.Cocktail} öffnen`}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm text-slate-600">
                    <Field label="Rezeptur" value={cocktail.Rezeptur} />
                    {isExpanded && (
                      <div className="space-y-3">
                        <Field label="Deko" value={cocktail.Deko || "–"} />
                        <Field label="Glas" value={cocktail.Glas || "–"} />
                        <Field label="Zubereitung" value={cocktail.Zubereitung || "–"} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p className="text-sm text-slate-700 whitespace-pre-line break-words">{value}</p>
  </div>
);

const FilterDropdown = ({
  label,
  values,
  selected,
  onChange,
  compact
}: {
  label: string;
  values: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  compact?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [horizontalOffset, setHorizontalOffset] = useState(0);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setHorizontalOffset(0);
      return;
    }

    const dropdown = dropdownRef.current;
    const container = containerRef.current?.closest("[data-table-container]") as
      | HTMLElement
      | null;
    if (!dropdown || !container) return;

    const dropdownRect = dropdown.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const padding = 12;

    let offset = 0;
    if (dropdownRect.left < containerRect.left + padding) {
      offset = containerRect.left + padding - dropdownRect.left;
    } else if (dropdownRect.right > containerRect.right - padding) {
      offset = containerRect.right - padding - dropdownRect.right;
    }

    setHorizontalOffset(offset);
  }, [open, selected, values]);

  const handleToggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value]
    );
  };

  const handleSelectAll = () => {
    onChange(values);
  };

  const handleClear = () => {
    onChange([]);
  };

  const displayValue = (value: string) => (value === EMPTY_TOKEN ? "(leer)" : value);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={cn(
          "flex items-center gap-1 rounded-full border px-2 py-1 text-xs",
          selected.length
            ? "border-amber-300 bg-amber-50 text-amber-700"
            : "border-slate-200 bg-white text-slate-500",
          compact ? "hidden lg:inline-flex" : "inline-flex w-full justify-between"
        )}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Filter className="h-3.5 w-3.5" />
        <span className={cn("truncate", compact ? "hidden" : "ml-1 text-xs font-medium")}>{label}</span>
        {selected.length > 0 && <span className="ml-auto pl-2 font-semibold">{selected.length}</span>}
      </button>
      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 z-30 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-3 shadow-soft animate-in fade-in-0 slide-in-from-top-2"
          style={{ transform: `translateX(${horizontalOffset}px)` }}
          role="listbox"
        >
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>{label}</span>
            <button
              type="button"
              className="text-emerald-600 transition hover:text-emerald-700"
              onClick={handleClear}
            >
              Zurücksetzen
            </button>
          </div>
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <button
              type="button"
              className="rounded-full px-2 py-1 transition hover:bg-slate-100"
              onClick={handleSelectAll}
            >
              Alle wählen
            </button>
            <span>{values.length} Optionen</span>
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto pr-1 text-sm">
            {values.map((value) => (
              <label key={value} className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  checked={selected.includes(value)}
                  onChange={() => handleToggle(value)}
                />
                <span>{displayValue(value)}</span>
              </label>
            ))}
            {values.length === 0 && (
              <p className="text-xs text-slate-400">Keine Werte vorhanden.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CocktailTable;
