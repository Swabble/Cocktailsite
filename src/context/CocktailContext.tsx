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
import type {
  Cocktail,
  CocktailImageMap,
  CsvVersion,
  CsvVersionSource
} from "@/types";
import { parseCocktailCsv } from "@/lib/csv";
import {
  cocktailsEqual,
  getUniqueDecorations,
  getUniqueGlasses,
  getUniqueGroups,
  searchCocktails,
  slugify
} from "@/lib/utils";

const COCKTAIL_QUERY_KEY = ["cocktails"] as const;
const HISTORY_STORAGE_KEY = "cocktail-manager:csv-history";
const HISTORY_ACTIVE_KEY = "cocktail-manager:csv-history-active";
const IMAGE_STORAGE_KEY = "cocktail-manager:images";
const FAVORITES_STORAGE_KEY = "cocktail-manager:favorites";

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

const loadStoredImages = (): CocktailImageMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(IMAGE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CocktailImageMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    const entries = Object.entries(parsed).filter(
      ([, value]) => typeof value === "string" && value.length > 0
    );
    return Object.fromEntries(entries);
  } catch (error) {
    console.warn("Konnte gespeicherte Bilder nicht laden", error);
    return {};
  }
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
  decorations: string[];
  glasses: string[];
  cocktailImages: CocktailImageMap;
  recentlyChangedSlugs: string[];
  activeGroup: string | null;
  search: string;
  isLoading: boolean;
  error?: Error;
  csvVersions: CsvVersion[];
  activeVersionId: string | null;
  favorites: string[];
  setActiveGroup: (group: string | null) => void;
  setSearch: (value: string) => void;
  upsertCocktail: (cocktail: Cocktail) => void;
  deleteCocktail: (cocktail: Cocktail) => void;
  replaceAll: (cocktails: Cocktail[], options?: ReplaceOptions) => void;
  restoreVersion: (versionId: string) => void;
  setCocktailImage: (slug: string, dataUrl: string) => void;
  removeCocktailImage: (slug: string) => void;
  renameCocktailImage: (oldSlug: string, newSlug: string) => void;
  toggleFavorite: (slug: string) => void;
  isFavorite: (slug: string) => boolean;
  renameFavorite: (oldSlug: string, newSlug: string) => void;
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
  const [cocktailImages, setCocktailImages] = useState<CocktailImageMap>(() => loadStoredImages());
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch (error) {
      console.warn("Konnte Favoriten nicht laden", error);
      return [];
    }
  });

  const { data, isLoading, error } = useQuery({
    queryKey: COCKTAIL_QUERY_KEY,
    queryFn: fetchCocktails
  });

  const cocktails = data ?? [];

  useEffect(() => {
    setCocktailImages((previous) => {
      const allowed = new Set(cocktails.map((item) => slugify(item.Cocktail)));
      const filteredEntries = Object.entries(previous).filter(([slug]) => allowed.has(slug));
      if (filteredEntries.length === Object.entries(previous).length) {
        return previous;
      }
      return Object.fromEntries(filteredEntries);
    });
  }, [cocktails]);

  useEffect(() => {
    setFavorites((previous) => {
      const allowed = new Set(cocktails.map((item) => slugify(item.Cocktail)));
      const filtered = previous.filter((slug) => allowed.has(slug));
      return filtered.length === previous.length ? previous : filtered;
    });
  }, [cocktails]);

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
    if (typeof window === "undefined") return;
    window.localStorage.setItem(IMAGE_STORAGE_KEY, JSON.stringify(cocktailImages));
  }, [cocktailImages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

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

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const filteredCocktails = useMemo(() => {
    const searched = searchCocktails(cocktails, search);

    if (activeGroup === "__favorites__") {
      return searched.filter((cocktail) => favoriteSet.has(slugify(cocktail.Cocktail)));
    }

    if (!activeGroup) {
      return searched;
    }

    if (search.trim().length > 0) {
      return searched;
    }

    return searched.filter((cocktail) => (cocktail.Gruppe ?? "") === activeGroup);
  }, [cocktails, search, activeGroup, favoriteSet]);

  const groups = useMemo(() => getUniqueGroups(cocktails), [cocktails]);
  const decorations = useMemo(() => getUniqueDecorations(cocktails), [cocktails]);
  const glasses = useMemo(() => getUniqueGlasses(cocktails), [cocktails]);

  const baselineCocktails = useMemo(() => {
    if (!cocktails.length) return null;
    if (activeVersionId) {
      const activeIndex = csvVersions.findIndex((entry) => entry.id === activeVersionId);
      if (activeIndex >= 0 && activeIndex + 1 < csvVersions.length) {
        return csvVersions[activeIndex + 1].cocktails;
      }
    }
    if (csvVersions.length >= 2) {
      return csvVersions[1].cocktails;
    }
    if (csvVersions.length === 1) {
      return csvVersions[0].cocktails;
    }
    return null;
  }, [activeVersionId, cocktails, csvVersions]);

  const recentlyChangedSlugs = useMemo(() => {
    if (!baselineCocktails) return [];
    const baselineMap = new Map<string, Cocktail>();
    baselineCocktails.forEach((entry) => {
      baselineMap.set(slugify(entry.Cocktail), entry);
    });
    const changed = new Set<string>();
    cocktails.forEach((entry) => {
      const slug = slugify(entry.Cocktail);
      const reference = baselineMap.get(slug);
      if (!reference || !cocktailsEqual(entry, reference)) {
        changed.add(slug);
      }
    });
    return Array.from(changed);
  }, [baselineCocktails, cocktails]);

  const setCocktailImage = useCallback((slug: string, dataUrl: string) => {
    if (!slug || !dataUrl) return;
    setCocktailImages((previous) => ({ ...previous, [slug]: dataUrl }));
  }, []);

  const removeCocktailImage = useCallback((slug: string) => {
    if (!slug) return;
    setCocktailImages((previous) => {
      if (!(slug in previous)) return previous;
      const { [slug]: _removed, ...rest } = previous;
      return rest;
    });
  }, []);

  const renameCocktailImage = useCallback((oldSlug: string, newSlug: string) => {
    if (!oldSlug || !newSlug || oldSlug === newSlug) return;
    setCocktailImages((previous) => {
      if (!(oldSlug in previous)) return previous;
      const { [oldSlug]: image, ...rest } = previous;
      return image ? { ...rest, [newSlug]: image } : rest;
    });
  }, []);

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
      removeCocktailImage(slugify(cocktail.Cocktail));
      setFavorites((prev) => prev.filter((slug) => slug !== slugify(cocktail.Cocktail)));
    },
    [removeCocktailImage, updateCocktails]
  );

  const replaceAll = useCallback(
    (cocktailList: Cocktail[], options?: ReplaceOptions) => {
      updateCocktails(() => cocktailList);
      setActiveGroup(null);
      setSearch("");
      setCocktailImages((previous) => {
        const allowed = new Set(cocktailList.map((item) => slugify(item.Cocktail)));
        const filteredEntries = Object.entries(previous).filter(([slug]) => allowed.has(slug));
        return Object.fromEntries(filteredEntries);
      });
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
      setFavorites((previous) => {
        const allowed = new Set(
          cocktailList.map((item) => slugify(item.Cocktail))
        );
        return previous.filter((slug) => allowed.has(slug));
      });
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

  const toggleFavorite = useCallback((slug: string) => {
    setFavorites((previous) => {
      if (previous.includes(slug)) {
        return previous.filter((item) => item !== slug);
      }
      return [slug, ...previous];
    });
  }, []);

  const isFavorite = useCallback((slug: string) => favoriteSet.has(slug), [favoriteSet]);

  const renameFavorite = useCallback((oldSlug: string, newSlug: string) => {
    if (!favoriteSet.has(oldSlug)) return;
    setFavorites((previous) => {
      const filtered = previous.filter((item) => item !== oldSlug && item !== newSlug);
      return newSlug ? [newSlug, ...filtered] : filtered;
    });
  }, [favoriteSet]);

  const value: CocktailContextValue = {
    cocktails,
    filteredCocktails,
    groups,
    decorations,
    glasses,
    cocktailImages,
    recentlyChangedSlugs,
    activeGroup,
    search,
    isLoading,
    error: error instanceof Error ? error : undefined,
    csvVersions,
    activeVersionId,
    favorites,
    setActiveGroup,
    setSearch,
    upsertCocktail,
    deleteCocktail,
    replaceAll,
    restoreVersion,
    setCocktailImage,
    removeCocktailImage,
    renameCocktailImage,
    toggleFavorite,
    isFavorite,
    renameFavorite
  };

  return <CocktailContext.Provider value={value}>{children}</CocktailContext.Provider>;
};
