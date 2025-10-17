import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { Cocktail } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import IngredientInput, { type ParsedIngredient } from "@/features/cocktails/IngredientInput";
import { useCocktailContext } from "@/context/CocktailContext";
import { cn } from "@/lib/cn";

const createEmptyCocktail = (): Cocktail => ({
  Cocktail: "",
  Rezeptur: "",
  Gruppe: "",
  Deko: "",
  Glas: "",
  Zubereitung: ""
});

export type CocktailFormResult = {
  cocktail: Cocktail;
  imageData: string | null;
  imageChanged: boolean;
  previousSlug?: string;
  parsedIngredients: ParsedIngredient[];
};

type Props = {
  initialValue?: Cocktail;
  initialImage?: string | null;
  initialSlug?: string;
  onSubmit: (result: CocktailFormResult) => void;
  onCancel: () => void;
};

const CocktailForm = ({ initialValue, initialImage, initialSlug, onSubmit, onCancel }: Props) => {
  const { groups, decorations, glasses } = useCocktailContext();
  const [formValue, setFormValue] = useState<Cocktail>(initialValue ? { ...initialValue } : createEmptyCocktail());
  const [errors, setErrors] = useState<{ Cocktail?: string; Rezeptur?: string }>({});
  const [parsedIngredients, setParsedIngredients] = useState<ParsedIngredient[]>([]);
  const [parseNotice, setParseNotice] = useState<string | null>(null);
  const [groupSelection, setGroupSelection] = useState<string>("");
  const [customGroup, setCustomGroup] = useState<string>("");
  const [decorationSelection, setDecorationSelection] = useState<string>("");
  const [customDecoration, setCustomDecoration] = useState<string>("");
  const [glassSelection, setGlassSelection] = useState<string>("");
  const [customGlass, setCustomGlass] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string | null>(initialImage ?? null);
  const [imageChanged, setImageChanged] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialValue) {
      setFormValue({ ...initialValue });
    } else {
      setFormValue(createEmptyCocktail());
    }
  }, [initialValue]);

  useEffect(() => {
    setParseNotice(null);
  }, [parsedIngredients]);

  useEffect(() => {
    setImagePreview(initialImage ?? null);
    setImageChanged(false);
  }, [initialImage, initialValue]);

  useEffect(() => {
    const syncSelection = (
      value: string,
      options: string[],
      setSelection: (next: string) => void,
      setCustom: (next: string) => void
    ) => {
      if (value && !options.includes(value)) {
        setSelection("__custom__");
        setCustom(value);
      } else {
        setSelection(value);
        setCustom("");
      }
      if (!value) {
        setSelection("");
        setCustom("");
      }
    };

    const currentGroup = (initialValue?.Gruppe ?? "").trim();
    syncSelection(currentGroup, groups, setGroupSelection, setCustomGroup);

    const currentDecoration = (initialValue?.Deko ?? "").trim();
    syncSelection(currentDecoration, decorations, setDecorationSelection, setCustomDecoration);

    const currentGlass = (initialValue?.Glas ?? "").trim();
    syncSelection(currentGlass, glasses, setGlassSelection, setCustomGlass);
  }, [decorations, glasses, groups, initialValue]);

  const validate = () => {
    const nextErrors: typeof errors = {};
    let notice: string | null = null;
    if (!formValue.Cocktail.trim()) {
      nextErrors.Cocktail = "Bitte einen Namen eingeben";
    }
    if (!formValue.Rezeptur.trim()) {
      nextErrors.Rezeptur = "Bitte mindestens eine Zutat angeben";
    }

    const hasBlocking = parsedIngredients.some(
      (entry) =>
        entry.statuses.unit === "missing" ||
        entry.statuses.ingredient === "missing" ||
        entry.statuses.amount === "invalid"
    );

    if (hasBlocking) {
      nextErrors.Rezeptur = "Bitte ergänze Menge, Einheit oder Zutat.";
    }

    const hasWarnings = parsedIngredients.some(
      (entry) =>
        entry.statuses.amount === "ambiguous" ||
        entry.statuses.unit === "fuzzy" ||
        entry.statuses.ingredient === "fuzzy"
    );

    if (hasWarnings && !hasBlocking) {
      notice = "Einige Angaben wirken unscharf – bitte prüfe sie vor dem Speichern.";
    }

    setErrors(nextErrors);
    setParseNotice(notice);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (field: keyof Cocktail) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setFormValue((prev) => ({ ...prev, [field]: value }));
      if (field === "Cocktail" || field === "Rezeptur") {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  const handleGroupSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setGroupSelection(value);
    if (value === "__custom__") {
      setFormValue((prev) => ({ ...prev, Gruppe: customGroup }));
      return;
    }
    setCustomGroup("");
    setFormValue((prev) => ({ ...prev, Gruppe: value || "" }));
  };

  const handleCustomGroupChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCustomGroup(value);
    setFormValue((prev) => ({ ...prev, Gruppe: value }));
  };

  const handleDecorationSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setDecorationSelection(value);
    if (value === "__custom__") {
      setFormValue((prev) => ({ ...prev, Deko: customDecoration }));
      return;
    }
    setCustomDecoration("");
    setFormValue((prev) => ({ ...prev, Deko: value || "" }));
  };

  const handleCustomDecorationChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCustomDecoration(value);
    setFormValue((prev) => ({ ...prev, Deko: value }));
  };

  const handleGlassSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setGlassSelection(value);
    if (value === "__custom__") {
      setFormValue((prev) => ({ ...prev, Glas: customGlass }));
      return;
    }
    setCustomGlass("");
    setFormValue((prev) => ({ ...prev, Glas: value || "" }));
  };

  const handleCustomGlassChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCustomGlass(value);
    setFormValue((prev) => ({ ...prev, Glas: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;
    onSubmit({
      cocktail: formValue,
      imageData: imagePreview,
      imageChanged,
      previousSlug: initialSlug,
      parsedIngredients
    });
  };

  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImagePreview(reader.result);
        setImageChanged(true);
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

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageChanged(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const inputClass = (hasError: boolean) =>
    cn(
      hasError
        ? "border-red-400 focus-visible:border-red-400 focus-visible:ring-red-100"
        : "border-slate-200 focus-visible:border-slate-400"
    );

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="cocktail-name">
                Cocktail
              </label>
              <Input
                id="cocktail-name"
                value={formValue.Cocktail}
                onChange={handleChange("Cocktail")}
                placeholder="z. B. Espresso Martini"
                className={inputClass(Boolean(errors.Cocktail))}
                aria-invalid={errors.Cocktail ? "true" : "false"}
                aria-describedby={errors.Cocktail ? "error-cocktail" : undefined}
              />
              {errors.Cocktail && (
                <p className="text-xs text-red-500" id="error-cocktail">
                  {errors.Cocktail}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="cocktail-group">
                Gruppe
              </label>
              <select
                id="cocktail-group"
                value={groupSelection}
                onChange={handleGroupSelect}
                className={cn(
                  "h-10 w-full rounded-2xl border bg-white px-3 text-sm text-slate-700 shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200",
                  inputClass(false)
                )}
              >
                <option value="">Keine Gruppe</option>
                {groups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
                <option value="__custom__">Neue Gruppe hinzufügen…</option>
              </select>
              {groupSelection === "__custom__" && (
                <Input
                  id="cocktail-custom-group"
                  value={customGroup}
                  onChange={handleCustomGroupChange}
                  placeholder="Neue Gruppe eingeben"
                  className={cn("mt-2", inputClass(false))}
                />
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[3fr,2fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="cocktail-rezeptur">
                Zutaten
              </label>
              <IngredientInput
                id="cocktail-rezeptur"
                value={formValue.Rezeptur}
                onChange={(next) => {
                  setFormValue((prev) => ({ ...prev, Rezeptur: next }));
                  setErrors((prev) => ({ ...prev, Rezeptur: undefined }));
                }}
                onParsedChange={setParsedIngredients}
                placeholder="Eine Zutat pro Zeile, z. B. '2 cl Bacardi'"
                error={errors.Rezeptur}
              />
              {parseNotice && !errors.Rezeptur && (
                <p className="text-xs text-amber-600">{parseNotice}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="cocktail-zubereitung">
                Zubereitung
              </label>
              <Textarea
                id="cocktail-zubereitung"
                value={formValue.Zubereitung ?? ""}
                onChange={handleChange("Zubereitung")}
                placeholder="z. B. kräftig shaken und doppelt abseihen"
                className="min-h-[160px]"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="cocktail-deko">
                Deko
              </label>
              <select
                id="cocktail-deko"
                value={decorationSelection}
                onChange={handleDecorationSelect}
                className={cn(
                  "h-10 w-full rounded-2xl border bg-white px-3 text-sm text-slate-700 shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200",
                  inputClass(false)
                )}
              >
                <option value="">Keine Deko</option>
                {decorations.map((decoration) => (
                  <option key={decoration} value={decoration}>
                    {decoration}
                  </option>
                ))}
                <option value="__custom__">Neue Deko hinzufügen…</option>
              </select>
              {decorationSelection === "__custom__" && (
                <Input
                  id="cocktail-custom-deko"
                  value={customDecoration}
                  onChange={handleCustomDecorationChange}
                  placeholder="Neue Deko eingeben"
                  className={cn("mt-2", inputClass(false))}
                />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="cocktail-glas">
                Glas
              </label>
              <select
                id="cocktail-glas"
                value={glassSelection}
                onChange={handleGlassSelect}
                className={cn(
                  "h-10 w-full rounded-2xl border bg-white px-3 text-sm text-slate-700 shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200",
                  inputClass(false)
                )}
              >
                <option value="">Kein Glas angegeben</option>
                {glasses.map((glass) => (
                  <option key={glass} value={glass}>
                    {glass}
                  </option>
                ))}
                <option value="__custom__">Neues Glas hinzufügen…</option>
              </select>
              {glassSelection === "__custom__" && (
                <Input
                  id="cocktail-custom-glas"
                  value={customGlass}
                  onChange={handleCustomGlassChange}
                  placeholder="Neues Glas eingeben"
                  className={cn("mt-2", inputClass(false))}
                />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-sm font-medium text-slate-700" htmlFor="cocktail-image">
            Bild
          </label>
          <input
            ref={fileInputRef}
            id="cocktail-image"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageSelect}
          />
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
            {imagePreview ? (
              <div className="flex flex-col gap-4">
                <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <img
                    src={imagePreview}
                    alt={`Bild von ${formValue.Cocktail || "Cocktail"}`}
                    className="h-40 w-full object-cover"
                  />
                </figure>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Neues Bild wählen
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemoveImage}>
                    Bild entfernen
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col justify-between gap-4 text-sm text-slate-500">
                <p>
                  Optionales Foto hinzufügen oder mit der Gerätekamera aufnehmen, damit Gäste den Cocktail sofort
                  erkennen.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Bild aufnehmen/hochladen
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit">Speichern</Button>
      </div>
    </form>
  );
};

export default CocktailForm;
