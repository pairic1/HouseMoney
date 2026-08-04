import type { GridResult } from '../lib/grid';
import { money, moneyShort, pct } from '../lib/format';

interface Props {
  grid: GridResult;
  /** The house being bought — fixed across the whole grid. */
  purchasePrice: number;
  target: number;
  selected: { row: number; col: number } | null;
  onSelect: (row: number, col: number) => void;
}

/**
 * Color encodes polarity — distance from the budget, blue under and red over,
 * neutral at the line. Magnitude is carried by the printed figure in every
 * cell, so hue never has to do that job as well.
 */
function washFor(total: number, target: number, spread: number): string {
  if (spread <= 0) return 'transparent';
  const delta = (total - target) / spread;
  const magnitude = Math.min(1, Math.abs(delta));
  // Ease so cells near the line stay close to the surface.
  const alpha = `calc(var(--wash-max) * ${(magnitude ** 0.75).toFixed(3)})`;
  const hue = delta > 0 ? 'var(--over)' : 'var(--under)';
  return `rgba(${hue}, ${alpha})`;
}

export function PaymentGrid({ grid, purchasePrice, target, selected, onSelect }: Props) {
  // Scale the wash against whichever side of the target stretches further,
  // so a lopsided grid doesn't wash out the smaller arm.
  const spread = Math.max(
    Math.abs(grid.max - target),
    Math.abs(target - grid.min),
    1,
  );

  return (
    <>
      <p className="grid-lead">
        Every cell is the monthly payment on the <strong>{money(purchasePrice)}</strong> house
        above — if your current house sells for the amount on the left, and you get the rate along
        the top.
      </p>

      <div className="grid-scroll">
        <table className="grid">
          <caption className="sr-only">
            Monthly payment on the {money(purchasePrice)} house being bought, by what the current
            house sells for (rows) and the rate on the new loan (columns).
          </caption>
          <thead>
            <tr>
              <th className="corner" rowSpan={2} scope="col">
                Your current
                <br />
                house sells for
              </th>
              <th className="axis-top" colSpan={grid.rates.length} scope="colgroup">
                Rate on your new loan
              </th>
            </tr>
            <tr>
              {grid.rates.map((r) => (
                <th key={r} scope="col">
                  {pct(r)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, i) => {
              // The waterline: first column in this row that breaks the budget.
              const crossAt = row.findIndex(
                (c) => !c.breakdown.isShort && c.breakdown.totalMonthly > target,
              );
              return (
                <tr key={grid.salePrices[i]}>
                  <th scope="row">{moneyShort(grid.salePrices[i])}</th>
                  {row.map((cell, j) => {
                    const b = cell.breakdown;
                    const isSelected = selected?.row === i && selected?.col === j;
                    return (
                      <td key={cell.rate}>
                        <button
                          type="button"
                          className={[
                            'cell',
                            b.isShort ? 'short' : '',
                            crossAt === j ? 'crosses' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          style={
                            b.isShort
                              ? undefined
                              : { backgroundColor: washFor(b.totalMonthly, target, spread) }
                          }
                          aria-pressed={isSelected}
                          aria-label={
                            b.isShort
                              ? `Sale ${money(cell.salePrice)} at ${pct(cell.rate)}: not enough cash to close`
                              : `Sale ${money(cell.salePrice)} at ${pct(cell.rate)}: ${money(
                                  b.totalMonthly,
                                )} per month${b.pmiApplies ? ', includes PMI' : ''}`
                          }
                          onClick={() => onSelect(i, j)}
                        >
                          {b.isShort ? 'short' : money(b.totalMonthly)}
                          {!b.isShort && b.pmiApplies && <span className="pmi-dot" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="legend">
        <span className="legend-item">
          <span className="swatch under" /> under {money(target)}
        </span>
        <span className="legend-item">
          <span className="swatch over" /> over
        </span>
        <span className="legend-item">
          <span className="swatch line" /> your budget line
        </span>
        <span className="legend-item">
          <span className="swatch dot" /> PMI applies
        </span>
      </div>
    </>
  );
}
