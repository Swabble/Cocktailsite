import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, History, Upload, X, Menu } from "lucide-react";
import { useCocktailContext } from "@/context/CocktailContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseCocktailCsvStrict, serialiseCocktailsToCsv } from "@/lib/csv";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "short",
  timeStyle: "short"
});

const CsvMenu = () => {
  const {
    cocktails,
    replaceAll,
    csvVersions,
    activeVersionId,
    restoreVersion
  } = useCocktailContext();
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const versionOptions = useMemo(
    () =>
      csvVersions.map((version) => ({
        ...version,
        formattedDate: dateFormatter.format(version.createdAt)
      })),
    [csvVersions]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const handleExport = () => {
    const csvString = serialiseCocktailsToCsv(cocktails);
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Cocktail_Liste_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setFeedback("Aktuelle Liste wurde als CSV heruntergeladen.");
    setError(null);
  };

  const handleFileChange = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = parseCocktailCsvStrict(text);

      if (result.errors.length) {
        setError(result.errors.join("\n"));
        setFeedback(null);
        return;
      }

      const confirmationMessage = [
        `Neue CSV-Datei "${file.name}" importieren?`,
        `${result.cocktails.length} Cocktails werden übernommen.`
      ];

      if (result.warnings.length) {
        confirmationMessage.push("Hinweise:");
        result.warnings.forEach((warning) => confirmationMessage.push(`• ${warning}`));
      }

      const confirmed = window.confirm(confirmationMessage.join("\n"));
      if (!confirmed) {
        return;
      }

      replaceAll(result.cocktails, {
        recordHistory: true,
        label: `Upload ${file.name} (${dateFormatter.format(new Date())})`,
        source: "upload"
      });

      setFeedback(`CSV "${file.name}" erfolgreich importiert.`);
      setError(null);
      setIsOpen(false);
    } catch (importError) {
      console.error(importError);
      setError("Die Datei konnte nicht gelesen werden.");
      setFeedback(null);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const closeMenu = () => {
    setIsOpen(false);
    setError(null);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="CSV-Menü öffnen"
        className="h-12 w-12 rounded-full border border-slate-200 bg-white text-slate-700 shadow-soft"
        onClick={() => setIsOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {isOpen &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40 bg-slate-900/50" aria-hidden="true" onClick={closeMenu} />
            <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md translate-x-0 bg-white shadow-xl transition-transform duration-200 ease-out">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <span className="flex items-center gap-2 text-base font-semibold text-slate-800">
                  <History className="h-5 w-5" /> CSV-Verwaltung
                </span>
                <Button type="button" size="icon" variant="ghost" aria-label="CSV-Menü schließen" onClick={closeMenu}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex h-full flex-col gap-6 overflow-y-auto px-6 py-6">
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    Importieren, exportieren und wechseln Sie zwischen den letzten fünf CSV-Ständen.
                  </p>
                  {error && <p className="text-sm text-red-500 whitespace-pre-line">{error}</p>}
                  {feedback && !error && (
                    <p className="text-sm text-emerald-600 whitespace-pre-line">{feedback}</p>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2 bg-slate-50 hover:bg-slate-100"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" /> CSV importieren
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start gap-2 bg-slate-50 hover:bg-slate-100"
                    onClick={handleExport}
                  >
                    <Download className="h-4 w-4" /> CSV exportieren
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700">Gespeicherte Versionen</h3>
                  <ul className="space-y-3">
                    {versionOptions.length === 0 && (
                      <li className="text-sm text-slate-500">Noch keine Versionen gespeichert.</li>
                    )}
                    {versionOptions.map((version) => (
                      <li key={version.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-slate-800">{version.label}</p>
                            <p className="text-xs text-slate-500">
                              {version.formattedDate} · {version.cocktails.length} Cocktails
                            </p>
                          </div>
                          {activeVersionId === version.id ? (
                            <Badge variant="outline" className="text-emerald-600">
                              Aktiv
                            </Badge>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                restoreVersion(version.id);
                                setFeedback(`Version "${version.label}" wurde aktiviert.`);
                                setError(null);
                                setIsOpen(false);
                              }}
                            >
                              Übernehmen
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </aside>
          </>,
          document.body
        )}
    </>
  );
};

export default CsvMenu;
