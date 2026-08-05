import { describe, it, expect } from 'vitest';
import { monthlyPI, remainingBalance, type HouseCosts } from '../mortgage';
import {
  runStrategy,
  runAllStrategies,
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
  maintenanceMode: 'percent',
  maintenancePct: 0,
  maintenanceAnnual: 0,
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
    moveYears: [10],
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
      { kind: 'stay' },
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
    const r = runStrategy({ kind: 'stay' }, baseInput());
    expect(r.finalPortfolio).toBeCloseTo(0, 6);
    expect(r.finalEquity).toBeCloseTo(500_000, 6);
    expect(r.finalNet).toBeCloseTo(500_000, 6);
    expect(r.moveMonth).toBeNull();
  });

  it('appreciation compounds into equity', () => {
    const r = runStrategy(
      { kind: 'stay' },
      baseInput({ current: { ...freeHome(500_000), appreciationPct: 3 }, horizonYears: 10 }),
    );
    expect(r.finalEquity).toBeCloseTo(500_000 * Math.pow(1 + 0.03 / 12, 120), 2);
  });

  it('net position equals equity minus cash paid, when nothing earns a return', () => {
    const r = runStrategy(
      { kind: 'stay' },
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
    const r = runStrategy({ kind: 'stay' }, baseInput({ horizonYears: 30 }));
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
    const stay = runStrategy({ kind: 'stay' }, input);
    const sell = runStrategy({ kind: 'sellNow' }, input);

    const friction = 500_000 * 0.06 + 500_000 * 0.01 + 400_000 * 0.02;
    expect(sell.totalTransactionCosts).toBeCloseTo(friction, 6);
    expect(stay.finalNet - sell.finalNet).toBeCloseTo(friction, 4);
  });

  it('buys the next house at its appreciated price on a delayed move', () => {
    const input = baseInput({
      next: { ...freeHome(400_000), appreciationPct: 3 },
      horizonYears: 11,
    });
    const r = runStrategy({ kind: 'stayThenMove', moveInYears: 10 }, input);
    expect(r.moveMonth).toBe(120);
    // Bought at 120 months of monthly-compounded appreciation, then the move
    // month's own appreciation lands before the year-10 point is recorded.
    const monthly = 1 + 0.03 / 12;
    expect(r.points[10].homeValue).toBeCloseTo(400_000 * Math.pow(monthly, 121), 0);
  });

  it('takes on a loan when proceeds fall short of the next price', () => {
    const r = runStrategy(
      { kind: 'sellNow' },
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
      horizonYears: 6,
      current: freeHome(100_000), // small proceeds, so a real loan is taken
    });
    const spec = { kind: 'stayThenMove' as const, moveInYears: 5 };
    const later = runStrategy(spec, input);
    const cheaper = runStrategy(spec, { ...input, rateLaterPct: 4 });
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
    const r = runStrategy({ kind: 'stay' }, baseInput({ expenses: [roof] }));
    expect(r.totalExpenses).toBe(20_000);
  });

  it('spares a strategy that already sold before the expense lands', () => {
    // Sold at month 0, so a 2036 bill on the current house never arrives.
    const r = runStrategy({ kind: 'sellNow' }, baseInput({ expenses: [roof] }));
    expect(r.totalExpenses).toBe(0);
  });

  it('still charges a delayed move that has not sold yet', () => {
    const r = runStrategy(
      { kind: 'stayThenMove', moveInYears: 20 },
      baseInput({ expenses: [roof] }), // sells in 2046, roof due 2036
    );
    expect(r.totalExpenses).toBe(20_000);
  });

  it('follows the next house when the expense is tagged to it', () => {
    const nextRoof = { ...roof, appliesTo: 'next' as const };
    expect(runStrategy({ kind: 'stay' }, baseInput({ expenses: [nextRoof] })).totalExpenses).toBe(0);
    expect(runStrategy({ kind: 'sellNow' }, baseInput({ expenses: [nextRoof] })).totalExpenses).toBe(20_000);
  });

  it('charges either property when tagged to both', () => {
    const either = { ...roof, appliesTo: 'both' as const };
    expect(runStrategy({ kind: 'stay' }, baseInput({ expenses: [either] })).totalExpenses).toBe(20_000);
    expect(runStrategy({ kind: 'sellNow' }, baseInput({ expenses: [either] })).totalExpenses).toBe(20_000);
  });

  it('ignores an expense dated past the horizon', () => {
    const far = { ...roof, year: 2200 };
    expect(runStrategy({ kind: 'stay' }, baseInput({ expenses: [far] })).totalExpenses).toBe(0);
  });

  it('lands in the year point stamped with its own year', () => {
    const r = runStrategy({ kind: 'stay' }, baseInput({ expenses: [roof] }));
    const charged = r.points.filter((pt) => pt.expenses > 0);
    expect(charged).toHaveLength(1);
    expect(charged[0].year).toBe(2036);
  });

  it('charges an expense dated in the past right away rather than losing it', () => {
    const overdue = { ...roof, year: 2020 };
    const r = runStrategy({ kind: 'stay' }, baseInput({ expenses: [overdue] }));
    expect(r.totalExpenses).toBe(20_000);
    expect(r.points[1].expenses).toBe(20_000);
  });
});

describe('property tax mode', () => {
  const taxed = (costs: HouseCosts, extra: Partial<ProjectionInputs> = {}) =>
    runStrategy(
      { kind: 'stay' },
      baseInput({
        current: { ...freeHome(500_000), appreciationPct: 5, costs },
        horizonYears: 20,
        ...extra,
      }),
    ).totalEscrow;

  it('rides the home value up in percent mode', () => {
    const flat = taxed({ ...freeCosts, taxRatePct: 1 });
    const appreciating = runStrategy(
      { kind: 'stay' },
      baseInput({
        current: { ...freeHome(500_000), appreciationPct: 0, costs: { ...freeCosts, taxRatePct: 1 } },
        horizonYears: 20,
      }),
    ).totalEscrow;
    // Same rate, but a home worth more each year owes more each year.
    expect(flat).toBeGreaterThan(appreciating);
  });

  it('ignores the home value entirely in fixed mode', () => {
    const costs: HouseCosts = { ...freeCosts, taxMode: 'fixed', taxAnnual: 6_000, taxRatePct: 1 };
    const appreciatingFast = taxed(costs);
    const notAppreciating = runStrategy(
      { kind: 'stay' },
      baseInput({
        current: { ...freeHome(500_000), appreciationPct: 0, costs },
        horizonYears: 20,
      }),
    ).totalEscrow;
    expect(appreciatingFast).toBeCloseTo(notAppreciating, 6);
  });

  it('holds a fixed bill exactly flat when cost inflation is zero', () => {
    const costs: HouseCosts = { ...freeCosts, taxMode: 'fixed', taxAnnual: 6_000 };
    const r = runStrategy(
      { kind: 'stay' },
      baseInput({
        current: { ...freeHome(500_000), appreciationPct: 5, costs },
        costInflationPct: 0,
        horizonYears: 10,
      }),
    );
    expect(r.totalEscrow).toBeCloseTo(6_000 * 10, 4);
  });

  it('drifts a fixed bill upward with cost inflation', () => {
    const costs: HouseCosts = { ...freeCosts, taxMode: 'fixed', taxAnnual: 6_000 };
    const r = runStrategy(
      { kind: 'stay' },
      baseInput({ current: { ...freeHome(500_000), costs }, costInflationPct: 3, horizonYears: 10 }),
    );
    expect(r.totalEscrow).toBeGreaterThan(6_000 * 10);
    expect(r.totalEscrow).toBeLessThan(6_000 * 10 * 1.35);
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
    const sell = runStrategy({ kind: 'sellNow' }, input);
    // 200k of surplus proceeds sit in the portfolio and compound.
    expect(sell.finalPortfolio).toBeGreaterThan(200_000 * 2);
  });

  it('collapses to plain cash-flow accounting at a zero return', () => {
    const input = baseInput({
      currentLoan: { balance: 200_000, ratePct: 6, remainingYears: 30 },
      investmentReturnPct: 0,
      horizonYears: 15,
    });
    const r = runStrategy({ kind: 'stay' }, input);
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
    const stay = runStrategy({ kind: 'stay' }, input);
    const sell = runStrategy({ kind: 'sellNow' }, input);
    const crossings = crossoverYears(stay, sell);
    // Selling starts behind by the commission, then the faster-appreciating
    // house catches up — exactly one crossing.
    expect(crossings).toHaveLength(1);
    expect(crossings[0]).toBeGreaterThan(0);
    expect(crossings[0]).toBeLessThan(30);
  });

  it('reports nothing when the lines never meet', () => {
    const input = baseInput({ commissionPct: 6, horizonYears: 30 });
    const stay = runStrategy({ kind: 'stay' }, input);
    const sell = runStrategy({ kind: 'sellNow' }, input);
    expect(crossoverYears(stay, sell)).toEqual([]);
  });

  it('is empty against itself', () => {
    const stay = runStrategy({ kind: 'stay' }, baseInput());
    expect(crossoverYears(stay, stay)).toEqual([]);
  });
});

describe('upkeep mode', () => {
  const withUpkeep = (over: Partial<HomeProfile>) =>
    baseInput({
      current: { ...freeHome(500_000), appreciationPct: 5, ...over },
      horizonYears: 10,
    });

  it('percent mode rides the home’s value up', () => {
    const r = runStrategy({ kind: 'stay' }, withUpkeep({ maintenancePct: 1 }));
    // 1% of a house appreciating at 5% must exceed ten flat years of 1% of today's.
    expect(r.totalMaintenance).toBeGreaterThan(500_000 * 0.01 * 10);
  });

  it('fixed mode ignores the home’s value entirely', () => {
    const cheap = runStrategy(
      { kind: 'stay' },
      withUpkeep({ maintenanceMode: 'fixed', maintenanceAnnual: 6_000 }),
    );
    const pricey = runStrategy(
      { kind: 'stay' },
      baseInput({
        current: {
          ...freeHome(2_000_000),
          appreciationPct: 5,
          maintenanceMode: 'fixed',
          maintenanceAnnual: 6_000,
        },
        horizonYears: 10,
      }),
    );
    expect(cheap.totalMaintenance).toBeCloseTo(pricey.totalMaintenance, 6);
  });

  it('a fixed budget is exactly flat when cost inflation is zero', () => {
    const r = runStrategy(
      { kind: 'stay' },
      withUpkeep({ maintenanceMode: 'fixed', maintenanceAnnual: 6_000 }),
    );
    expect(r.totalMaintenance).toBeCloseTo(60_000, 6);
  });

  it('a fixed budget drifts up with cost inflation', () => {
    const r = runStrategy(
      { kind: 'stay' },
      {
        ...withUpkeep({ maintenanceMode: 'fixed', maintenanceAnnual: 6_000 }),
        costInflationPct: 3,
      },
    );
    expect(r.totalMaintenance).toBeGreaterThan(60_000);
    expect(r.totalMaintenance).toBeLessThan(75_000);
  });
});

describe('several move plans at once', () => {
  const input = baseInput({
    moveYears: [10, 5],
    commissionPct: 6,
    current: freeHome(500_000),
    next: freeHome(500_000),
    horizonYears: 30,
  });

  it('runs one strategy per move year, in chronological order', () => {
    const all = runAllStrategies(input);
    expect(all.map((r) => r.id)).toEqual(['stay', 'sellNow', 'move-5', 'move-10']);
    expect(all[2].moveMonth).toBe(60);
    expect(all[3].moveMonth).toBe(120);
  });

  it('drops duplicates and anything past the horizon', () => {
    const all = runAllStrategies({ ...input, moveYears: [5, 5, 40, 0, -3] });
    expect(all.map((r) => r.id)).toEqual(['stay', 'sellNow', 'move-5']);
  });

  it('leaves every plan identical to staying put until it moves', () => {
    const [stay, , five, ten] = runAllStrategies(input);
    // Year 4: neither has moved, so both must sit exactly on the baseline.
    expect(five.points[4].netPosition).toBeCloseTo(stay.points[4].netPosition, 6);
    expect(ten.points[4].netPosition).toBeCloseTo(stay.points[4].netPosition, 6);
    // Year 7: the five-year plan has paid its commission, the ten-year one hasn't.
    expect(five.points[7].netPosition).toBeLessThan(stay.points[7].netPosition);
    expect(ten.points[7].netPosition).toBeCloseTo(stay.points[7].netPosition, 6);
  });
});

describe('year-by-year flows', () => {
  const input = baseInput({
    currentLoan: { balance: 400_000, ratePct: 6, remainingYears: 30 },
    current: { ...freeHome(500_000), maintenancePct: 1 },
    horizonYears: 30,
  });

  it('sums to the horizon totals', () => {
    const r = runStrategy({ kind: 'stay' }, input);
    const sum = (f: (pt: (typeof r.points)[number]) => number) =>
      r.points.reduce((a, pt) => a + f(pt), 0);
    expect(sum((pt) => pt.interestPaid)).toBeCloseTo(r.totalInterest, 4);
    expect(sum((pt) => pt.principalPaid)).toBeCloseTo(r.totalPrincipal, 4);
    expect(sum((pt) => pt.maintenance)).toBeCloseTo(r.totalMaintenance, 4);
    expect(sum((pt) => pt.cashOut)).toBeCloseTo(r.totalOut, 4);
  });

  it('shows interest falling and principal rising, year over year', () => {
    const r = runStrategy({ kind: 'stay' }, input);
    for (let k = 2; k < r.points.length; k++) {
      expect(r.points[k].interestPaid).toBeLessThan(r.points[k - 1].interestPaid);
      expect(r.points[k].principalPaid).toBeGreaterThan(r.points[k - 1].principalPaid);
    }
  });

  it('charges the move year with the transaction costs, and no other year', () => {
    const r = runStrategy(
      { kind: 'stayThenMove', moveInYears: 10 },
      { ...input, commissionPct: 6 },
    );
    const charged = r.points.filter((pt) => pt.transactionCosts > 0);
    expect(charged).toHaveLength(1);
    expect(charged[0].monthsElapsed).toBe(120);
    expect(charged[0].transactionCosts).toBeCloseTo(r.totalTransactionCosts, 6);
  });

  it('puts a sell-now plan’s fees in year one', () => {
    const r = runStrategy({ kind: 'sellNow' }, { ...input, commissionPct: 6 });
    expect(r.points[0].transactionCosts).toBe(0);
    expect(r.points[1].transactionCosts).toBeCloseTo(r.totalTransactionCosts, 6);
  });
});
