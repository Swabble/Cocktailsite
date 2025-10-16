import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Cocktail } from "@/types";
import { parseCocktailCsv } from "@/lib/csv";
import { getUniqueGroups, searchCocktails, slugify } from "@/lib/utils";

const COCKTAIL_QUERY_KEY = ["cocktails"] as const;

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
  setActiveGroup: (group: string | null) => void;
  setSearch: (value: string) => void;
  upsertCocktail: (cocktail: Cocktail) => void;
  deleteCocktail: (cocktail: Cocktail) => void;
  replaceAll: (cocktails: Cocktail[]) => void;
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

  const { data, isLoading, error } = useQuery({
    queryKey: COCKTAIL_QUERY_KEY,
    queryFn: fetchCocktails
  });

  const cocktails = data ?? [];

  const filteredCocktails = useMemo(() => {
    const searched = searchCocktails(cocktails, search);
    if (!activeGroup) return searched;
    return searched.filter((cocktail) => (cocktail.Gruppe ?? "") === activeGroup);
  }, [cocktails, search, activeGroup]);

  const groups = useMemo(() => getUniqueGroups(cocktails), [cocktails]);

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
    },
    [updateCocktails]
  );

  const deleteCocktail = useCallback(
    (cocktail: Cocktail) => {
      updateCocktails((previous) =>
        previous.filter((item) => slugify(item.Cocktail) !== slugify(cocktail.Cocktail))
      );
    },
    [updateCocktails]
  );

  const replaceAll = useCallback(
    (cocktailList: Cocktail[]) => {
      updateCocktails(() => cocktailList);
      setActiveGroup(null);
      setSearch("");
    },
    [updateCocktails]
  );

  const value: CocktailContextValue = {
    cocktails,
    filteredCocktails,
    groups,
    activeGroup,
    search,
    isLoading,
    error: error instanceof Error ? error : undefined,
    setActiveGroup,
    setSearch,
    upsertCocktail,
    deleteCocktail,
    replaceAll
  };

  return <CocktailContext.Provider value={value}>{children}</CocktailContext.Provider>;
};
