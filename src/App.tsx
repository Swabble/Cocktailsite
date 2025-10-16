import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useCocktailContext } from "@/context/CocktailContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CocktailTable from "@/components/CocktailTable";
import CocktailForm from "@/components/CocktailForm";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Cocktail } from "@/types";
import { cn } from "@/lib/cn";
import { slugify } from "@/lib/utils";
import CsvMenu from "@/components/CsvMenu";

const App = () => {
  const navigate = useNavigate();
  const {
    filteredCocktails,
    groups,
    activeGroup,
    setActiveGroup,
    search,
    setSearch,
    isLoading,
    error,
    upsertCocktail
  } = useCocktailContext();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCocktail, setEditingCocktail] = useState<Cocktail | null>(null);
  const [searchInput, setSearchInput] = useState(search);

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
    setEditingCocktail(null);
    setIsFormOpen(true);
  };

  const handleEditCocktail = (cocktail: Cocktail) => {
    setEditingCocktail(cocktail);
    setIsFormOpen(true);
  };

  const handleSubmitForm = (cocktail: Cocktail) => {
    upsertCocktail(cocktail);
    setIsFormOpen(false);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-4 pb-16 pt-10">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-6 rounded-2xl bg-white p-6 shadow-soft">
          <h1 className="text-3xl font-semibold text-slate-900">Cocktail Manager</h1>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
            <div className="flex w-full flex-col gap-3 md:flex-1 md:flex-row md:items-center">
              <div className="relative w-full flex-1">
                <Input
                  placeholder="Suche nach Name, Zutaten oder Gruppe"
                  aria-label="Cocktailsuche"
                  className="pr-10"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
                <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              </div>
              <Button onClick={handleCreateNew} className="gap-2">
                <Plus className="h-4 w-4" /> Neuer Cocktail
              </Button>
            </div>
            <CsvMenu />
          </div>
        </div>

        <Tabs value={activeGroup ?? "__all__"} onValueChange={(value) => setActiveGroup(value === "__all__" ? null : value)}>
          <TabsList>
            <TabsTrigger
              value="__all__"
              className="text-base font-semibold sm:row-span-2 sm:px-6 sm:py-4 sm:text-lg"
            >
              Alle
            </TabsTrigger>
            {groups.map((group) => (
              <TabsTrigger key={group} value={group} className={cn("capitalize")}>
                {group}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={activeGroup ?? "__all__"}>
            <span className="sr-only">Tabellenansicht</span>
          </TabsContent>
        </Tabs>
      </header>

      <main className="flex-1">
        <CocktailTable
          cocktails={filteredCocktails}
          isLoading={isLoading}
          error={error}
          onSelect={handleRowSelect}
          onEdit={handleEditCocktail}
        />
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogTitle>{editingCocktail ? "Cocktail bearbeiten" : "Neuer Cocktail"}</DialogTitle>
          <DialogDescription>
            Pflichtfelder sind mit * markiert. Zutaten bitte kommagetrennt eingeben.
          </DialogDescription>
          <CocktailForm
            initialValue={editingCocktail ?? undefined}
            onCancel={() => setIsFormOpen(false)}
            onSubmit={handleSubmitForm}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default App;
