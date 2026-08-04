/**
 * Long-run comparison: stay put, sell now, or stay a while and then move.
 *
 * Every strategy runs the same monthly loop over two accounts — a liquid
 * `portfolio` and a house. Housing costs are paid out of the portfolio, sale
 * proceeds land in it, and it compounds at the investment return rate. That
 * makes opportunity cost fall out of the accounting instead of being bolted on:
 * money not tied up in a house is visibly earning something.
 *
 *   net position = portfolio + (home value − loan balance)
 *
 * The portfolio starts at zero for every strategy and is free to go negative —
 * only the differences between strategies carry meaning, and a negative balance
 * simply reads as cumulative net cost. Set the return rate to zero and the whole
 * thing collapses to plain cash-flow accounting.
 */

import {
  monthlyPI,
  monthlyPropertyTax,
  pmiDropoffMonth,
  type HouseCosts,
} from './mortgage';
import { computeDownPayment, computeProceeds } from './proceeds';

export type StrategyKind = 'stay' | 'sellNow' | 'stayThenMove';
export type PropertyRef = 'current' | 'next' | 'both';

export interface HomeProfile {
  /** Today's market value (current home) or today's asking price (next home). */
  value: number;
  appreciationPct: number;
  costs: HouseCosts;
  /** Routine upkeep as a percent of value per year — the "1% rule". */
  maintenancePct: number;
}

export interface CurrentLoan {
  balance: number;
  ratePct: number;
  remainingYears: number;
}

export interface PlannedExpense {
  id: string;
  label: string;
  /** Calendar year the money goes out. */
  year: number;
  amount: number;
  appliesTo: PropertyRef;
}

export interface ProjectionInputs {
  startYear: number;
  horizonYears: number;

  current: HomeProfile;
  currentLoan: CurrentLoan;
  next: HomeProfile;

  /** Rate on a loan taken today. */
  rateNowPct: number;
  /** Rate on a loan taken at the delayed move — the biggest unknown here. */
  rateLaterPct: number;
  newLoanTermYears: number;
  /** Years from now until the delayed move. */
  moveInYears: number;

  investmentReturnPct: number;
  /** Drift on insurance and HOA. Property tax rides the home's value instead. */
  costInflationPct: number;

  commissionPct: number;
  sellerClosingPct: number;
  buyerClosingPct: number;
  pmiRatePct: number;
  /** Proceeds deliberately kept liquid rather than put toward the next house. */
  cashHeldBack: number;

  expenses: PlannedExpense[];
}

export interface YearPoint {
  year: number;
  monthsElapsed: number;
  portfolio: number;
  homeValue: number;
  loanBalance: number;
  equity: number;
  netPosition: number;
}

export interface StrategyResult {
  kind: StrategyKind;
  label: string;
  points: YearPoint[];
  /** Recurring ownership cost over the horizon: P&I, tax, insurance, HOA, upkeep, PMI. */
  totalHousingCash: number;
  totalInterest: number;
  totalPrincipal: number;
  totalEscrow: number;
  totalMaintenance: number;
  /** Planned one-offs that actually landed on this strategy. */
  totalExpenses: number;
  /** Commission, seller closing, and buyer closing paid on any move. */
  totalTransactionCosts: number;
  /** Every dollar out the door: carrying costs + one-offs + moving fees. */
  totalOut: number;
  finalEquity: number;
  finalPortfolio: number;
  finalNet: number;
  /** Month the move happens, or null for stay-put. */
  moveMonth: number | null;
}

const LABELS: Record<StrategyKind, string> = {
  stay: 'Stay put',
  sellNow: 'Sell now and buy',
  stayThenMove: 'Stay, then move',
};

function monthlyCarryingCost(
  homeValue: number,
  profile: HomeProfile,
  inflationFactor: number,
): { tax: number; insurance: number; hoa: number; maintenance: number } {
  const { costs } = profile;
  const tax =
    costs.taxMode === 'fixed'
      ? (costs.taxAnnual / 12) * inflationFactor
      : monthlyPropertyTax(homeValue, costs);
  return {
    tax,
    insurance: (costs.insuranceAnnual / 12) * inflationFactor,
    hoa: costs.hoaMonthly * inflationFactor,
    maintenance: (homeValue * (profile.maintenancePct / 100)) / 12,
  };
}

export function runStrategy(kind: StrategyKind, input: ProjectionInputs): StrategyResult {
  const horizonMonths = Math.max(1, Math.round(input.horizonYears * 12));
  const moveMonth =
    kind === 'sellNow' ? 0 : kind === 'stayThenMove' ? Math.round(input.moveInYears * 12) : null;

  const investMonthly = input.investmentReturnPct / 100 / 12;

  // Live state
  let portfolio = 0;
  let owning: 'current' | 'next' = 'current';
  let homeValue = input.current.value;
  let balance = input.currentLoan.balance;
  let loanRate = input.currentLoan.ratePct;
  let payment = monthlyPI(
    input.currentLoan.balance,
    input.currentLoan.ratePct,
    input.currentLoan.remainingYears,
  );
  let pmiMonthly = 0;
  let pmiEndsAtMonth = 0;

  // Tallies
  let totalInterest = 0;
  let totalPrincipal = 0;
  let totalEscrow = 0;
  let totalMaintenance = 0;
  let totalPmi = 0;
  let totalExpenses = 0;
  let totalTransactionCosts = 0;

  const profile = () => (owning === 'current' ? input.current : input.next);

  function doMove(atMonth: number) {
    // Sell whatever is owned right now, at its appreciated value.
    const { netProceeds, commission, sellerClosing } = computeProceeds(homeValue, {
      payoff: balance,
      commissionPct: input.commissionPct,
      sellerClosingPct: input.sellerClosingPct,
      concessions: 0,
      cashHeldBack: 0,
      extraSavings: 0,
    });
    portfolio += netProceeds;

    // The next house costs what it will cost by then, not what it costs today.
    // Compounded monthly to match how owned homes appreciate in the loop below,
    // so the two sides of the trade are measured the same way.
    const newPrice =
      input.next.value * Math.pow(1 + input.next.appreciationPct / 100 / 12, atMonth);

    const dp = computeDownPayment(
      newPrice,
      input.buyerClosingPct,
      netProceeds - input.cashHeldBack,
    );
    portfolio -= dp.downPayment + dp.buyerClosingCosts;
    totalTransactionCosts += commission + sellerClosing + dp.buyerClosingCosts;

    homeValue = newPrice;
    balance = Math.max(0, newPrice - dp.downPayment);
    loanRate = atMonth === 0 ? input.rateNowPct : input.rateLaterPct;
    payment = monthlyPI(balance, loanRate, input.newLoanTermYears);

    if (balance / newPrice > 0.8) {
      pmiMonthly = (balance * (input.pmiRatePct / 100)) / 12;
      const drop = pmiDropoffMonth(balance, newPrice, loanRate, input.newLoanTermYears);
      pmiEndsAtMonth = atMonth + (drop ?? input.newLoanTermYears * 12);
    } else {
      pmiMonthly = 0;
      pmiEndsAtMonth = 0;
    }

    owning = 'next';
  }

  if (moveMonth === 0) doMove(0);

  const points: YearPoint[] = [
    {
      year: input.startYear,
      monthsElapsed: 0,
      portfolio,
      homeValue,
      loanBalance: balance,
      equity: homeValue - balance,
      netPosition: portfolio + homeValue - balance,
    },
  ];

  // Expenses fire in the first month of their calendar year.
  const expenseMonth = (e: PlannedExpense) => (e.year - input.startYear) * 12 + 1;

  for (let m = 1; m <= horizonMonths; m++) {
    if (moveMonth !== null && moveMonth === m) doMove(m);

    portfolio *= 1 + investMonthly;

    // Mortgage
    if (balance > 0 && payment > 0) {
      const i = loanRate / 100 / 12;
      const interest = balance * i;
      const due = Math.min(payment, balance + interest);
      const principalPaid = due - interest;
      balance = Math.max(0, balance - principalPaid);
      portfolio -= due;
      totalInterest += interest;
      totalPrincipal += principalPaid;
    }

    const inflationFactor = Math.pow(1 + input.costInflationPct / 100, (m - 1) / 12);
    const carry = monthlyCarryingCost(homeValue, profile(), inflationFactor);
    portfolio -= carry.tax + carry.insurance + carry.hoa + carry.maintenance;
    totalEscrow += carry.tax + carry.insurance + carry.hoa;
    totalMaintenance += carry.maintenance;

    if (pmiMonthly > 0 && m <= pmiEndsAtMonth) {
      portfolio -= pmiMonthly;
      totalPmi += pmiMonthly;
    }

    for (const e of input.expenses) {
      if (expenseMonth(e) !== m) continue;
      if (e.appliesTo !== 'both' && e.appliesTo !== owning) continue;
      portfolio -= e.amount;
      totalExpenses += e.amount;
    }

    homeValue *= 1 + profile().appreciationPct / 100 / 12;

    if (m % 12 === 0) {
      points.push({
        year: input.startYear + m / 12,
        monthsElapsed: m,
        portfolio,
        homeValue,
        loanBalance: balance,
        equity: homeValue - balance,
        netPosition: portfolio + homeValue - balance,
      });
    }
  }

  const last = points[points.length - 1];
  const totalHousingCash =
    totalInterest + totalPrincipal + totalEscrow + totalMaintenance + totalPmi;
  return {
    kind,
    label: LABELS[kind],
    points,
    totalHousingCash,
    totalOut: totalHousingCash + totalExpenses + totalTransactionCosts,
    totalInterest,
    totalPrincipal,
    totalEscrow,
    totalMaintenance,
    totalExpenses,
    totalTransactionCosts,
    finalEquity: last.equity,
    finalPortfolio: last.portfolio,
    finalNet: last.netPosition,
    moveMonth,
  };
}

export function runAllStrategies(input: ProjectionInputs): StrategyResult[] {
  return [
    runStrategy('stay', input),
    runStrategy('sellNow', input),
    runStrategy('stayThenMove', input),
  ];
}

/**
 * Fractional years at which `other` crosses `baseline` — the decision-relevant
 * moment, since which strategy is ahead flips there. Linear interpolation
 * between annual points is plenty given the curves are smooth.
 */
export function crossoverYears(baseline: StrategyResult, other: StrategyResult): number[] {
  const out: number[] = [];
  const n = Math.min(baseline.points.length, other.points.length);
  for (let k = 1; k < n; k++) {
    const prev = other.points[k - 1].netPosition - baseline.points[k - 1].netPosition;
    const curr = other.points[k].netPosition - baseline.points[k].netPosition;
    if (prev === 0 || curr === 0 || prev * curr > 0) continue;
    const t = prev / (prev - curr);
    const y0 = other.points[k - 1].monthsElapsed / 12;
    const y1 = other.points[k].monthsElapsed / 12;
    out.push(y0 + t * (y1 - y0));
  }
  return out;
}
