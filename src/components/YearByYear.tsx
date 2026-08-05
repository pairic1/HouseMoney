import { useState } from 'react';
import type { StrategyResult } from '../lib/projection';
import { money } from '../lib/format';

interface Props {
  results: StrategyResult[];
  classNames: string[];
}

/**
 * The strategy cards give one total for the whole horizon, which leaves it fair
 * to wonder whether interest and principal are really being tracked year by
 * year. They are — this shows the schedule they come from.
 */
export function YearByYear({ results, classNames }: Props) {
  const [pick, setPick] = useState(0);
  const r = results[Math.min(pick, results.length - 1)];
  const rows = r.points.slice(1);

  return (
    <div className="year-detail">
      <div className="strategy-tabs" role="tablist" aria-label="Plan to break down">
        {results.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === pick}
            className={`strategy-tab${i === pick ? ' is-active' : ''}`}
            onClick={() => setPick(i)}
          >
            <span className={`readout-swatch ${classNames[i] ?? ''}`} />
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid-scroll">
        <table className="afford year-table">
          <caption className="sr-only">
            Year-by-year cash out and balances for {r.label}.
          </caption>
          <thead>
            <tr>
              <th className="corner" scope="col">
                Year
              </th>
              <th scope="col">Interest</th>
              <th scope="col">Principal</th>
              <th scope="col">Tax, ins, HOA</th>
              <th scope="col">Upkeep</th>
              <th scope="col">One-offs</th>
              <th scope="col">Moving</th>
              <th scope="col">Out that year</th>
              <th scope="col">Loan left</th>
              <th scope="col">Equity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((pt) => (
              <tr key={pt.year} className={pt.transactionCosts > 0 ? 'is-move-year' : undefined}>
                <th scope="row" className="num">
                  {pt.year}
                </th>
                <td>{money(pt.interestPaid)}</td>
                <td>{money(pt.principalPaid)}</td>
                <td>{money(pt.escrow)}</td>
                <td>{money(pt.maintenance)}</td>
                <td>{pt.expenses > 0 ? money(pt.expenses) : '—'}</td>
                <td>{pt.transactionCosts > 0 ? money(pt.transactionCosts) : '—'}</td>
                <td className="emph">{money(pt.cashOut)}</td>
                <td>{money(pt.loanBalance)}</td>
                <td>{money(pt.equity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="hint">
        Interest and principal are computed month by month off the live balance and summed into
        each year, so interest falls and principal rises exactly the way an amortization schedule
        says it should. Highlighted rows are the year that plan moves — the loan resets there, which
        is why interest jumps back up. Property tax, insurance, HOA and PMI sit in one column.
      </p>
    </div>
  );
}
