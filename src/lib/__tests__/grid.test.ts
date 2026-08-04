import { describe, it, expect } from 'vitest';
import { buildRange, buildGrid, maxAffordablePrice } from '../grid';
import { computePayment, type HouseCosts, type LoanTerms } from '../mortgage';
import type { SaleAssumptions } from '../proceeds';

const sale: SaleAssumptions = {
  payoff: 560_000,
  commissionPct: 6,
  sellerClosingPct: 1,
  concessions: 0,
  cashHeldBack: 20_000,
  extraSavings: 0,
};

const costs: HouseCosts = {
  taxMode: 'percent',
  taxRatePct: 1.1,
  taxAnnual: 7_000,
  insuranceAnnual: 2_000,
  hoaMonthly: 0,
};
const terms: LoanTerms = { termYears: 30, pmiRatePct: 0.5, buyerClosingPct: 2.5 };

describe('buildRange', () => {
  it('is inclusive of the high end', () => {
    expect(buildRange(800_000, 900_000, 25_000)).toEqual([
      800_000, 825_000, 850_000, 875_000, 900_000,
    ]);
  });

  it('survives fractional steps without float drift', () => {
    expect(buildRange(6, 7.5, 0.25)).toEqual([6, 6.25, 6.5, 6.75, 7, 7.25, 7.5]);
  });

  it('degrades gracefully on bad input', () => {
    expect(buildRange(5, 5, 0.25)).toEqual([5]);
    expect(buildRange(5, 4, 0.25)).toEqual([5]);
    expect(buildRange(5, 10, 0)).toEqual([5]);
  });
});

describe('buildGrid', () => {
  const salePrices = buildRange(800_000, 900_000, 25_000);
  const rates = buildRange(6, 7.5, 0.25);
  const grid = buildGrid(700_000, salePrices, rates, sale, costs, terms);

  it('produces a cell for every sale price and rate pairing', () => {
    expect(grid.rows).toHaveLength(5);
    expect(grid.rows[0]).toHaveLength(7);
  });

  it('gets cheaper as the sale price rises and dearer as the rate rises', () => {
    const weakSaleLowRate = grid.rows[0][0].breakdown.totalMonthly;
    const strongSaleLowRate = grid.rows[4][0].breakdown.totalMonthly;
    const weakSaleHighRate = grid.rows[0][6].breakdown.totalMonthly;
    expect(strongSaleLowRate).toBeLessThan(weakSaleLowRate);
    expect(weakSaleHighRate).toBeGreaterThan(weakSaleLowRate);
  });

  it('brackets the payment range across both axes', () => {
    expect(grid.min).toBeCloseTo(grid.rows[4][0].breakdown.totalMonthly, 6);
    expect(grid.max).toBeCloseTo(grid.rows[0][6].breakdown.totalMonthly, 6);
  });
});

describe('maxAffordablePrice', () => {
  const monthlyAt = (price: number, cash: number, rate: number) =>
    computePayment(price, cash, rate, costs, terms).totalMonthly;

  it('lands just under the target, and one step more exceeds it', () => {
    const cash = 220_000;
    const target = 3_200;
    const max = maxAffordablePrice(target, cash, 6.75, costs, terms);
    expect(monthlyAt(max, cash, 6.75)).toBeLessThanOrEqual(target);
    expect(monthlyAt(max + 5_000, cash, 6.75)).toBeGreaterThan(target);
  });

  it('buys less house at a higher rate', () => {
    const cash = 220_000;
    const at6 = maxAffordablePrice(3_200, cash, 6, costs, terms);
    const at75 = maxAffordablePrice(3_200, cash, 7.5, costs, terms);
    expect(at75).toBeLessThan(at6);
  });

  it('buys more house with more cash down', () => {
    const lean = maxAffordablePrice(3_200, 150_000, 6.75, costs, terms);
    const flush = maxAffordablePrice(3_200, 300_000, 6.75, costs, terms);
    expect(flush).toBeGreaterThan(lean);
  });

  it('returns 0 when even a trivial house blows the budget', () => {
    const tinyBudget = maxAffordablePrice(10, 0, 6.75, costs, terms);
    expect(tinyBudget).toBe(0);
  });

  it('buys more house under a fixed tax bill than a percent that scales with price', () => {
    // At a $650k+ purchase, 1.1% runs well above a flat $4,000 bill, so the fixed
    // mode should leave more room in the same budget.
    const fixed: HouseCosts = { ...costs, taxMode: 'fixed', taxAnnual: 4_000 };
    const cash = 220_000;
    const pct = maxAffordablePrice(3_200, cash, 6.75, costs, terms);
    const flat = maxAffordablePrice(3_200, cash, 6.75, fixed, terms);
    expect(flat).toBeGreaterThan(pct);
    expect(
      computePayment(flat, cash, 6.75, fixed, terms).totalMonthly,
    ).toBeLessThanOrEqual(3_200);
    expect(
      computePayment(flat + 5_000, cash, 6.75, fixed, terms).totalMonthly,
    ).toBeGreaterThan(3_200);
  });

  it('stays correct across the PMI cliff', () => {
    // Enough cash that the answer sits near the 20%-down boundary.
    const cash = 180_000;
    const target = 4_000;
    const max = maxAffordablePrice(target, cash, 6.75, costs, terms);
    expect(monthlyAt(max, cash, 6.75)).toBeLessThanOrEqual(target);
    expect(monthlyAt(max + 5_000, cash, 6.75)).toBeGreaterThan(target);
  });
});
