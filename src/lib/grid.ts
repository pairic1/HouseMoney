/**
 * The two-axis sweep (sale price x rate) and the reverse affordability solve.
 */

import { computePayment, type HouseCosts, type LoanTerms, type PaymentBreakdown } from './mortgage';
import { computeProceeds, type SaleAssumptions } from './proceeds';

/** Inclusive numeric range, tolerant of float drift on the last step. */
export function buildRange(low: number, high: number, step: number): number[] {
  if (step <= 0 || high < low) return [low];
  const out: number[] = [];
  const count = Math.floor((high - low) / step + 1e-9);
  for (let k = 0; k <= count; k++) {
    out.push(Number((low + k * step).toFixed(6)));
  }
  return out;
}

export interface GridCell {
  salePrice: number;
  rate: number;
  breakdown: PaymentBreakdown;
  cashToClose: number;
}

export interface GridResult {
  salePrices: number[];
  rates: number[];
  /** rows[saleIndex][rateIndex] */
  rows: GridCell[][];
  min: number;
  max: number;
}

export function buildGrid(
  purchasePrice: number,
  salePrices: number[],
  rates: number[],
  sale: SaleAssumptions,
  costs: HouseCosts,
  terms: LoanTerms,
): GridResult {
  let min = Infinity;
  let max = -Infinity;

  const rows = salePrices.map((salePrice) => {
    const { cashToClose } = computeProceeds(salePrice, sale);
    return rates.map((rate) => {
      const breakdown = computePayment(purchasePrice, cashToClose, rate, costs, terms);
      if (!breakdown.isShort) {
        min = Math.min(min, breakdown.totalMonthly);
        max = Math.max(max, breakdown.totalMonthly);
      }
      return { salePrice, rate, breakdown, cashToClose };
    });
  });

  if (min === Infinity) {
    min = 0;
    max = 0;
  }
  return { salePrices, rates, rows, min, max };
}

/**
 * Largest purchase price whose total monthly payment stays at or under `target`.
 *
 * Purchase price drives the answer through three channels at once — loan size,
 * property tax, and whether PMI kicks in — so there's no clean algebraic inverse
 * across the PMI discontinuity. Total monthly is monotonically non-decreasing in
 * price, though, so a bisection is both correct and stable.
 */
export function maxAffordablePrice(
  targetMonthly: number,
  cashToClose: number,
  annualRatePct: number,
  costs: HouseCosts,
  terms: LoanTerms,
  ceiling = 10_000_000,
): number {
  const monthlyAt = (price: number) =>
    computePayment(price, cashToClose, annualRatePct, costs, terms).totalMonthly;

  if (monthlyAt(0) > targetMonthly) return 0;
  if (monthlyAt(ceiling) <= targetMonthly) return ceiling;

  let lo = 0;
  let hi = ceiling;
  for (let k = 0; k < 60 && hi - lo > 100; k++) {
    const mid = (lo + hi) / 2;
    if (monthlyAt(mid) <= targetMonthly) lo = mid;
    else hi = mid;
  }
  // Round down to a clean $1k so the number reads like a real budget.
  return Math.floor(lo / 1000) * 1000;
}

export interface AffordabilityRow {
  salePrice: number;
  cashToClose: number;
  byRate: { rate: number; maxPrice: number }[];
}

export function buildAffordability(
  targetMonthly: number,
  salePrices: number[],
  rates: number[],
  sale: SaleAssumptions,
  costs: HouseCosts,
  terms: LoanTerms,
): AffordabilityRow[] {
  return salePrices.map((salePrice) => {
    const { cashToClose } = computeProceeds(salePrice, sale);
    return {
      salePrice,
      cashToClose,
      byRate: rates.map((rate) => ({
        rate,
        maxPrice: maxAffordablePrice(targetMonthly, cashToClose, rate, costs, terms),
      })),
    };
  });
}
