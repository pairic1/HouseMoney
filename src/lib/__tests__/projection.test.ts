import { describe, it, expect } from 'vitest';
import { monthlyPI, remainingBalance, type HouseCosts } from '../mortgage';
import {
  runStrategy,
  crossoverYears,
  type ProjectionInputs,
  type HomeProfile,
} from '../projection';

const freeCosts: HouseCosts = {
  taxMode: 'percent',
  taxRatePct: 0,
  taxAnnual: 0,
  insuranceAnnual: 0,
  hoaMonthly: 0,
};

const freeHome = (value: number): HomeProfile => ({
  value,
  appreciationPct: 0,
  costs: freeCosts,
  maintenancePct: 0,
});

/** Everything switched off, so each test can turn on exactly one thing. */
function baseInput(over: Partial<ProjectionInputs> = {}): ProjectionInputs {
  return {
    startYear: 2026,
    horizonYears: 30,
    current: freeHome(500_000),
    currentLoan: { balance: 0, ratePct: 0, remainingYears: 30 },
    next: freeHome(500_000),
    rateNowPct: 0,
    rateLaterPct: 0,
    newLoanTermYears: 30,
    moveInYears: 10,
    investmentReturnPct: 0,
    costInflationPct: 0,
    commissionPct: 0,
    sellerClosingPct: 0,
    buyerClosingPct: 0,
    pmiRatePct: 0,
    cashHeldBack: 0,
    expenses: [],
    ...over,
  };
}

describe('remainingBalance', () => {
  it('agrees with a month-by-month amortization loop', () => {
    const L = 400_000;
    const rate = 6.75;
    const years = 30;
    const payment = monthlyPI(L, rate, years);
    const i = rate / 100 / 12;

    let balance = L;
    for (let m = 1; m <= 120; m++) {
      balance = balance + balance * i - payment;
    }
    expect(remainingBalance(L, rate, years, 120)).toBeCloseTo(balance, 4);
  });

  it('reaches zero at the end of the term', () => {
    expect(remainingBalance(400_000, 6.75, 30, 360)).toBe(0);
    expect(remainingBalance(400_000, 6.75, 30, 359)).toBeGreaterThan(0);
  });

  it('handles the edges', () => {
    expect(remainingBalance(400_000, 6.75, 30, 0)).toBe(400_000);
    expect(remainingBalance(0, 6.75, 30, 12)).toBe(0);
    expect(remainingBalance(360_000, 0, 30, 180)).toBeCloseTo(180_000, 6);
  });
});

describe('cross-check against Home Investments.xlsx', () => {
  // Majestic Lane, no-extra-payment column: $595,350 financed, P&I $3,617.41,
  // total interest $706,917.37 over the full 360 months. The sheet displays the
  // rate as 6%, but the payment it carries implies 6.125% — that rounding is the
  // only reason these land a few cents apart.
  const loan = 595_350;
  const rate = 6.125;

  it('reproduces the payment on the sheet', () => {
    expect(monthlyPI(loan, rate, 30)).toBeCloseTo(3617.41, 2);
  });

  it('reproduces its total interest and principal over the full term', () => {
    const r = runStrategy(
      'stay',
      baseInput({
        current: freeHome(661_500),
        currentLoan: { balance: loan, ratePct: rate, remainingYears: 30 },
        horizonYears: 30,
      }),
    );
    expect(r.totalInterest).toBeCloseTo(706_917.37, -1); // sheet value, within $10
    expect(r.totalPrincipal).toBeCloseTo(loan, 0);
    expect(r.points[r.points.length - 1].loanBalance).toBeCloseTo(0, 4);
  });
});

describe('runStrategy — accounting identities', () => {
  it('with everything off, staying put just holds the house', () => {
    const r = runStrategy('stay', baseInput());
    expect(r.finalPortfolio).toBeCloseTo(0, 6);
    expect(r.finalEquity).toBeCloseTo(500_000, 6);
    expect(r.finalNet).toBeCloseTo(500_000, 6);
    expect(r.moveMonth).toBeNull();
  });

  it('appreciation compounds into equity', () => {
    const r = runStrategy(
      'stay',
      baseInput({ current: { ...freeHome(500_000), appreciationPct: 3 }, horizonYears: 10 }),
    );
    expect(r.finalEquity).toBeCloseTo(500_000 * Math.pow(1 + 0.03 / 12, 120), 2);
  });

  it('net position equals equity minus cash paid, when nothing earns a return', () => {
    const r = runStrategy(
      'stay',
      baseInput({
        currentLoan: { balance: 300_000, ratePct: 6, remainingYears: 30 },
        current: { ...freeHome(500_000), maintenancePct: 1 },
        horizonYears: 10,
      }),
    );
    const cashPaid = r.totalHousingCash;
    expect(r.finalNet).toBeCloseTo(r.finalEquity - cashPaid, 4);
  });

  it('records one year point per year plus the starting point', () => {
    const r = runStrategy('stay', baseInput({ horizonYears: 30 }));
    expect(r.points).toHaveLength(31);
    expect(r.points[0].monthsElapsed).toBe(0);
    expect(r.points[30].monthsElapsed).toBe(360);
    expect(r.points[30].year).toBe(2056);
  });
});

describe('runStrategy — moving', () => {
  it('costs exactly the transaction friction when nothing else differs', () => {
    // Own outright, buy something cheaper so the proceeds fully cover it, and
    // switch off every other moving part. The gap should be the fees alone.
    const input = baseInput({
      current: freeHome(500_000),
      next: freeHome(400_000),
      commissionPct: 6,
      sellerClosingPct: 1,
      buyerClosingPct: 2,
      horizonYears: 1,
    });
    const stay = runStrategy('stay', input);
    const sell = runStrategy('sellNow', input);

    const friction = 500_000 * 0.06 + 500_000 * 0.01 + 400_000 * 0.02;
    expect(sell.totalTransactionCosts).toBeCloseTo(friction, 6);
    expect(stay.finalNet - sell.finalNet).toBeCloseTo(friction, 4);
  });

  it('buys the next house at its appreciated price on a delayed move', () => {
    const input = baseInput({
      next: { ...freeHome(400_000), appreciationPct: 3 },
      moveInYears: 10,
      horizonYears: 11,
    });
    const r = runStrategy('stayThenMove', input);
    expect(r.moveMonth).toBe(120);
    // Bought at 120 months of monthly-compounded appreciation, then the move
    // month's own appreciation lands before the year-10 point is recorded.
    const monthly = 1 + 0.03 / 12;
    expect(r.points[10].homeValue).toBeCloseTo(400_000 * Math.pow(monthly, 121), 0);
  });

  it('takes on a loan when proceeds fall short of the next price', () => {
    const r = runStrategy(
      'sellNow',
      baseInput({
        current: freeHome(500_000),
        currentLoan: { balance: 400_000, ratePct: 6, remainingYears: 30 },
        next: freeHome(600_000),
        rateNowPct: 7,
        commissionPct: 6,
      }),
    );
    // 500k − 30k commission − 400k payoff = 70k of proceeds against a 600k house.
    expect(r.points[0].loanBalance).toBeCloseTo(530_000, 0);
    expect(r.totalInterest).toBeGreaterThan(0);
  });

  it('applies the later rate to a delayed move, not today’s', () => {
    const input = baseInput({
      next: freeHome(400_000),
      rateNowPct: 5,
      rateLaterPct: 8,
      moveInYears: 5,
      horizonYears: 6,
      current: freeHome(100_000), // small proceeds, so a real loan is taken
    });
    const later = runStrategy('stayThenMove', input);
    const cheaper = runStrategy('stayThenMove', { ...input, rateLaterPct: 4 });
    expect(later.totalInterest).toBeGreaterThan(cheaper.totalInterest);
  });
});

describe('planned expenses', () => {
  const roof = {
    id: 'r1',
    label: 'Roof',
    year: 2036,
    amount: 20_000,
    appliesTo: 'current' as const,
  };

  it('charges the strategy that still owns the property', () => {
    const r = runStrategy('stay', baseInput({ expenses: [roof] }));
    expect(r.totalExpenses).toBe(20_000);
  });

  it('spares a strategy that already sold before the expense lands', () => {
    // Sold at month 0, so a 2036 bill on the current house never arrives.
    const r = runStrategy('sellNow', baseInput({ expenses: [roof] }));
    expect(r.totalExpenses).toBe(0);
  });

  it('still charges a delayed move that has not sold yet', () => {
    const r = runStrategy(
      'stayThenMove',
      baseInput({ expenses: [roof], moveInYears: 20 }), // sells in 2046, roof due 2036
    );
    expect(r.totalExpenses).toBe(20_000);
  });

  it('follows the next house when the expense is tagged to it', () => {
    const nextRoof = { ...roof, appliesTo: 'next' as const };
    expect(runStrategy('stay', baseInput({ expenses: [nextRoof] })).totalExpenses).toBe(0);
    expect(runStrategy('sellNow', baseInput({ expenses: [nextRoof] })).totalExpenses).toBe(20_000);
  });

  it('charges either property when tagged to both', () => {
    const either = { ...roof, appliesTo: 'both' as const };
    expect(runStrategy('stay', baseInput({ expenses: [either] })).totalExpenses).toBe(20_000);
    expect(runStrategy('sellNow', baseInput({ expenses: [either] })).totalExpenses).toBe(20_000);
  });

  it('ignores an expense dated past the horizon', () => {
    const far = { ...roof, year: 2200 };
    expect(runStrategy('stay', baseInput({ expenses: [far] })).totalExpenses).toBe(0);
  });
});

describe('investment return', () => {
  it('rewards the strategy that keeps cash liquid', () => {
    const input = baseInput({
      current: freeHome(500_000),
      next: freeHome(300_000),
      investmentReturnPct: 6,
      horizonYears: 20,
    });
    const sell = runStrategy('sellNow', input);
    // 200k of surplus proceeds sit in the portfolio and compound.
    expect(sell.finalPortfolio).toBeGreaterThan(200_000 * 2);
  });

  it('collapses to plain cash-flow accounting at a zero return', () => {
    const input = baseInput({
      currentLoan: { balance: 200_000, ratePct: 6, remainingYears: 30 },
      investmentReturnPct: 0,
      horizonYears: 15,
    });
    const r = runStrategy('stay', input);
    expect(r.finalPortfolio).toBeCloseTo(-r.totalHousingCash, 4);
  });
});

describe('crossoverYears', () => {
  it('finds the year one strategy overtakes another', () => {
    const input = baseInput({
      current: { ...freeHome(500_000), appreciationPct: 2 },
      next: { ...freeHome(500_000), appreciationPct: 6 },
      commissionPct: 6,
      horizonYears: 30,
    });
    const stay = runStrategy('stay', input);
    const sell = runStrategy('sellNow', input);
    const crossings = crossoverYears(stay, sell);
    // Selling starts behind by the commission, then the faster-appreciating
    // house catches up — exactly one crossing.
    expect(crossings).toHaveLength(1);
    expect(crossings[0]).toBeGreaterThan(0);
    expect(crossings[0]).toBeLessThan(30);
  });

  it('reports nothing when the lines never meet', () => {
    const input = baseInput({ commissionPct: 6, horizonYears: 30 });
    const stay = runStrategy('stay', input);
    const sell = runStrategy('sellNow', input);
    expect(crossoverYears(stay, sell)).toEqual([]);
  });

  it('is empty against itself', () => {
    const stay = runStrategy('stay', baseInput());
    expect(crossoverYears(stay, stay)).toEqual([]);
  });
});
