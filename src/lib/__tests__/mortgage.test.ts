import { describe, it, expect } from 'vitest';
import { monthlyPI, pmiDropoffMonth, computePayment, type HouseCosts, type LoanTerms } from '../mortgage';

const noCosts: HouseCosts = { taxRatePct: 0, insuranceAnnual: 0, hoaMonthly: 0 };
const noExtras: LoanTerms = { termYears: 30, pmiRatePct: 0, buyerClosingPct: 0 };

describe('monthlyPI', () => {
  // Anchored to published amortization tables — a wrong formula fails silently otherwise.
  it('matches known 30-year values', () => {
    expect(monthlyPI(400_000, 6.75, 30)).toBeCloseTo(2594.39, 1);
    expect(monthlyPI(500_000, 6.0, 30)).toBeCloseTo(2997.75, 1);
    expect(monthlyPI(300_000, 7.0, 30)).toBeCloseTo(1995.91, 1);
  });

  it('matches a known 15-year value', () => {
    expect(monthlyPI(400_000, 6.0, 15)).toBeCloseTo(3375.43, 1);
  });

  it('handles a zero rate as straight-line principal', () => {
    expect(monthlyPI(360_000, 0, 30)).toBeCloseTo(1000, 6);
  });

  it('returns 0 for a non-positive principal', () => {
    expect(monthlyPI(0, 6.5, 30)).toBe(0);
    expect(monthlyPI(-5000, 6.5, 30)).toBe(0);
  });
});

describe('pmiDropoffMonth', () => {
  it('returns null when the loan starts at or under 80% LTV', () => {
    expect(pmiDropoffMonth(400_000, 500_000, 6.75, 30)).toBeNull();
    expect(pmiDropoffMonth(399_000, 500_000, 6.75, 30)).toBeNull();
  });

  it('finds the month the balance crosses 78% of the purchase price', () => {
    // $475k on a $500k house at 6.75% -> 95% LTV, needs to amortize to $390k.
    const month = pmiDropoffMonth(475_000, 500_000, 6.75, 30);
    expect(month).not.toBeNull();
    expect(month!).toBeGreaterThan(60);
    expect(month!).toBeLessThan(360);
  });

  it('drops off sooner at a lower rate, where more of each payment is principal', () => {
    const slow = pmiDropoffMonth(450_000, 500_000, 7.5, 30)!;
    const fast = pmiDropoffMonth(450_000, 500_000, 5.0, 30)!;
    expect(fast).toBeLessThan(slow);
  });
});

describe('computePayment', () => {
  it('reproduces the napkin math when closing costs are switched off', () => {
    // $850k sale, 6% commission, $560k payoff -> ~$239k cash.
    // A $700k house should finance ~$461k at ~$2,990/mo P&I at 6.75%.
    const cashToClose = 850_000 - 850_000 * 0.06 - 560_000;
    const r = computePayment(700_000, cashToClose, 6.75, noCosts, noExtras);
    expect(cashToClose).toBeCloseTo(239_000, 0);
    expect(r.loan).toBeCloseTo(461_000, 0);
    expect(r.principalAndInterest).toBeCloseTo(2990, 0);
    expect(r.pmiApplies).toBe(false);
  });

  it('stacks tax, insurance, and HOA on top of P&I', () => {
    const costs: HouseCosts = { taxRatePct: 1.2, insuranceAnnual: 2400, hoaMonthly: 75 };
    const r = computePayment(600_000, 200_000, 6.5, costs, noExtras);
    expect(r.propertyTax).toBeCloseTo(600, 6); // 600k * 1.2% / 12
    expect(r.insurance).toBeCloseTo(200, 6);
    expect(r.hoa).toBe(75);
    expect(r.totalMonthly).toBeCloseTo(r.principalAndInterest + 600 + 200 + 75, 6);
  });

  it('charges PMI only above 80% LTV', () => {
    const terms: LoanTerms = { termYears: 30, pmiRatePct: 0.6, buyerClosingPct: 0 };
    const exactly20 = computePayment(500_000, 100_000, 6.75, noCosts, terms);
    expect(exactly20.ltv).toBeCloseTo(0.8, 6);
    expect(exactly20.pmiApplies).toBe(false);
    expect(exactly20.pmi).toBe(0);

    const justUnder = computePayment(500_000, 99_000, 6.75, noCosts, terms);
    expect(justUnder.pmiApplies).toBe(true);
    expect(justUnder.pmi).toBeCloseTo((401_000 * 0.006) / 12, 6);
    expect(justUnder.pmiDropoffMonth).not.toBeNull();
  });

  it('subtracts buyer closing costs from the down payment', () => {
    const terms: LoanTerms = { termYears: 30, pmiRatePct: 0.5, buyerClosingPct: 2.5 };
    const r = computePayment(700_000, 239_000, 6.75, noCosts, terms);
    expect(r.buyerClosingCosts).toBeCloseTo(17_500, 6);
    expect(r.downPayment).toBeCloseTo(221_500, 6);
    expect(r.loan).toBeCloseTo(478_500, 6);
    // The naive model would have shown a $461k loan — $17.5k too optimistic.
  });

  it('flags a purchase the cash cannot cover', () => {
    const terms: LoanTerms = { termYears: 30, pmiRatePct: 0.5, buyerClosingPct: 3 };
    const r = computePayment(800_000, 10_000, 6.75, noCosts, terms);
    expect(r.isShort).toBe(true);
    expect(r.shortfall).toBeCloseTo(14_000, 6); // 24k of costs against 10k of cash
    expect(r.downPayment).toBe(0);
  });

  it('caps the down payment at the purchase price and reports the surplus', () => {
    const r = computePayment(300_000, 500_000, 6.75, noCosts, noExtras);
    expect(r.downPayment).toBe(300_000);
    expect(r.loan).toBe(0);
    expect(r.principalAndInterest).toBe(0);
    expect(r.surplus).toBeCloseTo(200_000, 6);
  });

  it('computes lifetime interest consistent with the payment', () => {
    const r = computePayment(500_000, 100_000, 6.0, noCosts, noExtras);
    expect(r.lifetimeInterest).toBeCloseTo(r.principalAndInterest * 360 - 400_000, 4);
  });
});
