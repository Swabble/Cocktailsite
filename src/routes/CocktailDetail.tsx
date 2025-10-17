import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, ImageOff, PencilLine, Star, Trash2 } from "lucide-react";
import { useCocktailContext } from "@/context/CocktailContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CocktailForm, { type CocktailFormResult } from "@/components/CocktailForm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ingredientsFromRezeptur, slugify } from "@/lib/utils";
import { cn } from "@/lib/cn";
import type { Cocktail } from "@/types";

const CocktailDetail = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const {
    cocktails,
    deleteCocktail,
    upsertCocktail,
    cocktailImages,
    setCocktailImage,
    removeCocktailImage,
    renameCocktailImage,
    toggleFavorite,
    isFavorite,
    renameFavorite
  } = useCocktailContext();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleSubmit = ({ cocktail: entry, imageData, imageChanged }: CocktailFormResult) => {
    const previousSlug = slugify(cocktail.Cocktail);
    upsertCocktail(entry);
    const nextSlug = slugify(entry.Cocktail);

    if (imageChanged) {
      if (imageData) {
        setCocktailImage(nextSlug, imageData);
      } else {
        removeCocktailImage(nextSlug);
      }
      if (previousSlug !== nextSlug) {
        removeCocktailImage(previousSlug);
      }
    } else if (previousSlug !== nextSlug) {
      renameCocktailImage(previousSlug, nextSlug);
    }

    if (previousSlug !== nextSlug) {
      renameFavorite(previousSlug, nextSlug);
    }

    setIsFormOpen(false);
    if (previousSlug !== nextSlug) {
      navigate(`/cocktail/${nextSlug}`, { replace: true });
    }
  };

  const ingredients = ingredientsFromRezeptur(cocktail.Rezeptur);
  const slugified = slugify(cocktail.Cocktail);
  const imageSrc = cocktailImages[slugified] ?? null;
  const isCurrentFavorite = isFavorite(slugified);

  const handleToggleFavorite = () => {
    toggleFavorite(slugified);
  };

  const handleDirectImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCocktailImage(slugified, reader.result);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      console.error("Bild konnte nicht gelesen werden");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveDirectImage = () => {
    removeCocktailImage(slugified);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 pb-16 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={isCurrentFavorite ? "default" : "outline"}
            className={cn(
              "gap-2",
              isCurrentFavorite
                ? "bg-amber-500 text-white hover:bg-amber-500/90"
                : "border-amber-200 text-amber-600"
            )}
            onClick={handleToggleFavorite}
          >
            <Star
              className={cn(
                "h-4 w-4",
                isCurrentFavorite ? "fill-current" : "text-amber-500"
              )}
            />
            {isCurrentFavorite ? "Favorit" : "Favorisieren"}
          </Button>
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleDirectImageSelect}
          />
          <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={`Cocktail ${cocktail.Cocktail}`}
                className="h-56 w-full object-cover"
              />
            ) : (
              <div className="flex h-56 items-center justify-center p-4 text-center text-sm text-slate-400">
                Noch kein Bild hinterlegt – fügen Sie direkt hier ein Foto hinzu.
              </div>
            )}
          </figure>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              {imageSrc ? "Bild aktualisieren" : "Bild hinzufügen"}
            </Button>
            {imageSrc && (
              <Button type="button" variant="ghost" className="gap-2" onClick={handleRemoveDirectImage}>
                <ImageOff className="h-4 w-4" /> Bild entfernen
              </Button>
            )}
          </div>
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
        <DialogContent className="max-h-[88vh] w-full max-w-4xl">
          <DialogTitle>{cocktail.Cocktail} bearbeiten</DialogTitle>
          <div className="mt-4 max-h-[calc(88vh-6rem)] overflow-y-auto pr-1 sm:pr-2">
            <CocktailForm
              initialValue={cocktail}
              initialImage={imageSrc}
              initialSlug={slug}
              onSubmit={handleSubmit}
              onCancel={() => setIsFormOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CocktailDetail;
