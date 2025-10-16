import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { Cocktail } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCocktailContext } from "@/context/CocktailContext";

const createEmptyCocktail = (): Cocktail => ({
  Cocktail: "",
  Rezeptur: "",
  Gruppe: "",
  Deko: "",
  Glas: "",
  Zubereitung: ""
});

type Props = {
  initialValue?: Cocktail;
  onSubmit: (cocktail: Cocktail) => void;
  onCancel: () => void;
};

const CocktailForm = ({ initialValue, onSubmit, onCancel }: Props) => {
  const { groups } = useCocktailContext();
  const [formValue, setFormValue] = useState<Cocktail>(initialValue ? { ...initialValue } : createEmptyCocktail());
  const [errors, setErrors] = useState<{ Cocktail?: string; Rezeptur?: string }>({});
  const [groupSelection, setGroupSelection] = useState<string>("");
  const [customGroup, setCustomGroup] = useState<string>("");

  useEffect(() => {
    if (initialValue) {
      setFormValue({ ...initialValue });
    } else {
      setFormValue(createEmptyCocktail());
    }
  }, [initialValue]);

  useEffect(() => {
    const currentGroup = (initialValue?.Gruppe ?? "").trim();
    if (currentGroup && !groups.includes(currentGroup)) {
      setGroupSelection("__custom__");
      setCustomGroup(currentGroup);
    } else {
      setGroupSelection(currentGroup);
      setCustomGroup("");
    }
    if (!currentGroup) {
      setGroupSelection("");
      setCustomGroup("");
    }
  }, [groups, initialValue]);

  const validate = () => {
    const nextErrors: typeof errors = {};
    if (!formValue.Cocktail.trim()) {
      nextErrors.Cocktail = "Bitte einen Namen eingeben";
    }
    if (!formValue.Rezeptur.trim()) {
      nextErrors.Rezeptur = "Bitte mindestens eine Zutat angeben";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (field: keyof Cocktail) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormValue((prev) => ({ ...prev, [field]: event.target.value }));
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;
    onSubmit(formValue);
  };

  return (
    <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="cocktail-name">
            Cocktail *
          </label>
          <Input
            id="cocktail-name"
            value={formValue.Cocktail}
            onChange={handleChange("Cocktail")}
            placeholder="z. B. Espresso Martini"
            required
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
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
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
              className="mt-2"
            />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="cocktail-rezeptur">
          Rezeptur *
        </label>
        <Textarea
          id="cocktail-rezeptur"
          value={formValue.Rezeptur}
          onChange={handleChange("Rezeptur")}
          placeholder="Zutaten, kommagetrennt"
          required
          aria-invalid={errors.Rezeptur ? "true" : "false"}
          aria-describedby={errors.Rezeptur ? "error-rezeptur" : undefined}
        />
        {errors.Rezeptur && (
          <p className="text-xs text-red-500" id="error-rezeptur">
            {errors.Rezeptur}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="cocktail-deko">
            Deko
          </label>
          <Input
            id="cocktail-deko"
            value={formValue.Deko ?? ""}
            onChange={handleChange("Deko")}
            placeholder="z. B. Orangenzeste"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="cocktail-glas">
            Glas
          </label>
          <Input
            id="cocktail-glas"
            value={formValue.Glas ?? ""}
            onChange={handleChange("Glas")}
            placeholder="z. B. Coupette"
          />
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
            rows={3}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit">Speichern</Button>
      </div>
    </form>
  );
};

export default CocktailForm;
