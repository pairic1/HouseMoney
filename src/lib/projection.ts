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
  type TaxMode,
} from './mortgage';
import { computeDownPayment, computeProceeds } from './proceeds';

export type StrategyKind = 'stay' | 'sellNow' | 'stayThenMove';
export type PropertyRef = 'current' | 'next' | 'both';

export interface HomeProfile {
  /** Today's market value (current home) or today's asking price (next home). */
  value: number;
  appreciationPct: number;
  costs: HouseCosts;
  /**
   * Routine upkeep, either as a percent of value per year — the "1% rule" — or
   * as a flat yearly figure. The flat figure drifts with cost inflation, since
   * it's a labor-and-materials bill, not a share of the house.
   */
  maintenanceMode: TaxMode;
  maintenancePct: number;
  maintenanceAnnual: number;
}

export interface CurrentLoan {
  balance: number;
  ratePct: number;
  remainingYears: number;
}

/**
 * What the house you're in has already cost, from the day you bought it.
 *
 * This is the piece that lets a past renovation stop being pure cost. The home
 * value walks from `purchasePrice` to today's value along a geometric path, so
 * whatever a renovation actually added is already sitting inside that climb —
 * the spend is charged and the value it bought is credited, without the model
 * having to guess a recovery fraction.
 */
export interface HistoryInputs {
  purchaseYear: number;
  purchasePrice: number;
  /** Original loan amount — sets the payment, and implies the down payment. */
  originalLoan: number;
  originalRatePct: number;
  originalTermYears: number;
}

export interface HistoryResult {
  yearsOwned: number;
  points: YearPoint[];
  /** What the value path actually did, purchase to today — not an assumption. */
  impliedAppreciationPct: number;
  /**
   * The loan at purchase, reconstructed by amortizing backwards from today's
   * balance. Compare against what was entered: a gap means extra principal, a
   * refinance, or terms remembered slightly wrong.
   */
  reconstructedOriginalLoan: number;
  downPayment: number;
  totalInterest: number;
  totalPrincipal: number;
  totalEscrow: number;
  totalMaintenance: number;
  totalExpenses: number;
  /** Every dollar this house has taken, down payment included. */
  totalOut: number;
  /** Cumulative net cost carried into today — the forward runs start here. */
  finalPortfolio: number;
  equityToday: number;
  /** Net position today, anchored at zero on the day of purchase. */
  netSincePurchase: number;
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
  /** Rate on a loan taken at any delayed move — the biggest unknown here. */
  rateLaterPct: number;
  newLoanTermYears: number;
  /**
   * Years from now for each wait-then-move plan you want to see. One strategy
   * is run per entry, so "move at 5" and "move at 10" can be read side by side.
   */
  moveYears: number[];

  investmentReturnPct: number;
  /** Drift on insurance and HOA. Property tax rides the home's value instead. */
  costInflationPct: number;

  /** Set to also account for what this house has already cost. */
  history?: HistoryInputs;

  commissionPct: number;
  sellerClosingPct: number;
  buyerClosingPct: number;
  pmiRatePct: number;
  /** Proceeds deliberately kept liquid rather than put toward the next house. */
  cashHeldBack: number;

  expenses: PlannedExpense[];
}

/**
 * A snapshot at the end of a year, plus what flowed out *during* that year.
 * The flows are what let the page show interest and principal accruing year by
 * year rather than only as one horizon-wide total.
 */
export interface YearPoint {
  year: number;
  monthsElapsed: number;
  portfolio: number;
  homeValue: number;
  loanBalance: number;
  equity: number;
  netPosition: number;

  /** Paid during the twelve months ending here. Zero on the year-0 point. */
  interestPaid: number;
  principalPaid: number;
  escrow: number;
  maintenance: number;
  expenses: number;
  transactionCosts: number;
  /** Every dollar out the door this year — the sum of the six above. */
  cashOut: number;
}

export interface StrategyResult {
  /** Stable per-strategy key; move plans differ only by year, so it encodes one. */
  id: string;
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

/** Which plan to run: stay put, sell immediately, or wait `moveInYears` first. */
export interface StrategySpec {
  kind: StrategyKind;
  /** Only read for `stayThenMove`. */
  moveInYears?: number;
}

function describe(spec: StrategySpec): { id: string; label: string } {
  switch (spec.kind) {
    case 'stay':
      return { id: 'stay', label: 'Stay put' };
    case 'sellNow':
      return { id: 'sellNow', label: 'Sell now and buy' };
    case 'stayThenMove': {
      const y = spec.moveInYears ?? 0;
      const rounded = Number.isInteger(y) ? String(y) : y.toFixed(1);
      return { id: `move-${rounded}`, label: `Move in ${rounded} years` };
    }
  }
}

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
  const maintenance =
    profile.maintenanceMode === 'fixed'
      ? (profile.maintenanceAnnual / 12) * inflationFactor
      : (homeValue * (profile.maintenancePct / 100)) / 12;
  return {
    tax,
    insurance: (costs.insuranceAnnual / 12) * inflationFactor,
    hoa: costs.hoaMonthly * inflationFactor,
    maintenance,
  };
}

/** Blank per-year flow accumulator, drained into each YearPoint. */
const blankFlows = () => ({
  interestPaid: 0,
  principalPaid: 0,
  escrow: 0,
  maintenance: 0,
  expenses: 0,
  transactionCosts: 0,
});

const sumFlows = (f: ReturnType<typeof blankFlows>) =>
  f.interestPaid + f.principalPaid + f.escrow + f.maintenance + f.expenses + f.transactionCosts;

/**
 * Months from the start of `year`'s window, under the convention that a year
 * point is stamped with the year its twelve-month window *ends*.
 */
const windowStartMonth = (year: number, epochYear: number) => (year - epochYear - 1) * 12 + 1;

/**
 * Walk from the purchase date up to today. Returns null when there's no history
 * to walk — no inputs, or a purchase date that isn't in the past.
 *
 * Net position is anchored at zero on the day of purchase: the down payment
 * leaves the portfolio and arrives as equity, so day one nets out. Everything
 * after that reads as what owning this house has actually gained or cost.
 */
export function runHistory(input: ProjectionInputs): HistoryResult | null {
  const h = input.history;
  if (!h) return null;
  const months = Math.round((input.startYear - h.purchaseYear) * 12);
  if (months < 12 || h.purchasePrice <= 0) return null;

  const i = h.originalRatePct / 100 / 12;
  const payment = monthlyPI(h.originalLoan, h.originalRatePct, h.originalTermYears);

  // Reconstruct the balance path by amortizing backwards from today's balance —
  // the figure on a statement, and so the one worth trusting. Running forwards
  // from the original loan instead would drift and leave a step at today.
  const balances = new Array<number>(months + 1);
  balances[months] = input.currentLoan.balance;
  for (let m = months; m >= 1; m--) {
    balances[m - 1] = i === 0 ? balances[m] + payment : (balances[m] + payment) / (1 + i);
  }

  const growth = input.current.value / h.purchasePrice;
  const impliedAppreciationPct = (Math.pow(growth, 12 / months) - 1) * 100;

  const downPayment = Math.max(0, h.purchasePrice - balances[0]);
  const investMonthly = input.investmentReturnPct / 100 / 12;

  let portfolio = -downPayment;
  let totalInterest = 0;
  let totalPrincipal = 0;
  let totalEscrow = 0;
  let totalMaintenance = 0;
  let totalExpenses = 0;

  const valueAt = (m: number) => h.purchasePrice * Math.pow(growth, m / months);

  const points: YearPoint[] = [
    {
      year: h.purchaseYear,
      monthsElapsed: -months,
      portfolio,
      homeValue: h.purchasePrice,
      loanBalance: balances[0],
      equity: h.purchasePrice - balances[0],
      netPosition: portfolio + h.purchasePrice - balances[0],
      ...blankFlows(),
      cashOut: 0,
    },
  ];
  // The down payment belongs to year one of ownership, not to nothing.
  let yr = blankFlows();
  yr.expenses = downPayment;

  for (let m = 1; m <= months; m++) {
    portfolio *= 1 + investMonthly;

    const interest = balances[m - 1] * i;
    const principalPaid = balances[m - 1] - balances[m];
    portfolio -= interest + principalPaid;
    totalInterest += interest;
    totalPrincipal += principalPaid;
    yr.interestPaid += interest;
    yr.principalPaid += principalPaid;

    // Today's entered bills are today's; back then they were smaller.
    const inflationFactor = Math.pow(1 + input.costInflationPct / 100, -(months - m) / 12);
    const carry = monthlyCarryingCost(valueAt(m), input.current, inflationFactor);
    portfolio -= carry.tax + carry.insurance + carry.hoa + carry.maintenance;
    totalEscrow += carry.tax + carry.insurance + carry.hoa;
    totalMaintenance += carry.maintenance;
    yr.escrow += carry.tax + carry.insurance + carry.hoa;
    yr.maintenance += carry.maintenance;

    for (const e of input.expenses) {
      if (e.appliesTo === 'next') continue;
      if (windowStartMonth(e.year, h.purchaseYear) !== m) continue;
      portfolio -= e.amount;
      totalExpenses += e.amount;
      yr.expenses += e.amount;
    }

    if (m % 12 === 0) {
      const value = valueAt(m);
      points.push({
        year: h.purchaseYear + m / 12,
        monthsElapsed: m - months,
        portfolio,
        homeValue: value,
        loanBalance: balances[m],
        equity: value - balances[m],
        netPosition: portfolio + value - balances[m],
        ...yr,
        cashOut: sumFlows(yr),
      });
      yr = blankFlows();
    }
  }

  const last = points[points.length - 1];
  return {
    yearsOwned: months / 12,
    points,
    impliedAppreciationPct,
    reconstructedOriginalLoan: balances[0],
    downPayment,
    totalInterest,
    totalPrincipal,
    totalEscrow,
    totalMaintenance,
    totalExpenses,
    totalOut:
      totalInterest + totalPrincipal + totalEscrow + totalMaintenance + totalExpenses + downPayment,
    finalPortfolio: last.portfolio,
    equityToday: last.equity,
    netSincePurchase: last.netPosition,
  };
}

/**
 * `startingPortfolio` carries the cost of the years already spent in this house.
 * It's the same figure for every strategy — past money is spent no matter what
 * you do next — so it shifts all the curves together and leaves every gap
 * between them untouched.
 */
export function runStrategy(
  spec: StrategySpec,
  input: ProjectionInputs,
  startingPortfolio = 0,
): StrategyResult {
  const { kind } = spec;
  const horizonMonths = Math.max(1, Math.round(input.horizonYears * 12));
  const moveMonth =
    kind === 'sellNow'
      ? 0
      : kind === 'stayThenMove'
        ? Math.round((spec.moveInYears ?? 0) * 12)
        : null;

  const investMonthly = input.investmentReturnPct / 100 / 12;

  // Live state
  let portfolio = startingPortfolio;
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

  // Flows during the year currently being walked, drained into each YearPoint.
  let yr = blankFlows();

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
      ...blankFlows(),
      cashOut: 0,
    },
  ];
  // A sell-now move happens before month 1, so its fees belong to year one.
  if (moveMonth === 0) yr.transactionCosts = totalTransactionCosts;

  /**
   * Year points are stamped with the year the window *ends* — `points[1]` is
   * startYear + 1 — so an expense has to fire twelve months earlier than the
   * naive offset to land in the row bearing its own year.
   *
   * A date already in the past belongs to the history walk. Without a history
   * to put it in it would otherwise vanish, so it's charged immediately
   * instead; with one, it's already been counted and must not be charged twice.
   */
  const expenseMonth = (e: PlannedExpense) => {
    const m = windowStartMonth(e.year, input.startYear);
    if (m >= 1) return m;
    return input.history ? -1 : 1;
  };

  for (let m = 1; m <= horizonMonths; m++) {
    if (moveMonth !== null && moveMonth === m) {
      const before = totalTransactionCosts;
      doMove(m);
      yr.transactionCosts += totalTransactionCosts - before;
    }

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
      yr.interestPaid += interest;
      yr.principalPaid += principalPaid;
    }

    const inflationFactor = Math.pow(1 + input.costInflationPct / 100, (m - 1) / 12);
    const carry = monthlyCarryingCost(homeValue, profile(), inflationFactor);
    portfolio -= carry.tax + carry.insurance + carry.hoa + carry.maintenance;
    totalEscrow += carry.tax + carry.insurance + carry.hoa;
    totalMaintenance += carry.maintenance;
    yr.escrow += carry.tax + carry.insurance + carry.hoa;
    yr.maintenance += carry.maintenance;

    if (pmiMonthly > 0 && m <= pmiEndsAtMonth) {
      portfolio -= pmiMonthly;
      totalPmi += pmiMonthly;
      yr.escrow += pmiMonthly;
    }

    for (const e of input.expenses) {
      if (expenseMonth(e) !== m) continue;
      if (e.appliesTo !== 'both' && e.appliesTo !== owning) continue;
      portfolio -= e.amount;
      totalExpenses += e.amount;
      yr.expenses += e.amount;
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
        ...yr,
        cashOut: sumFlows(yr),
      });
      yr = blankFlows();
    }
  }

  const last = points[points.length - 1];
  const totalHousingCash =
    totalInterest + totalPrincipal + totalEscrow + totalMaintenance + totalPmi;
  const { id, label } = describe(spec);
  return {
    id,
    kind,
    label,
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

/**
 * Staying put first — it's the baseline everything else is measured against —
 * then selling now, then one plan per move year in chronological order, so the
 * lines read left to right in the same order they leave.
 */
export function runAllStrategies(
  input: ProjectionInputs,
  startingPortfolio = 0,
): StrategyResult[] {
  const moveYears = [...new Set(input.moveYears)]
    .filter((y) => y > 0 && y <= input.horizonYears)
    .sort((a, b) => a - b);
  return [
    runStrategy({ kind: 'stay' }, input, startingPortfolio),
    runStrategy({ kind: 'sellNow' }, input, startingPortfolio),
    ...moveYears.map((y) =>
      runStrategy({ kind: 'stayThenMove', moveInYears: y }, input, startingPortfolio),
    ),
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
