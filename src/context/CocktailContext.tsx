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
  CocktailDataset,
  CocktailImageMap,
  CocktailMetadataMap,
  CsvVersion,
  CsvVersionSource
} from "@/types";
import { parseCocktailCsv } from "@/lib/csv";
import {
  getUniqueDecorations,
  getUniqueGlasses,
  getUniqueGroups,
  searchCocktails,
  slugify
} from "@/lib/utils";

const COCKTAIL_QUERY_KEY = ["cocktails"] as const;
const HISTORY_STORAGE_KEY = "cocktail-manager:csv-history";
const HISTORY_ACTIVE_KEY = "cocktail-manager:csv-history-active";
const FAVORITES_STORAGE_KEY = "cocktail-manager:favorites";
const MODIFIED_WINDOW_MS = 1000 * 60 * 60 * 24 * 60; // 60 Tage

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const buildApiUrl = (path: string): string => `${API_BASE}${path}`;

const EMPTY_DATASET: CocktailDataset = {
  cocktails: [],
  images: {},
  modified: {}
};

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

const fetchCocktails = async (): Promise<CocktailDataset> => {
  const endpoint = buildApiUrl("/api/cocktails");
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`API-Fehler: ${response.status}`);
    }
    const payload = (await response.json()) as Partial<CocktailDataset>;
    return {
      cocktails: Array.isArray(payload.cocktails) ? payload.cocktails : [],
      images: payload.images ?? {},
      modified: payload.modified ?? {}
    };
  } catch (apiError) {
    console.warn("API nicht erreichbar, lese CSV direkt", apiError);
    const url = new URL(
      `${import.meta.env.BASE_URL}Cocktail_Liste.csv`,
      window.location.origin
    );
    url.searchParams.set("t", Date.now().toString());
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      throw new Error("CSV konnte nicht geladen werden");
    }
    const text = await response.text();
    const cocktails = await parseCocktailCsv(text);
    return {
      cocktails,
      images: {},
      modified: {}
    };
  }
};

const cloneDataset = (source: CocktailDataset): CocktailDataset => ({
  cocktails: source.cocktails.map((cocktail) => ({ ...cocktail })),
  images: { ...source.images },
  modified: { ...source.modified }
});

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
  const [dataset, setDataset] = useState<CocktailDataset>(EMPTY_DATASET);
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

  const { data, isLoading, error } = useQuery<CocktailDataset>({
    queryKey: COCKTAIL_QUERY_KEY,
    queryFn: fetchCocktails
  });

  const applyServerDataset = useCallback(
    (payload: CocktailDataset) => {
      const cloned = cloneDataset(payload);
      queryClient.setQueryData(COCKTAIL_QUERY_KEY, cloned);
      setDataset(cloned);
    },
    [queryClient]
  );

  useEffect(() => {
    if (!data) return;
    applyServerDataset(data);
  }, [data, applyServerDataset]);

  const syncDataset = useCallback(
    (updater: (current: CocktailDataset) => CocktailDataset) => {
      setDataset((previous) => {
        const base = cloneDataset(previous);
        const next = updater(base);
        queryClient.setQueryData(COCKTAIL_QUERY_KEY, next);
        return next;
      });
    },
    [queryClient]
  );

  const cocktails = dataset.cocktails;
  const cocktailImages = dataset.images;
  const modificationMap: CocktailMetadataMap = dataset.modified;

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

  const recentlyChangedSlugs = useMemo(() => {
    const threshold = Date.now() - MODIFIED_WINDOW_MS;
    return cocktails
      .map((entry) => slugify(entry.Cocktail))
      .filter((slug) => (modificationMap[slug] ?? 0) >= threshold);
  }, [cocktails, modificationMap]);

  const replaceImages = useCallback(
    (images: CocktailImageMap) => {
      setDataset((previous) => {
        const next = cloneDataset(previous);
        next.images = { ...images };
        queryClient.setQueryData(COCKTAIL_QUERY_KEY, next);
        return next;
      });
    },
    [queryClient]
  );

  const setCocktailImage = useCallback(
    (slug: string, dataUrl: string) => {
      if (!slug || !dataUrl) return;
      syncDataset((current) => {
        current.images = { ...current.images, [slug]: dataUrl };
        return current;
      });

      void (async () => {
        try {
          const response = await fetch(buildApiUrl("/api/cocktails/image"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug, dataUrl })
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const payload = (await response.json()) as { images: CocktailImageMap };
          replaceImages(payload.images);
        } catch (imageError) {
          console.error("Bild konnte nicht gespeichert werden", imageError);
          queryClient.invalidateQueries({ queryKey: COCKTAIL_QUERY_KEY });
        }
      })();
    },
    [queryClient, replaceImages, syncDataset]
  );

  const removeCocktailImage = useCallback(
    (slug: string) => {
      if (!slug) return;
      syncDataset((current) => {
        if (!(slug in current.images)) return current;
        const { [slug]: _removed, ...rest } = current.images;
        current.images = rest;
        return current;
      });

      void (async () => {
        try {
          const response = await fetch(buildApiUrl(`/api/cocktails/image/${slug}`), {
            method: "DELETE"
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const payload = (await response.json()) as { images: CocktailImageMap };
          replaceImages(payload.images);
        } catch (imageError) {
          console.error("Bild konnte nicht gelöscht werden", imageError);
          queryClient.invalidateQueries({ queryKey: COCKTAIL_QUERY_KEY });
        }
      })();
    },
    [queryClient, replaceImages, syncDataset]
  );

  const renameCocktailImage = useCallback(
    (oldSlug: string, newSlug: string) => {
      if (!oldSlug || !newSlug || oldSlug === newSlug) return;
      syncDataset((current) => {
        if (!(oldSlug in current.images)) return current;
        const { [oldSlug]: image, ...rest } = current.images;
        current.images = image ? { ...rest, [newSlug]: image } : rest;
        return current;
      });

      void (async () => {
        try {
          const response = await fetch(buildApiUrl("/api/cocktails/image/rename"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ oldSlug, newSlug })
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const payload = (await response.json()) as { images: CocktailImageMap };
          replaceImages(payload.images);
        } catch (imageError) {
          console.error("Bild konnte nicht umbenannt werden", imageError);
          queryClient.invalidateQueries({ queryKey: COCKTAIL_QUERY_KEY });
        }
      })();
    },
    [queryClient, replaceImages, syncDataset]
  );

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

  const persistCocktailList = useCallback(
    async (
      nextCocktails: Cocktail[],
      changedSlugs: string[],
      options?: {
        recordHistory?: boolean;
        label?: string;
        source?: CsvVersionSource;
        activeVersionId?: string | null;
      }
    ) => {
      try {
        const response = await fetch(buildApiUrl("/api/cocktails"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cocktails: nextCocktails, changedSlugs })
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as CocktailDataset;
        applyServerDataset(payload);
        setFavorites((previous) => {
          const allowed = new Set(payload.cocktails.map((item) => slugify(item.Cocktail)));
          return previous.filter((slug) => allowed.has(slug));
        });

        if (options?.recordHistory) {
          const formatter = new Intl.DateTimeFormat("de-DE", {
            dateStyle: "short",
            timeStyle: "short"
          });
          const label = options.label ?? `Version vom ${formatter.format(new Date())}`;
          recordVersion(payload.cocktails, label, options.source ?? "manual");
        } else if (options?.activeVersionId !== undefined) {
          setActiveVersionId(options.activeVersionId);
        }
      } catch (persistError) {
        console.error("Speichern der Cocktails fehlgeschlagen", persistError);
        queryClient.invalidateQueries({ queryKey: COCKTAIL_QUERY_KEY });
      }
    },
    [applyServerDataset, queryClient, recordVersion]
  );

  const applyCocktailList = useCallback(
    (
      nextCocktails: Cocktail[],
      options?: {
        changedSlugs?: string[];
        recordHistory?: boolean;
        label?: string;
        source?: CsvVersionSource;
        activeVersionId?: string | null;
      }
    ) => {
      const sluggedChanges = (options?.changedSlugs ?? []).map((slug) => slugify(slug));
      const allowedSlugs = new Set(nextCocktails.map((item) => slugify(item.Cocktail)));
      const timestamp = Date.now();

      syncDataset((current) => {
        current.cocktails = nextCocktails.map((item) => ({ ...item }));
        current.images = Object.fromEntries(
          Object.entries(current.images).filter(([slug]) => allowedSlugs.has(slug))
        );
        const filteredModified = Object.fromEntries(
          Object.entries(current.modified).filter(([slug]) => allowedSlugs.has(slug))
        );
        sluggedChanges.forEach((slug) => {
          if (allowedSlugs.has(slug)) {
            filteredModified[slug] = timestamp;
          }
        });
        current.modified = filteredModified;
        return current;
      });

      setFavorites((previous) => previous.filter((slug) => allowedSlugs.has(slug)));

      void persistCocktailList(nextCocktails, sluggedChanges, {
        recordHistory: options?.recordHistory,
        label: options?.label,
        source: options?.source,
        activeVersionId: options?.activeVersionId
      });
    },
    [persistCocktailList, setFavorites, syncDataset]
  );

  const upsertCocktail = useCallback(
    (cocktail: Cocktail) => {
      const slug = slugify(cocktail.Cocktail);
      const existingIndex = cocktails.findIndex(
        (item) => slugify(item.Cocktail) === slug
      );
      const nextList =
        existingIndex >= 0
          ? cocktails.map((item, index) => (index === existingIndex ? { ...cocktail } : item))
          : [...cocktails, { ...cocktail }];
      applyCocktailList(nextList, {
        changedSlugs: [slug],
        source: "manual",
        activeVersionId: null
      });
      setActiveVersionId(null);
    },
    [applyCocktailList, cocktails]
  );

  const deleteCocktail = useCallback(
    (cocktail: Cocktail) => {
      const slug = slugify(cocktail.Cocktail);
      const nextList = cocktails.filter((item) => slugify(item.Cocktail) !== slug);
      applyCocktailList(nextList, {
        changedSlugs: [slug],
        source: "manual",
        activeVersionId: null
      });
      setActiveVersionId(null);
      removeCocktailImage(slug);
    },
    [applyCocktailList, cocktails, removeCocktailImage]
  );

  const replaceAll = useCallback(
    (cocktailList: Cocktail[], options?: ReplaceOptions) => {
      setActiveGroup(null);
      setSearch("");
      applyCocktailList(cocktailList, {
        changedSlugs: [],
        recordHistory: options?.recordHistory,
        label: options?.label,
        source: options?.source ?? "manual",
        activeVersionId: options?.activeVersionId ?? null
      });
      if (!options?.recordHistory && options?.activeVersionId === undefined) {
        setActiveVersionId(null);
      }
    },
    [applyCocktailList, setActiveGroup, setSearch]
  );

  const restoreVersion = useCallback(
    (versionId: string) => {
      const version = csvVersions.find((entry) => entry.id === versionId);
      if (!version) return;
      replaceAll(cloneCocktails(version.cocktails), {
        recordHistory: false,
        activeVersionId: version.id,
        source: "restore"
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
