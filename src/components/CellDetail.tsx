import type { GridCell } from '../lib/grid';
import type { SaleAssumptions } from '../lib/proceeds';
import { computeProceeds } from '../lib/proceeds';
import { money, moneyExact, monthsToYears, pct } from '../lib/format';

interface Props {
  cell: GridCell | null;
  sale: SaleAssumptions;
  target: number;
  termYears: number;
}

function Line({
  k,
  v,
  negative,
  total,
}: {
  k: string;
  v: string;
  negative?: boolean;
  total?: boolean;
}) {
  return (
    <div className={['line-item', negative ? 'negative' : '', total ? 'total-row' : ''].filter(Boolean).join(' ')}>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

export function CellDetail({ cell, sale, target, termYears }: Props) {
  if (!cell) {
    return (
      <div className="panel empty-detail">
        Pick any cell above to see where the money goes.
      </div>
    );
  }

  const b = cell.breakdown;
  const p = computeProceeds(cell.salePrice, sale);
  const overUnder = b.totalMonthly - target;

  return (
    <div className="panel detail">
      <div className="detail-head">
        <h3>
          Sells for {money(cell.salePrice)} · borrows at {pct(cell.rate)}
        </h3>
        {!b.isShort && <span className="total num">{money(b.totalMonthly)}/mo</span>}
      </div>

      {b.isShort && (
        <p className="detail-note warn">
          This combination doesn't work. Closing costs on a {money(b.purchasePrice)} purchase run{' '}
          {money(b.buyerClosingCosts)}, and the sale only leaves {money(cell.cashToClose)} on the
          table. You'd be {money(b.shortfall)} short before putting a dollar down.
        </p>
      )}

      {!b.isShort && (
        <>
          <div className="detail-cols">
            <div>
              <p className="subhead">Monthly payment</p>
              <Line k="Principal &amp; interest" v={moneyExact(b.principalAndInterest)} />
              <Line k="Property tax" v={moneyExact(b.propertyTax)} />
              <Line k="Homeowners insurance" v={moneyExact(b.insurance)} />
              {b.hoa > 0 && <Line k="HOA dues" v={moneyExact(b.hoa)} />}
              {b.pmiApplies && <Line k="PMI" v={moneyExact(b.pmi)} negative />}
              <Line k="Total" v={moneyExact(b.totalMonthly)} total />

              <p className="subhead">The loan</p>
              <Line k="Amount financed" v={money(b.loan)} />
              <Line k="Down payment" v={`${b.downPaymentPct.toFixed(1)}% of price`} />
              <Line k="Loan-to-value" v={pct(b.ltv * 100, 1)} />
              <Line k={`Interest over ${termYears} years`} v={money(b.lifetimeInterest)} />
            </div>

            <div>
              <p className="subhead">Getting to the closing table</p>
              <Line k={`Sale price`} v={money(p.salePrice)} />
              <Line k={`Agent commission (${pct(sale.commissionPct, 1)})`} v={`− ${money(p.commission)}`} negative />
              {p.sellerClosing > 0 && (
                <Line k={`Seller closing (${pct(sale.sellerClosingPct, 1)})`} v={`− ${money(p.sellerClosing)}`} negative />
              )}
              {p.concessions > 0 && <Line k="Concessions &amp; repairs" v={`− ${money(p.concessions)}`} negative />}
              <Line k="Mortgage payoff" v={`− ${money(p.payoff)}`} negative />
              <Line k="Net proceeds" v={money(p.netProceeds)} total />
              {sale.cashHeldBack > 0 && <Line k="Held back for reserves" v={`− ${money(sale.cashHeldBack)}`} negative />}
              {sale.extraSavings > 0 && <Line k="Savings added" v={`+ ${money(sale.extraSavings)}`} />}
              <Line k="Buyer closing costs" v={`− ${money(b.buyerClosingCosts)}`} negative />
              <Line k="Down payment" v={money(b.downPayment)} total />

              <p className="subhead">Against your budget</p>
              <Line
                k={overUnder > 0 ? 'Over your line by' : 'Under your line by'}
                v={`${money(Math.abs(overUnder))}/mo`}
                negative={overUnder > 0}
              />
              <Line k="Which is, per year" v={money(Math.abs(overUnder) * 12)} negative={overUnder > 0} />
              {b.surplus > 0 && <Line k="Cash left over" v={money(b.surplus)} />}
            </div>
          </div>

          {b.pmiApplies && (
            <p className="detail-note">
              Under 20% down, so PMI adds {money(b.pmi)}/mo.{' '}
              {b.pmiDropoffMonth
                ? `It falls off after ${monthsToYears(b.pmiDropoffMonth)} of payments, costing about ${money(
                    b.pmiTotalCost,
                  )} in total.`
                : `It stays for the life of the loan at this rate.`}{' '}
              Getting to {money(b.purchasePrice * 0.2)} down would remove it.
            </p>
          )}
        </>
      )}
    </div>
  );
}
