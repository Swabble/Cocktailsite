import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useCocktailContext } from "@/context/CocktailContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CocktailTable from "@/components/CocktailTable";
import CocktailForm, { type CocktailFormResult } from "@/components/CocktailForm";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Cocktail } from "@/types";
import { cn } from "@/lib/cn";
import { slugify } from "@/lib/utils";
import CsvMenu from "@/components/CsvMenu";

const App = () => {
  const navigate = useNavigate();
  const {
    cocktails,
    filteredCocktails,
    groups,
    activeGroup,
    setActiveGroup,
    search,
    setSearch,
    isLoading,
    error,
    upsertCocktail,
    setCocktailImage,
    removeCocktailImage,
    recentlyChangedSlugs,
    favorites
  } = useCocktailContext();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(search);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput, setSearch]);

  const handleRowSelect = (cocktail: Cocktail) => {
    navigate(`/cocktail/${slugify(cocktail.Cocktail)}`);
  };

  const handleCreateNew = () => {
    setIsFormOpen(true);
  };

  const handleSubmitForm = ({ cocktail, imageData, imageChanged }: CocktailFormResult) => {
    upsertCocktail(cocktail);
    if (imageChanged) {
      const slug = slugify(cocktail.Cocktail);
      if (imageData) {
        setCocktailImage(slug, imageData);
      } else {
        removeCocktailImage(slug);
      }
    }
    setIsFormOpen(false);
  };

  const suggestions = useMemo(() => {
    const trimmed = searchInput.trim().toLowerCase();
    if (!trimmed) {
      return cocktails.slice(0, 5);
    }

    const matches = cocktails.filter((cocktail) => {
      const fields = [
        cocktail.Cocktail,
        cocktail.Rezeptur,
        cocktail.Gruppe ?? "",
        cocktail.Zubereitung ?? ""
      ]
        .join(" \u2022 ")
        .toLowerCase();
      return fields.includes(trimmed);
    });

    return matches.slice(0, 5);
  }, [cocktails, searchInput]);

  const otherGroups = useMemo(() => groups.filter((group) => group !== ""), [groups]);
  const half = Math.ceil(otherGroups.length / 2);
  const topRow = otherGroups.slice(0, half);
  const bottomRow = otherGroups.slice(half);

  const renderGroupButton = (label: string, value: string | null, extraClasses?: string) => {
    const isActive = (value === null && !activeGroup) || value === activeGroup;
    return (
      <button
        key={label}
        type="button"
        onClick={() => setActiveGroup(value)}
        className={cn(
          "group flex items-center justify-center rounded-2xl border border-transparent px-4 py-3 text-sm font-medium",
          "text-slate-600 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200",
          isActive
            ? "bg-slate-900 text-white shadow-soft"
            : "bg-white text-slate-700",
          extraClasses
        )}
        aria-pressed={isActive}
      >
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-4 pb-16 pt-10">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CsvMenu />
              <h1 className="text-3xl font-semibold text-slate-900">Cocktail Manager</h1>
            </div>
            <Button onClick={handleCreateNew} className="gap-2 self-start sm:self-auto">
              <Plus className="h-4 w-4" /> Neuer Cocktail
            </Button>
          </div>
          <div className="relative w-full">
            <Input
              placeholder="Suche nach Name, Zutaten oder Gruppe"
              aria-label="Cocktailsuche"
              className="w-full pr-10"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
            />
            <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            {isSearchFocused && suggestions.length > 0 && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
                <ul className="divide-y divide-slate-100">
                  {suggestions.map((suggestion) => (
                    <li key={`${suggestion.Cocktail}-${suggestion.Gruppe ?? ""}`}>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSearchInput(suggestion.Cocktail);
                          setSearch(suggestion.Cocktail);
                        }}
                        className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left text-sm text-slate-600 transition hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-900">{suggestion.Cocktail}</span>
                        <span className="text-xs text-slate-500">
                          {[suggestion.Gruppe, suggestion.Glas]
                            .filter(Boolean)
                            .join(" · ") || "Direkt auswählen"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <nav
          aria-label="Cocktail-Gruppen"
          className="grid gap-3 rounded-2xl bg-white p-4 shadow-soft transition-all duration-300"
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(140px,1fr)_1fr_minmax(140px,1fr)] lg:grid-rows-2">
            <div className="lg:row-span-2">{renderGroupButton("Alle", null, "h-full text-base")}</div>

            <div className="hidden lg:grid lg:grid-rows-2 lg:gap-3">
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${Math.max(topRow.length, 1)}, minmax(0, 1fr))` }}
              >
                {topRow.map((group) => renderGroupButton(group, group))}
              </div>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${Math.max(bottomRow.length, 1)}, minmax(0, 1fr))` }}
              >
                {bottomRow.map((group) => renderGroupButton(group, group))}
              </div>
            </div>

            <div className="lg:row-span-2">
              {renderGroupButton("Favoriten", "__favorites__", "h-full text-base")}
            </div>
          </div>

          <div className="flex gap-3 lg:hidden">
            <div className="w-1/2">{renderGroupButton("Alle", null, "w-full text-base py-4")}</div>
            <div className="w-1/2">{renderGroupButton("Favoriten", "__favorites__", "w-full text-base py-4")}</div>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <CocktailTable
          cocktails={filteredCocktails}
          isLoading={isLoading}
          error={error}
          onSelect={handleRowSelect}
          highlightedSlugs={recentlyChangedSlugs}
          favorites={favorites}
        />
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[88vh] w-full max-w-4xl overflow-y-auto">
          <DialogTitle>Neuer Cocktail</DialogTitle>
          <DialogDescription>
            Pflichtfelder sind mit * markiert. Zutaten bitte kommagetrennt eingeben.
          </DialogDescription>
          <CocktailForm onCancel={() => setIsFormOpen(false)} onSubmit={handleSubmitForm} />
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default App;
