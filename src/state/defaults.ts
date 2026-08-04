import type { HouseCosts, LoanTerms } from '../lib/mortgage';
import type { SaleAssumptions } from '../lib/proceeds';

export interface SavedHouse {
  id: string;
  nickname: string;
  price: number;
  /** null means "use the global assumption". */
  taxRatePct: number | null;
  taxAnnual: number | null;
  insuranceAnnual: number | null;
  hoaMonthly: number | null;
  note: string;
}

export interface AppState {
  purchasePrice: number;
  costs: HouseCosts;
  sale: SaleAssumptions;
  terms: LoanTerms;
  targetMonthly: number;

  saleLow: number;
  saleHigh: number;
  saleStep: number;

  rateLow: number;
  rateHigh: number;
  rateStep: number;

  savedHouses: SavedHouse[];
}

/**
 * Placeholders only — round numbers that demonstrate the tool without being
 * anyone's actual position. Real figures live in localStorage, never in git.
 */
export const DEFAULT_STATE: AppState = {
  purchasePrice: 650_000,

  costs: {
    taxMode: 'percent',
    taxRatePct: 1.1,
    taxAnnual: 7_000,
    insuranceAnnual: 2_000,
    hoaMonthly: 0,
  },

  sale: {
    payoff: 500_000,
    commissionPct: 6,
    sellerClosingPct: 1,
    concessions: 0,
    cashHeldBack: 20_000,
    extraSavings: 0,
  },

  terms: {
    termYears: 30,
    pmiRatePct: 0.5,
    buyerClosingPct: 2.5,
  },

  targetMonthly: 4_000,

  saleLow: 700_000,
  saleHigh: 800_000,
  saleStep: 25_000,

  rateLow: 6,
  rateHigh: 7.5,
  rateStep: 0.25,

  savedHouses: [],
};
