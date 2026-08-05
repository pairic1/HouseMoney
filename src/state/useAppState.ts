import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_STATE,
  type AppState,
  type ProjectionState,
  type SavedHouse,
} from './defaults';

const STORAGE_KEY = 'housemoney.v1';

/**
 * The page used to compare exactly one wait-then-move plan. Anyone who saved a
 * `moveInYears` keeps that timing as their first plan rather than being reset
 * to the placeholder pair.
 */
function migrateMoveYears(stored: unknown): number[] {
  const p = stored as { moveYears?: unknown; moveInYears?: unknown } | undefined;
  if (Array.isArray(p?.moveYears)) {
    const clean = p.moveYears.filter((y): y is number => typeof y === 'number' && y > 0);
    if (clean.length) return clean;
  }
  if (typeof p?.moveInYears === 'number' && p.moveInYears > 0) return [p.moveInYears];
  return DEFAULT_STATE.projection.moveYears;
}

/**
 * Full history used to be opt-in and is now the default. A stored state from
 * before that change carries the old `false`, and a plain merge would pin
 * everyone to it forever. `purchaseMonth` only exists from this version on, so
 * its absence dates the save — that's the signal to take the new defaults.
 */
function migrateHistoryDefaults(stored: unknown): Partial<ProjectionState> {
  const p = stored as Partial<ProjectionState> | undefined;
  if (p && typeof p.purchaseMonth === 'number') return {};
  return {
    historyEnabled: DEFAULT_STATE.projection.historyEnabled,
    totalsView: DEFAULT_STATE.projection.totalsView,
  };
}

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
      projection: {
        ...DEFAULT_STATE.projection,
        ...stored.projection,
        ...migrateHistoryDefaults(stored.projection),
        moveYears: migrateMoveYears(stored.projection),
        expenses: stored.projection?.expenses ?? [],
      },
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

  const setProjection = useCallback((patch: Partial<AppState['projection']>) => {
    setState((s) => ({ ...s, projection: { ...s.projection, ...patch } }));
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

  return {
    state,
    set,
    setCosts,
    setSale,
    setTerms,
    setProjection,
    saveHouse,
    removeHouse,
    resetAll,
  };
}
