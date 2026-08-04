import { buildAffordability } from '../lib/grid';
import type { HouseCosts, LoanTerms } from '../lib/mortgage';
import type { SaleAssumptions } from '../lib/proceeds';
import { moneyShort, pct } from '../lib/format';
import { NumberField } from './inputs';

interface Props {
  target: number;
  onTargetChange: (n: number) => void;
  salePrices: number[];
  rates: number[];
  sale: SaleAssumptions;
  costs: HouseCosts;
  terms: LoanTerms;
}

export function AffordabilityPanel({
  target,
  onTargetChange,
  salePrices,
  rates,
  sale,
  costs,
  terms,
}: Props) {
  const rows = buildAffordability(target, salePrices, rates, sale, costs, terms);

  return (
    <>
      <div className="afford-head">
        <NumberField
          label="Payment ceiling"
          sub="per month, all in"
          value={target}
          onChange={onTargetChange}
          prefix="$"
          grouped
          min={0}
        />
        <p className="hint" style={{ margin: 0, flex: '1 1 220px' }}>
          The most you could pay for the next house and still land at or under this number —
          carrying the same taxes, insurance, and HOA you set above.
        </p>
      </div>

      <p className="grid-lead">
        Here the cells are <strong>purchase prices</strong>, not payments — the ceiling on what you
        could buy if your current house sells for the amount on the left and you get the rate along
        the top.
      </p>

      <div className="grid-scroll">
        <table className="afford">
          <caption className="sr-only">
            Maximum purchase price for the next house, by what the current house sells for (rows)
            and the rate on the new loan (columns).
          </caption>
          <thead>
            <tr>
              <th className="corner" rowSpan={2} scope="col">
                Your current
                <br />
                house sells for
              </th>
              <th className="axis-top" colSpan={rates.length} scope="colgroup">
                Rate on your new loan
              </th>
            </tr>
            <tr>
              {rates.map((r) => (
                <th key={r} scope="col">
                  {pct(r)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.salePrice}>
                <th scope="row">{moneyShort(row.salePrice)}</th>
                {row.byRate.map((c) => (
                  <td key={c.rate}>{c.maxPrice > 0 ? moneyShort(c.maxPrice) : '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
