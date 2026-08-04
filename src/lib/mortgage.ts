/**
 * Buy side: loan -> the full monthly payment stack, including the PMI cliff.
 */

import { computeDownPayment } from './proceeds';

export interface HouseCosts {
  /** Annual property tax as a percent of the *purchase* price — it reassesses on sale. */
  taxRatePct: number;
  /** Homeowners insurance, dollars per year. */
  insuranceAnnual: number;
  /** HOA dues, dollars per month. */
  hoaMonthly: number;
}

export interface LoanTerms {
  termYears: number;
  /** Annual PMI as a percent of the loan amount, charged while LTV is above 80%. */
  pmiRatePct: number;
  buyerClosingPct: number;
}

/** Standard fixed-rate amortization: M = L·i / (1 − (1+i)^−n) */
export function monthlyPI(principal: number, annualRatePct: number, termYears: number): number {
  if (principal <= 0) return 0;
  const n = termYears * 12;
  if (n <= 0) return 0;
  const i = annualRatePct / 100 / 12;
  if (i === 0) return principal / n;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

/**
 * Month at which the loan amortizes down to 78% of the original purchase price,
 * where PMI terminates automatically. Returns null if PMI never applied, or if
 * the loan never gets there within the term.
 */
export function pmiDropoffMonth(
  loan: number,
  purchasePrice: number,
  annualRatePct: number,
  termYears: number,
): number | null {
  if (purchasePrice <= 0) return null;
  if (loan / purchasePrice <= 0.8) return null;

  const target = purchasePrice * 0.78;
  const payment = monthlyPI(loan, annualRatePct, termYears);
  const i = annualRatePct / 100 / 12;
  const n = termYears * 12;

  let balance = loan;
  for (let month = 1; month <= n; month++) {
    const interest = balance * i;
    balance = balance + interest - payment;
    if (balance <= target) return month;
  }
  return null;
}

export interface PaymentBreakdown {
  purchasePrice: number;
  downPayment: number;
  downPaymentPct: number;
  buyerClosingCosts: number;
  loan: number;
  ltv: number;

  principalAndInterest: number;
  propertyTax: number;
  insurance: number;
  hoa: number;
  pmi: number;
  totalMonthly: number;

  pmiApplies: boolean;
  pmiDropoffMonth: number | null;
  /** Total PMI dollars paid before it falls off. */
  pmiTotalCost: number;

  /** Interest over the full term, assuming no extra principal. */
  lifetimeInterest: number;

  shortfall: number;
  isShort: boolean;
  surplus: number;
}

export function computePayment(
  purchasePrice: number,
  cashToClose: number,
  annualRatePct: number,
  costs: HouseCosts,
  terms: LoanTerms,
): PaymentBreakdown {
  const dp = computeDownPayment(purchasePrice, terms.buyerClosingPct, cashToClose);
  const loan = Math.max(0, purchasePrice - dp.downPayment);
  const ltv = purchasePrice > 0 ? loan / purchasePrice : 0;

  const principalAndInterest = monthlyPI(loan, annualRatePct, terms.termYears);
  const propertyTax = (purchasePrice * (costs.taxRatePct / 100)) / 12;
  const insurance = costs.insuranceAnnual / 12;
  const hoa = costs.hoaMonthly;

  const pmiApplies = ltv > 0.8;
  const pmi = pmiApplies ? (loan * (terms.pmiRatePct / 100)) / 12 : 0;
  const dropoff = pmiApplies
    ? pmiDropoffMonth(loan, purchasePrice, annualRatePct, terms.termYears)
    : null;
  const pmiTotalCost = pmi * (dropoff ?? terms.termYears * 12);

  const lifetimeInterest =
    loan > 0 ? principalAndInterest * terms.termYears * 12 - loan : 0;

  return {
    purchasePrice,
    downPayment: dp.downPayment,
    downPaymentPct: purchasePrice > 0 ? (dp.downPayment / purchasePrice) * 100 : 0,
    buyerClosingCosts: dp.buyerClosingCosts,
    loan,
    ltv,
    principalAndInterest,
    propertyTax,
    insurance,
    hoa,
    pmi,
    totalMonthly: principalAndInterest + propertyTax + insurance + hoa + pmi,
    pmiApplies,
    pmiDropoffMonth: dropoff,
    pmiTotalCost,
    lifetimeInterest,
    shortfall: dp.shortfall,
    isShort: dp.isShort,
    surplus: dp.surplus,
  };
}
