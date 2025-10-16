import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Cocktail, CsvVersion, CsvVersionSource } from "@/types";
import { parseCocktailCsv } from "@/lib/csv";
import { getUniqueGroups, searchCocktails, slugify } from "@/lib/utils";

const COCKTAIL_QUERY_KEY = ["cocktails"] as const;
const HISTORY_STORAGE_KEY = "cocktail-manager:csv-history";
const HISTORY_ACTIVE_KEY = "cocktail-manager:csv-history-active";

type ReplaceOptions = {
  recordHistory?: boolean;
  label?: string;
  source?: CsvVersionSource;
  activeVersionId?: string | null;
};

const cloneCocktails = (cocktails: Cocktail[]): Cocktail[] => cocktails.map((item) => ({ ...item }));

const loadStoredHistory = (): CsvVersion[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CsvVersion[];
    return parsed.map((entry) => ({
      ...entry,
      cocktails: Array.isArray(entry.cocktails)
        ? entry.cocktails.map((cocktail) => ({ ...cocktail }))
        : []
    }));
  } catch (error) {
    console.warn("Konnte gespeicherte CSV-Historie nicht laden", error);
    return [];
  }
};

const loadStoredActiveId = (): string | null => {
  if (typeof window === "undefined") return null;
  const active = window.localStorage.getItem(HISTORY_ACTIVE_KEY);
  return active && active.length > 0 ? active : null;
};

const createVersion = (
  cocktails: Cocktail[],
  label: string,
  source: CsvVersionSource
): CsvVersion => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  label,
  createdAt: Date.now(),
  source,
  cocktails: cloneCocktails(cocktails)
});

const fetchCocktails = async (): Promise<Cocktail[]> => {
  const url = new URL(`${import.meta.env.BASE_URL}Cocktail_Liste.csv`, window.location.origin);
  url.searchParams.set("t", Date.now().toString());

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error("CSV konnte nicht geladen werden");
  }
  const text = await response.text();
  return parseCocktailCsv(text);
};

type CocktailContextValue = {
  cocktails: Cocktail[];
  filteredCocktails: Cocktail[];
  groups: string[];
  activeGroup: string | null;
  search: string;
  isLoading: boolean;
  error?: Error;
  csvVersions: CsvVersion[];
  activeVersionId: string | null;
  setActiveGroup: (group: string | null) => void;
  setSearch: (value: string) => void;
  upsertCocktail: (cocktail: Cocktail) => void;
  deleteCocktail: (cocktail: Cocktail) => void;
  replaceAll: (cocktails: Cocktail[], options?: ReplaceOptions) => void;
  restoreVersion: (versionId: string) => void;
};

const CocktailContext = createContext<CocktailContextValue | undefined>(undefined);

export const useCocktailContext = (): CocktailContextValue => {
  const context = useContext(CocktailContext);
  if (!context) {
    throw new Error("useCocktailContext muss innerhalb des CocktailProvider verwendet werden");
  }
  return context;
};

export const CocktailProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [csvVersions, setCsvVersions] = useState<CsvVersion[]>(() => loadStoredHistory());
  const [activeVersionId, setActiveVersionId] = useState<string | null>(() => loadStoredActiveId());

  const { data, isLoading, error } = useQuery({
    queryKey: COCKTAIL_QUERY_KEY,
    queryFn: fetchCocktails
  });

  const cocktails = data ?? [];

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(csvVersions));
  }, [csvVersions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeVersionId) {
      window.localStorage.setItem(HISTORY_ACTIVE_KEY, activeVersionId);
    } else {
      window.localStorage.removeItem(HISTORY_ACTIVE_KEY);
    }
  }, [activeVersionId]);

  useEffect(() => {
    if (!cocktails.length) return;
    setCsvVersions((previous) => {
      if (previous.length > 0) {
        return previous;
      }
      return [createVersion(cocktails, "Initiale CSV", "initial")];
    });
  }, [cocktails]);

  useEffect(() => {
    if (csvVersions.length === 0) {
      setActiveVersionId(null);
      return;
    }
    setActiveVersionId((current) => current ?? csvVersions[0]?.id ?? null);
  }, [csvVersions]);

  const filteredCocktails = useMemo(() => {
    const searched = searchCocktails(cocktails, search);
    if (!activeGroup) return searched;
    return searched.filter((cocktail) => (cocktail.Gruppe ?? "") === activeGroup);
  }, [cocktails, search, activeGroup]);

  const groups = useMemo(() => getUniqueGroups(cocktails), [cocktails]);

  const recordVersion = useCallback(
    (cocktailList: Cocktail[], label: string, source: CsvVersionSource) => {
      const version = createVersion(cocktailList, label, source);
      setCsvVersions((previous) => {
        const filtered = previous.filter((entry) => entry.id !== version.id);
        const next = [version, ...filtered];
        return next.slice(0, 5);
      });
      setActiveVersionId(version.id);
    },
    []
  );

  const updateCocktails = useCallback(
    (updater: (previous: Cocktail[]) => Cocktail[]) => {
      queryClient.setQueryData(COCKTAIL_QUERY_KEY, (previous?: Cocktail[]) => {
        const next = updater(previous ?? []);
        return next;
      });
    },
    [queryClient]
  );

  const upsertCocktail = useCallback(
    (cocktail: Cocktail) => {
      updateCocktails((previous) => {
        const existingIndex = previous.findIndex(
          (item) => slugify(item.Cocktail) === slugify(cocktail.Cocktail)
        );
        if (existingIndex >= 0) {
          const copy = [...previous];
          copy[existingIndex] = { ...cocktail };
          return copy;
        }
        return [...previous, { ...cocktail }];
      });
      setActiveVersionId(null);
    },
    [updateCocktails]
  );

  const deleteCocktail = useCallback(
    (cocktail: Cocktail) => {
      updateCocktails((previous) =>
        previous.filter((item) => slugify(item.Cocktail) !== slugify(cocktail.Cocktail))
      );
      setActiveVersionId(null);
    },
    [updateCocktails]
  );

  const replaceAll = useCallback(
    (cocktailList: Cocktail[], options?: ReplaceOptions) => {
      updateCocktails(() => cocktailList);
      setActiveGroup(null);
      setSearch("");
      if (options?.recordHistory) {
        const formatter = new Intl.DateTimeFormat("de-DE", {
          dateStyle: "short",
          timeStyle: "short"
        });
        const label = options.label ?? `Version vom ${formatter.format(new Date())}`;
        recordVersion(cocktailList, label, options.source ?? "manual");
      } else if (options?.activeVersionId !== undefined) {
        setActiveVersionId(options.activeVersionId);
      }
    },
    [updateCocktails, recordVersion]
  );

  const restoreVersion = useCallback(
    (versionId: string) => {
      const version = csvVersions.find((entry) => entry.id === versionId);
      if (!version) return;
      replaceAll(cloneCocktails(version.cocktails), {
        recordHistory: false,
        activeVersionId: version.id
      });
    },
    [csvVersions, replaceAll]
  );

  const value: CocktailContextValue = {
    cocktails,
    filteredCocktails,
    groups,
    activeGroup,
    search,
    isLoading,
    error: error instanceof Error ? error : undefined,
    csvVersions,
    activeVersionId,
    setActiveGroup,
    setSearch,
    upsertCocktail,
    deleteCocktail,
    replaceAll,
    restoreVersion
  };

  return <CocktailContext.Provider value={value}>{children}</CocktailContext.Provider>;
};
