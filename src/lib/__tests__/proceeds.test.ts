import { describe, it, expect } from 'vitest';
import { computeProceeds, computeDownPayment, type SaleAssumptions } from '../proceeds';

const base: SaleAssumptions = {
  payoff: 560_000,
  commissionPct: 6,
  sellerClosingPct: 0,
  concessions: 0,
  cashHeldBack: 0,
  extraSavings: 0,
};

describe('computeProceeds', () => {
  it('matches the cheat-sheet numbers at 6% commission', () => {
    expect(computeProceeds(800_000, base).netProceeds).toBeCloseTo(192_000, 0);
    expect(computeProceeds(850_000, base).netProceeds).toBeCloseTo(239_000, 0);
    expect(computeProceeds(900_000, base).netProceeds).toBeCloseTo(286_000, 0);
  });

  it('nets about $23.5k more for each extra $25k of sale price', () => {
    const a = computeProceeds(825_000, base).netProceeds;
    const b = computeProceeds(850_000, base).netProceeds;
    expect(b - a).toBeCloseTo(23_500, 0);
  });

  it('subtracts seller closing costs and concessions', () => {
    const r = computeProceeds(850_000, {
      ...base,
      sellerClosingPct: 1,
      concessions: 5_000,
    });
    expect(r.sellerClosing).toBeCloseTo(8_500, 6);
    expect(r.netProceeds).toBeCloseTo(239_000 - 8_500 - 5_000, 0);
  });

  it('separates net proceeds from cash actually brought to the next closing', () => {
    const r = computeProceeds(850_000, { ...base, cashHeldBack: 25_000, extraSavings: 10_000 });
    expect(r.netProceeds).toBeCloseTo(239_000, 0);
    expect(r.cashToClose).toBeCloseTo(224_000, 0);
  });

  it('goes negative when the payoff exceeds what the sale nets', () => {
    const r = computeProceeds(500_000, base);
    expect(r.netProceeds).toBeLessThan(0);
  });
});

describe('computeDownPayment', () => {
  it('takes buyer closing costs off the top', () => {
    const r = computeDownPayment(700_000, 2.5, 239_000);
    expect(r.buyerClosingCosts).toBeCloseTo(17_500, 6);
    expect(r.downPayment).toBeCloseTo(221_500, 6);
    expect(r.isShort).toBe(false);
  });

  it('reports a shortfall instead of a phantom payment', () => {
    const r = computeDownPayment(700_000, 2.5, 10_000);
    expect(r.isShort).toBe(true);
    expect(r.shortfall).toBeCloseTo(7_500, 6);
    expect(r.downPayment).toBe(0);
  });

  it('caps at the purchase price when you could pay cash', () => {
    const r = computeDownPayment(400_000, 2.5, 600_000);
    expect(r.downPayment).toBe(400_000);
    expect(r.surplus).toBeCloseTo(190_000, 6);
  });
});
