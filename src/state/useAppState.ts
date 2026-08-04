import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_STATE, type AppState, type SavedHouse } from './defaults';

const STORAGE_KEY = 'housemoney.v1';

/** Merge stored values over defaults so a new field never arrives undefined. */
function hydrate(raw: string | null): AppState {
  if (!raw) return DEFAULT_STATE;
  try {
    const stored = JSON.parse(raw) as Partial<AppState>;
    return {
      ...DEFAULT_STATE,
      ...stored,
      costs: { ...DEFAULT_STATE.costs, ...stored.costs },
      sale: { ...DEFAULT_STATE.sale, ...stored.sale },
      terms: { ...DEFAULT_STATE.terms, ...stored.terms },
      savedHouses: stored.savedHouses ?? [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(() =>
    hydrate(typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)),
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing or a full quota — the app still works, it just won't remember.
    }
  }, [state]);

  const set = useCallback(<K extends keyof AppState>(key: K, value: AppState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  const setCosts = useCallback((patch: Partial<AppState['costs']>) => {
    setState((s) => ({ ...s, costs: { ...s.costs, ...patch } }));
  }, []);

  const setSale = useCallback((patch: Partial<AppState['sale']>) => {
    setState((s) => ({ ...s, sale: { ...s.sale, ...patch } }));
  }, []);

  const setTerms = useCallback((patch: Partial<AppState['terms']>) => {
    setState((s) => ({ ...s, terms: { ...s.terms, ...patch } }));
  }, []);

  const saveHouse = useCallback((house: SavedHouse) => {
    setState((s) => {
      const existing = s.savedHouses.findIndex((h) => h.id === house.id);
      const savedHouses = [...s.savedHouses];
      if (existing >= 0) savedHouses[existing] = house;
      else savedHouses.push(house);
      return { ...s, savedHouses };
    });
  }, []);

  const removeHouse = useCallback((id: string) => {
    setState((s) => ({ ...s, savedHouses: s.savedHouses.filter((h) => h.id !== id) }));
  }, []);

  const resetAll = useCallback(() => setState(DEFAULT_STATE), []);

  return { state, set, setCosts, setSale, setTerms, saveHouse, removeHouse, resetAll };
}
