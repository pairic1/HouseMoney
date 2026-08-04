import { useMemo, useState } from 'react';
import { buildGrid, buildRange } from './lib/grid';
import { money, moneyShort, pct } from './lib/format';
import { useAppState } from './state/useAppState';
import type { SavedHouse } from './state/defaults';
import { AssumptionsPanel } from './components/AssumptionsPanel';
import { PaymentGrid } from './components/PaymentGrid';
import { CellDetail } from './components/CellDetail';
import { AffordabilityPanel } from './components/AffordabilityPanel';
import { SavedHouses } from './components/SavedHouses';

export default function App() {
  const { state, set, setCosts, setSale, setTerms, saveHouse, removeHouse, resetAll } =
    useAppState();
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);

  const salePrices = useMemo(
    () => buildRange(state.saleLow, state.saleHigh, state.saleStep),
    [state.saleLow, state.saleHigh, state.saleStep],
  );
  const rates = useMemo(
    () => buildRange(state.rateLow, state.rateHigh, state.rateStep),
    [state.rateLow, state.rateHigh, state.rateStep],
  );

  const grid = useMemo(
    () =>
      buildGrid(state.purchasePrice, salePrices, rates, state.sale, state.costs, state.terms),
    [state.purchasePrice, salePrices, rates, state.sale, state.costs, state.terms],
  );

  const selectedCell =
    selected && grid.rows[selected.row]?.[selected.col] ? grid.rows[selected.row][selected.col] : null;

  // How much of the grid you can actually afford — the headline answer.
  const cells = grid.rows.flat();
  const viable = cells.filter((c) => !c.breakdown.isShort);
  const underBudget = viable.filter((c) => c.breakdown.totalMonthly <= state.targetMonthly);
  const shortCount = cells.length - viable.length;

  const spanPos = (v: number) =>
    grid.max > grid.min ? ((v - grid.min) / (grid.max - grid.min)) * 100 : 50;
  const targetPos = Math.max(0, Math.min(100, spanPos(state.targetMonthly)));

  const loadHouse = (h: SavedHouse) => {
    set('purchasePrice', h.price);
    setCosts({
      taxRatePct: h.taxRatePct ?? state.costs.taxRatePct,
      taxAnnual: h.taxAnnual ?? state.costs.taxAnnual,
      insuranceAnnual: h.insuranceAnnual ?? state.costs.insuranceAnnual,
      hoaMonthly: h.hoaMonthly ?? state.costs.hoaMonthly,
    });
    setSelected(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">
      <header className="masthead">
        <h1 className="wordmark">
          House<span>Money</span>
        </h1>
        <p>Two things you don't control yet. Here's the whole range.</p>
      </header>

      <div className="hero">
        <div className="price-field">
          <label htmlFor="f-purchase">The house you're looking at</label>
          <span className="dollar">$</span>
          <input
            id="f-purchase"
            className="price-input"
            type="text"
            inputMode="numeric"
            value={state.purchasePrice.toLocaleString('en-US')}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^\d]/g, ''));
              if (Number.isFinite(n)) set('purchasePrice', n);
            }}
            onFocus={(e) => requestAnimationFrame(() => e.target.select())}
          />
        </div>

        {viable.length > 0 ? (
          <>
            <p className="range-headline">
              Depending on what your house sells for and where rates land, the payment comes in
              somewhere between
            </p>
            <div className="range-figures">
              <span className="fig">
                <span className="fig-label">Best case</span>
                <span className="fig-value is-low num">{money(grid.min)}</span>
              </span>
              <span className="sep">→</span>
              <span className="fig">
                <span className="fig-label">Worst case</span>
                <span className="fig-value is-high num">{money(grid.max)}</span>
              </span>
              <span className="fig">
                <span className="fig-label">Spread</span>
                <span className="fig-value num" style={{ fontSize: 20, color: 'var(--ink-2)' }}>
                  {money(grid.max - grid.min)}/mo
                </span>
              </span>
            </div>

            <div className="spanbar">
              <div className="spanbar-track">
                <div
                  className="spanbar-target"
                  style={{ left: `${targetPos}%` }}
                  data-label={`your line · ${money(state.targetMonthly)}`}
                />
              </div>
              <div className="spanbar-caption">
                <span>
                  {moneyShort(state.saleHigh)} sale at {pct(state.rateLow)}
                </span>
                <span>
                  {moneyShort(state.saleLow)} sale at {pct(state.rateHigh)}
                </span>
              </div>
            </div>

            <p className="verdict">
              {underBudget.length === viable.length ? (
                <>
                  <strong>Every scenario clears your budget.</strong> Even a weak sale at{' '}
                  {pct(state.rateHigh)} lands under {money(state.targetMonthly)} a month.
                </>
              ) : underBudget.length === 0 ? (
                <>
                  <strong>No scenario clears your budget.</strong> Even the best case runs{' '}
                  {money(grid.min - state.targetMonthly)} over {money(state.targetMonthly)} a
                  month.
                </>
              ) : (
                <>
                  <strong>
                    {underBudget.length} of {viable.length} scenarios
                  </strong>{' '}
                  land at or under {money(state.targetMonthly)} a month. The line drawn through the
                  grid below is where you cross it.
                </>
              )}
              {shortCount > 0 && (
                <>
                  {' '}
                  In {shortCount} {shortCount === 1 ? 'case' : 'cases'} the sale doesn't leave
                  enough cash to even close.
                </>
              )}
            </p>
          </>
        ) : (
          <p className="verdict">
            <strong>None of these sale prices leave enough cash to close</strong> on a{' '}
            {money(state.purchasePrice)} house. Buyer closing costs alone run{' '}
            {money(state.purchasePrice * (state.terms.buyerClosingPct / 100))}.
          </p>
        )}
      </div>

      <section className="section">
        <p className="eyebrow">Every combination</p>
        <PaymentGrid
          grid={grid}
          target={state.targetMonthly}
          selected={selected}
          onSelect={(row, col) =>
            setSelected((s) => (s?.row === row && s?.col === col ? null : { row, col }))
          }
        />
        <CellDetail
          cell={selectedCell}
          sale={state.sale}
          target={state.targetMonthly}
          termYears={state.terms.termYears}
        />
      </section>

      <section className="section">
        <p className="eyebrow">Working backwards</p>
        <AffordabilityPanel
          target={state.targetMonthly}
          onTargetChange={(n) => set('targetMonthly', n)}
          salePrices={salePrices}
          rates={rates}
          sale={state.sale}
          costs={state.costs}
          terms={state.terms}
        />
      </section>

      <section className="section">
        <p className="eyebrow">Houses you're watching</p>
        <SavedHouses
          houses={state.savedHouses}
          currentPrice={state.purchasePrice}
          costs={state.costs}
          sale={state.sale}
          terms={state.terms}
          salePrices={salePrices}
          rates={rates}
          onSave={saveHouse}
          onRemove={removeHouse}
          onLoad={loadHouse}
        />
      </section>

      <section className="section">
        <p className="eyebrow">Settings</p>
        <AssumptionsPanel
          state={state}
          set={set}
          setCosts={setCosts}
          setSale={setSale}
          setTerms={setTerms}
          onReset={resetAll}
        />
      </section>

      <footer className="footnote">
        <p>
          Payments are principal, interest, property tax, insurance, HOA, and PMI where the down
          payment falls under 20%.{' '}
          {state.costs.taxMode === 'percent'
            ? "Property tax scales with the purchase price, since that's what it reassesses to on sale."
            : 'Property tax is held at the fixed yearly bill you entered, the same at any purchase price.'}{' '}
          Lifetime interest assumes no extra principal.
        </p>
        <p>
          Estimates for your own planning, not a lender quote. Your actual rate, escrow, and
          closing costs come from the Loan Estimate.
        </p>
      </footer>
    </div>
  );
}
