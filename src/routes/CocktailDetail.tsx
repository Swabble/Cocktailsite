import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, PencilLine, Trash2 } from "lucide-react";
import { useCocktailContext } from "@/context/CocktailContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CocktailForm from "@/components/CocktailForm";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ingredientsFromRezeptur, slugify } from "@/lib/utils";
import type { Cocktail } from "@/types";

const CocktailDetail = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { cocktails, deleteCocktail, upsertCocktail } = useCocktailContext();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const cocktail = useMemo(() => {
    if (!slug) return undefined;
    return cocktails.find((item) => slugify(item.Cocktail) === slug);
  }, [cocktails, slug]);

  if (!cocktail) {
    return (
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 pb-16 pt-10">
        <div className="rounded-2xl bg-white p-8 text-center shadow-soft">
          <h1 className="text-2xl font-semibold text-slate-900">Cocktail nicht gefunden</h1>
          <p className="mt-2 text-sm text-slate-500">
            Der angeforderte Cocktail ist nicht vorhanden oder wurde gelöscht.
          </p>
          <Button className="mt-6" onClick={() => navigate("/")}>Zur Übersicht</Button>
        </div>
      </div>
    );
  }

  const handleDelete = (entry: Cocktail) => {
    const confirmation = window.confirm(
      `Möchten Sie "${entry.Cocktail}" wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.`
    );
    if (!confirmation) return;
    deleteCocktail(entry);
    navigate("/");
  };

  const handleSubmit = (entry: Cocktail) => {
    upsertCocktail(entry);
    setIsFormOpen(false);
  };

  const ingredients = ingredientsFromRezeptur(cocktail.Rezeptur);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 pb-16 pt-10">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setIsFormOpen(true)}>
            <PencilLine className="h-4 w-4" /> Bearbeiten
          </Button>
          <Button variant="destructive" className="gap-2" onClick={() => handleDelete(cocktail)}>
            <Trash2 className="h-4 w-4" /> Löschen
          </Button>
        </div>
      </div>

      <section className="grid gap-6 rounded-2xl bg-white p-8 shadow-soft md:grid-cols-[2fr,3fr]">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{cocktail.Cocktail}</h1>
            {cocktail.Gruppe && (
              <p className="mt-1 text-sm text-slate-500">Gruppe: {cocktail.Gruppe}</p>
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Zutaten</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {ingredients.map((ingredient) => (
                <li key={ingredient} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-300" />
                  <span>{ingredient}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Zubereitung</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {cocktail.Zubereitung || "Keine Zubereitungsbeschreibung vorhanden."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {cocktail.Gruppe && <Badge>{cocktail.Gruppe}</Badge>}
            {cocktail.Deko && <Badge>{cocktail.Deko}</Badge>}
            {cocktail.Glas && <Badge>{cocktail.Glas}</Badge>}
          </div>
        </div>
      </section>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogTitle>{cocktail.Cocktail} bearbeiten</DialogTitle>
          <DialogDescription>
            Aktualisieren Sie die Daten und speichern Sie, um den Datensatz zu überschreiben.
          </DialogDescription>
          <CocktailForm initialValue={cocktail} onSubmit={handleSubmit} onCancel={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CocktailDetail;
