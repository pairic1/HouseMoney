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
          The most you could pay for a house and still land at or under this number — carrying the
          same taxes, insurance, and HOA you set above.
        </p>
      </div>

      <div className="grid-scroll">
        <table className="afford">
          <caption className="sr-only">
            Maximum affordable purchase price by sale price (rows) and rate (columns).
          </caption>
          <thead>
            <tr>
              <th className="corner" scope="col">
                Sale ╲ Rate
              </th>
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
