/**
 * Sale side: what your current house actually puts in your pocket, and how much
 * of that survives to become a down payment on the next one.
 */

export interface SaleAssumptions {
  /** Remaining balance on the current mortgage. */
  payoff: number;
  /** Agent commission, as a percent of sale price. */
  commissionPct: number;
  /** Title, escrow, transfer/excise tax — percent of sale price. */
  sellerClosingPct: number;
  /** Repairs and buyer concessions negotiated off the top, flat dollars. */
  concessions: number;
  /** Cash you refuse to spend: reserves, moving, new furniture. */
  cashHeldBack: number;
  /** Savings you're bringing to the table on top of the sale. */
  extraSavings: number;
}

export interface Proceeds {
  salePrice: number;
  commission: number;
  sellerClosing: number;
  concessions: number;
  payoff: number;
  /** What the sale nets after everyone else is paid. */
  netProceeds: number;
  /** Net proceeds, minus what you hold back, plus outside savings. */
  cashToClose: number;
}

export function computeProceeds(salePrice: number, a: SaleAssumptions): Proceeds {
  const commission = salePrice * (a.commissionPct / 100);
  const sellerClosing = salePrice * (a.sellerClosingPct / 100);
  const netProceeds = salePrice - commission - sellerClosing - a.concessions - a.payoff;
  const cashToClose = netProceeds - a.cashHeldBack + a.extraSavings;
  return {
    salePrice,
    commission,
    sellerClosing,
    concessions: a.concessions,
    payoff: a.payoff,
    netProceeds,
    cashToClose,
  };
}

export interface DownPaymentResult {
  /** Lender fees, title, and prepaid escrow on the purchase. Paid before the down payment. */
  buyerClosingCosts: number;
  downPayment: number;
  /** Dollars you'd need to find to make closing happen. 0 when you're fine. */
  shortfall: number;
  isShort: boolean;
  /** Cash left over when the purchase could be made outright. */
  surplus: number;
}

/**
 * The correction that separates this from a napkin estimate: buyer closing costs
 * come out of your cash *before* anything reaches the down payment. Skipping them
 * overstates the down payment by ~2-3% of the purchase price.
 */
export function computeDownPayment(
  purchasePrice: number,
  buyerClosingPct: number,
  cashToClose: number,
): DownPaymentResult {
  const buyerClosingCosts = purchasePrice * (buyerClosingPct / 100);
  const available = cashToClose - buyerClosingCosts;

  if (available < 0) {
    return {
      buyerClosingCosts,
      downPayment: 0,
      shortfall: -available,
      isShort: true,
      surplus: 0,
    };
  }

  // Can't put down more than the house costs.
  const downPayment = Math.min(available, purchasePrice);
  return {
    buyerClosingCosts,
    downPayment,
    shortfall: 0,
    isShort: false,
    surplus: available - downPayment,
  };
}
