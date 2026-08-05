import type { HouseCosts, LoanTerms, TaxMode } from '../lib/mortgage';
import type { SaleAssumptions } from '../lib/proceeds';
import type { PlannedExpense } from '../lib/projection';

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

  projection: ProjectionState;
}

/**
 * The Long Run page. Kept separate from the estimator's fields because it asks
 * about the house you already own, which the estimator never needs to know.
 */
export interface ProjectionState {
  horizonYears: number;
  /** One wait-then-move plan per entry, so several timings plot side by side. */
  moveYears: number[];

  /** The house you're in now. */
  currentValue: number;
  currentAppreciationPct: number;
  currentTaxMode: TaxMode;
  currentTaxRatePct: number;
  currentTaxAnnual: number;
  currentInsuranceAnnual: number;
  currentHoaMonthly: number;
  currentMaintenanceMode: TaxMode;
  currentMaintenancePct: number;
  currentMaintenanceAnnual: number;

  currentBalance: number;
  currentRatePct: number;
  currentRemainingYears: number;

  /** What this house has already cost, from the day you bought it. */
  historyEnabled: boolean;
  purchaseYear: number;
  /** 1–12. Buying in October rather than January is nearly a year of drift. */
  purchaseMonth: number;
  purchasePrice: number;
  originalLoan: number;
  originalRatePct: number;
  originalTermYears: number;
  /** Whether the cost breakdowns count the years already spent here. */
  totalsView: 'today' | 'purchase';

  /** The house you'd move to, priced in today's dollars. */
  nextAppreciationPct: number;
  nextMaintenanceMode: TaxMode;
  nextMaintenancePct: number;
  nextMaintenanceAnnual: number;
  rateLaterPct: number;

  investmentReturnPct: number;
  costInflationPct: number;

  expenses: PlannedExpense[];
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

  projection: {
    horizonYears: 30,
    moveYears: [5, 10],

    currentValue: 700_000,
    currentAppreciationPct: 3,
    currentTaxMode: 'percent',
    currentTaxRatePct: 1.1,
    currentTaxAnnual: 7_000,
    currentInsuranceAnnual: 2_000,
    currentHoaMonthly: 0,
    currentMaintenanceMode: 'percent',
    currentMaintenancePct: 1,
    currentMaintenanceAnnual: 7_000,

    currentBalance: 500_000,
    currentRatePct: 6,
    currentRemainingYears: 28,

    // The whole time you've owned the place is the honest default; measuring
    // from today is the comparison, reachable from the toggle on the page.
    historyEnabled: true,
    purchaseYear: 2019,
    purchaseMonth: 6,
    purchasePrice: 450_000,
    originalLoan: 400_000,
    originalRatePct: 4.5,
    originalTermYears: 30,
    totalsView: 'purchase',

    nextAppreciationPct: 3,
    nextMaintenanceMode: 'percent',
    nextMaintenancePct: 1,
    nextMaintenanceAnnual: 6_500,
    rateLaterPct: 6.5,

    investmentReturnPct: 5,
    costInflationPct: 3,

    expenses: [],
  },
};
