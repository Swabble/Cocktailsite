import { useMemo, useState } from "react";
import { PencilLine } from "lucide-react";
import type { Cocktail } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const ITEMS_PER_PAGE = 12;

type SortKey = "Cocktail" | "Gruppe";

type Props = {
  cocktails: Cocktail[];
  isLoading: boolean;
  error?: Error;
  onSelect: (cocktail: Cocktail) => void;
  onEdit: (cocktail: Cocktail) => void;
};

const CocktailTable = ({ cocktails, isLoading, error, onSelect, onEdit }: Props) => {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("Cocktail");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const sortedCocktails = useMemo(() => {
    const sorted = [...cocktails].sort((a, b) => {
      const valueA = (a[sortKey] ?? "").toString().toLowerCase();
      const valueB = (b[sortKey] ?? "").toString().toLowerCase();
      if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [cocktails, sortKey, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(sortedCocktails.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);

  const paginatedCocktails = sortedCocktails.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

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
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow className="cursor-default">
            <TableHead>
              <button
                type="button"
                className="flex items-center gap-1 text-left"
                onClick={() => handleSort("Gruppe")}
                aria-label="Nach Gruppe sortieren"
              >
                Gruppe
                {sortKey === "Gruppe" && <SortBadge direction={sortDirection} />}
              </button>
            </TableHead>
            <TableHead>
              <button
                type="button"
                className="flex items-center gap-1 text-left"
                onClick={() => handleSort("Cocktail")}
                aria-label="Nach Cocktail sortieren"
              >
                Cocktail
                {sortKey === "Cocktail" && <SortBadge direction={sortDirection} />}
              </button>
            </TableHead>
            <TableHead>Rezeptur</TableHead>
            <TableHead>Deko</TableHead>
            <TableHead>Glas</TableHead>
            <TableHead>Zubereitung</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedCocktails.map((cocktail) => (
            <TableRow key={cocktail.Cocktail} onClick={() => onSelect(cocktail)}>
              <TableCell className="capitalize">{cocktail.Gruppe || "–"}</TableCell>
              <TableCell className="font-medium text-slate-900">{cocktail.Cocktail}</TableCell>
              <TableCell>{cocktail.Rezeptur}</TableCell>
              <TableCell>{cocktail.Deko || "–"}</TableCell>
              <TableCell>{cocktail.Glas || "–"}</TableCell>
              <TableCell>{cocktail.Zubereitung || "–"}</TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(cocktail);
                  }}
                >
                  <PencilLine className="h-4 w-4" /> Bearbeiten
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-soft sm:flex-row">
        <span className="text-sm text-slate-500">
          Seite {currentPage} von {pageCount} · {sortedCocktails.length} Cocktails
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Zurück
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
            disabled={currentPage === pageCount}
          >
            Weiter
          </Button>
        </div>
      </div>
    </div>
  );
};

const SortBadge = ({ direction }: { direction: "asc" | "desc" }) => (
  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] uppercase text-slate-500">
    {direction === "asc" ? "auf" : "ab"}
  </span>
);

export default CocktailTable;
