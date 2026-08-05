import type { HistoryResult } from '../lib/projection';
import { money, pct } from '../lib/format';

interface Props {
  history: HistoryResult;
  purchasePrice: number;
  currentValue: number;
  enteredOriginalLoan: number;
  /** How far including history moves every plan's net position. */
  shift: number;
  horizonYears: number;
}

export function HistorySummary({
  history: h,
  purchasePrice,
  currentValue,
  enteredOriginalLoan,
  shift,
  horizonYears,
}: Props) {
  const valueGained = currentValue - purchasePrice;
  const loanGap = h.reconstructedOriginalLoan - enteredOriginalLoan;

  return (
    <>
      <div className="hero history-hero">
        <p className="range-headline">
          {h.yearsOwned} years in this house, from {money(purchasePrice)} to{' '}
          {money(currentValue)}.
        </p>

        <div className="verdict-figures">
          <span className="fig">
            <span className="fig-label">Everything it has taken</span>
            <span className="fig-value num">{money(h.totalOut)}</span>
            <span className="fig-sub">down payment, loan, escrow, upkeep, projects</span>
          </span>
          <span className="fig">
            <span className="fig-label">What it gained in value</span>
            <span className="fig-value num">
              <span className="delta is-ahead">▲ {money(valueGained)}</span>
            </span>
            <span className="fig-sub">
              {pct(h.impliedAppreciationPct, 1)} a year, whatever the cause
            </span>
          </span>
          <span className="fig">
            <span className="fig-label">Net, since you bought</span>
            <span className="fig-value num">
              <span className={`delta ${h.netSincePurchase >= 0 ? 'is-ahead' : 'is-behind'}`}>
                {h.netSincePurchase >= 0 ? '▲' : '▼'} {money(Math.abs(h.netSincePurchase))}
              </span>
            </span>
            <span className="fig-sub">equity built, minus everything spent</span>
          </span>
        </div>
      </div>

      <div className="strategy-cards" style={{ marginTop: 12 }}>
        <div className="strategy-card">
          <h3>Where it went</h3>
          <div className="line-item">
            <span className="k">Down payment</span>
            <span className="v num">{money(h.downPayment)}</span>
          </div>
          <div className="line-item">
            <span className="k">Mortgage interest</span>
            <span className="v num">{money(h.totalInterest)}</span>
          </div>
          <div className="line-item">
            <span className="k">Principal paid</span>
            <span className="v num">{money(h.totalPrincipal)}</span>
          </div>
          <div className="line-item">
            <span className="k">Tax, insurance, HOA</span>
            <span className="v num">{money(h.totalEscrow)}</span>
          </div>
          <div className="line-item">
            <span className="k">Upkeep</span>
            <span className="v num">{money(h.totalMaintenance)}</span>
          </div>
          <div className="line-item">
            <span className="k">Projects and repairs</span>
            <span className="v num">{money(h.totalExpenses)}</span>
          </div>
          <div className="line-item total-row">
            <span className="k">Total out since {h.points[0].year}</span>
            <span className="v num">{money(h.totalOut)}</span>
          </div>
          <div className="line-item">
            <span className="k">Equity today</span>
            <span className="v num">{money(h.equityToday)}</span>
          </div>
        </div>

        <div className="strategy-card">
          <h3>What this changes</h3>
          <p className="callout-lead">
            Counting all of it moves <strong>every plan by the same {money(Math.abs(shift))}</strong>
            .
          </p>
          <p className="callout-body">
            Which plan wins, by how much, and the years the lines cross are identical either way —
            this money is spent no matter what you do next. It changes the total, not the decision.
            That's why the chart above stays measured from today.
          </p>
          <p className="callout-body">
            What it <em>does</em> change is whether a renovation was worth it. A project you already
            paid for is charged here, and whatever it added to the house is already inside the climb
            from {money(purchasePrice)} to {money(currentValue)} — so it isn't pure cost, it's cost
            against value. The value path is pinned at both ends, so it can't double-count.
          </p>
          <p className="hint">
            A renovation you haven't done yet is still pure cost — nothing in the next{' '}
            {horizonYears} years knows a future project raised the value. Put that in the
            appreciation rate if you want it counted.
          </p>
        </div>
      </div>

      {Math.abs(loanGap) > 1_000 && (
        <p className="hint" style={{ marginTop: 10 }}>
          Amortizing back from today's balance puts the original loan at{' '}
          {money(h.reconstructedOriginalLoan)}, against the {money(enteredOriginalLoan)} you entered
          — a gap of {money(Math.abs(loanGap))}. That's extra principal paid, a refinance, or terms
          remembered a little differently. Today's balance is what the history is built on, so the
          figures above hold either way; it's the purchase-end numbers that would shift.
        </p>
      )}
    </>
  );
}
