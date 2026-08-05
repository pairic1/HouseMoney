import { useMemo } from 'react';
import {
  crossoverYears,
  runAllStrategies,
  type ProjectionInputs,
  type StrategyResult,
} from '../lib/projection';
import { money, moneyShort, pct } from '../lib/format';
import { useAppState } from '../state/useAppState';
import { StrategyChart } from '../components/StrategyChart';
import { PlannedExpenses } from '../components/PlannedExpenses';
import { MovePlans } from '../components/MovePlans';
import { YearByYear } from '../components/YearByYear';
import { NumberField, SelectField } from '../components/inputs';

/**
 * Staying put is the baseline rather than a series, so it gets the neutral
 * swatch; the rest follow the order `runAllStrategies` returns.
 */
const SERIES_CLASS = ['s-stay', 's-sell', 's-move-1', 's-move-2', 's-move-3'];
const MOVE_CLASSES = SERIES_CLASS.slice(2);
const MAX_MOVE_PLANS = MOVE_CLASSES.length;

const TAX_MODES = [
  { value: 'percent' as const, label: 'Percent of value' },
  { value: 'fixed' as const, label: 'Fixed amount' },
];

/** +$12,000 ahead / −$12,000 behind, with the sign said out loud. */
function Delta({ value, className = '' }: { value: number; className?: string }) {
  const ahead = value >= 0;
  return (
    <span className={`delta ${ahead ? 'is-ahead' : 'is-behind'} ${className}`}>
      {ahead ? '▲' : '▼'} {money(Math.abs(value))}
    </span>
  );
}

export function Compare() {
  const { state, set, setProjection, setCosts } = useAppState();
  const p = state.projection;
  const startYear = new Date().getFullYear();

  const input: ProjectionInputs = useMemo(
    () => ({
      startYear,
      horizonYears: p.horizonYears,
      current: {
        value: p.currentValue,
        appreciationPct: p.currentAppreciationPct,
        costs: {
          taxMode: p.currentTaxMode,
          taxRatePct: p.currentTaxRatePct,
          taxAnnual: p.currentTaxAnnual,
          insuranceAnnual: p.currentInsuranceAnnual,
          hoaMonthly: p.currentHoaMonthly,
        },
        maintenanceMode: p.currentMaintenanceMode,
        maintenancePct: p.currentMaintenancePct,
        maintenanceAnnual: p.currentMaintenanceAnnual,
      },
      currentLoan: {
        balance: p.currentBalance,
        ratePct: p.currentRatePct,
        remainingYears: p.currentRemainingYears,
      },
      next: {
        value: state.purchasePrice,
        appreciationPct: p.nextAppreciationPct,
        costs: state.costs,
        maintenanceMode: p.nextMaintenanceMode,
        maintenancePct: p.nextMaintenancePct,
        maintenanceAnnual: p.nextMaintenanceAnnual,
      },
      rateNowPct: state.rateLow,
      rateLaterPct: p.rateLaterPct,
      newLoanTermYears: state.terms.termYears,
      moveYears: p.moveYears,
      investmentReturnPct: p.investmentReturnPct,
      costInflationPct: p.costInflationPct,
      commissionPct: state.sale.commissionPct,
      sellerClosingPct: state.sale.sellerClosingPct,
      buyerClosingPct: state.terms.buyerClosingPct,
      pmiRatePct: state.terms.pmiRatePct,
      cashHeldBack: state.sale.cashHeldBack,
      expenses: p.expenses,
    }),
    [p, state, startYear],
  );

  const results = useMemo(() => runAllStrategies(input), [input]);
  const [stay, ...others] = results;

  const crossings = useMemo(
    () =>
      others
        .flatMap((r) => crossoverYears(stay, r).map((year) => ({ label: r.label, year })))
        .sort((a, b) => a.year - b.year),
    [stay, others],
  );

  const best = results.reduce((a, b) => (b.finalNet > a.finalNet ? b : a));
  const milestones = [5, 10, 15, 20, 30].filter((y) => y <= p.horizonYears);

  /**
   * Only gaps between strategies mean anything — the absolute net position is
   * cumulative housing cost compounded against a zero starting balance, which
   * has no standalone reading. So everything below is measured against staying
   * put, and the zero line is the baseline.
   */
  const deltaAt = (r: StrategyResult, idx: number) =>
    r.points[idx].netPosition - stay.points[idx].netPosition;

  const years = stay.points.map((pt) => pt.monthsElapsed / 12);
  const chartSeries = others.map((r, i) => ({
    key: r.id,
    label: r.label,
    className: SERIES_CLASS[i + 1] ?? 's-sell',
    values: r.points.map((_, k) => deltaAt(r, k)),
    divergesAtYear: r.moveMonth ? r.moveMonth / 12 : undefined,
  }));

  const milestoneIdx = (y: number) => stay.points.findIndex((pt) => pt.monthsElapsed === y * 12);

  const totalMoveFriction = others.length
    ? Math.min(...others.map((r) => r.totalTransactionCosts))
    : 0;

  return (
    <>
      <div className="hero">
        <p className="range-headline">
          Every way this could go, measured the same way: everything you own, minus everything
          you've spent getting there.
        </p>

        <div className="verdict-figures">
          {results.map((r, i) => {
            const delta = r.finalNet - stay.finalNet;
            return (
              <span className="fig" key={r.id}>
                <span className="fig-label">
                  <span className={`readout-swatch ${SERIES_CLASS[i] ?? ''}`} /> {r.label}
                </span>
                {r === stay ? (
                  <>
                    <span className="fig-value num">$0</span>
                    <span className="fig-sub">everything is measured from here</span>
                  </>
                ) : (
                  <>
                    <span className="fig-value num">
                      <Delta value={delta} />
                    </span>
                    <span className="fig-sub">
                      {delta >= 0 ? 'ahead of' : 'behind'} staying put at year {p.horizonYears}
                      {r === best && ' · best of these'}
                    </span>
                  </>
                )}
              </span>
            );
          })}
        </div>

        <p className="verdict">
          {crossings.length === 0 ? (
            <>
              <strong>{best.label} stays ahead the whole way.</strong> Nothing crosses inside{' '}
              {p.horizonYears} years, so the ranking never flips — the answer doesn't depend on
              when you'd actually leave.
            </>
          ) : (
            <>
              <strong>
                The ranking first flips at year {crossings[0].year.toFixed(1)}
                {crossings.length > 1 &&
                  `, and again at ${crossings
                    .slice(1)
                    .map((c) => `year ${c.year.toFixed(1)}`)
                    .join(' and ')}`}
                .
              </strong>{' '}
              Up to that first crossing, staying put wins on cost — the cheapest move here still
              spends {money(totalMoveFriction)} on commission and closing before it buys you
              anything. By year {p.horizonYears}, {best.label.toLowerCase()} is{' '}
              {money(Math.abs(best.finalNet - stay.finalNet))} ahead.
            </>
          )}
        </p>
      </div>

      <section className="section">
        <p className="eyebrow">Ahead or behind staying put</p>
        <p className="grid-lead">
          Everything is measured <strong>against staying put</strong>, so the flat line at zero{' '}
          <strong>is</strong> staying put — it never appears as its own curve. Above the line you're
          ahead of it, below you're behind, counting equity, cash, and every dollar spent along the
          way, with spare cash compounding at {pct(p.investmentReturnPct, 1)}.
        </p>
        <p className="grid-lead">
          A wait-then-move plan is <em>identical</em> to staying put until the year it moves, so its
          line sits exactly on zero until then — that's the dashed stretch, ending at the tick marked{' '}
          <em>moves</em>. The drop right after it is commission and closing landing all at once.
        </p>
        <StrategyChart
          years={years}
          series={chartSeries}
          crossings={crossings}
          zeroNote="staying put"
        />

        <div className="grid-scroll" style={{ marginTop: 16 }}>
          <table className="afford">
            <caption className="sr-only">
              How far ahead or behind staying put each plan runs at each milestone year.
            </caption>
            <thead>
              <tr>
                <th className="corner" scope="col">
                  Plan
                </th>
                {milestones.map((y) => (
                  <th key={y} scope="col">
                    {y}y
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.label}</th>
                  {milestones.map((y) => {
                    const idx = milestoneIdx(y);
                    if (r === stay) return <td key={y}>baseline</td>;
                    const d = idx >= 0 ? deltaAt(r, idx) : 0;
                    // Before its move, the plan is literally identical to staying.
                    if (Math.abs(d) < 1) return <td key={y}>same as staying</td>;
                    return (
                      <td key={y}>
                        <Delta value={d} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">When you'd move</p>
        <div className="panel" style={{ padding: '16px 18px 18px' }}>
          <MovePlans
            moveYears={p.moveYears}
            horizonYears={p.horizonYears}
            classNames={MOVE_CLASSES}
            max={MAX_MOVE_PLANS}
            onChange={(moveYears) => setProjection({ moveYears })}
          />
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">Where the money goes</p>
        <div className="strategy-cards">
          {results.map((r, i) => (
            <div className="strategy-card" key={r.id}>
              <h3>
                <span className={`readout-swatch ${SERIES_CLASS[i] ?? ''}`} /> {r.label}
              </h3>
              <div className="line-item">
                <span className="k">Mortgage interest</span>
                <span className="v num">{money(r.totalInterest)}</span>
              </div>
              <div className="line-item">
                <span className="k">Principal paid</span>
                <span className="v num">{money(r.totalPrincipal)}</span>
              </div>
              <div className="line-item">
                <span className="k">Tax, insurance, HOA</span>
                <span className="v num">{money(r.totalEscrow)}</span>
              </div>
              <div className="line-item">
                <span className="k">Upkeep</span>
                <span className="v num">{money(r.totalMaintenance)}</span>
              </div>
              <div className="line-item">
                <span className="k">Planned expenses</span>
                <span className="v num">{money(r.totalExpenses)}</span>
              </div>
              <div className={`line-item${r.totalTransactionCosts > 0 ? ' negative' : ''}`}>
                <span className="k">Commission &amp; closing</span>
                <span className="v num">{money(r.totalTransactionCosts)}</span>
              </div>
              <div className="line-item total-row">
                <span className="k">Total out over {p.horizonYears} years</span>
                <span className="v num">{money(r.totalOut)}</span>
              </div>
              <div className="line-item">
                <span className="k">Equity at year {p.horizonYears}</span>
                <span className="v num">{money(r.finalEquity)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">Year by year</p>
        <div className="panel" style={{ padding: '16px 18px 18px' }}>
          <YearByYear results={results} classNames={SERIES_CLASS} />
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">Repairs and expenses you can see coming</p>
        <div className="panel" style={{ padding: '16px 18px 18px' }}>
          <PlannedExpenses
            expenses={p.expenses}
            startYear={startYear}
            horizonYears={p.horizonYears}
            onChange={(expenses) => setProjection({ expenses })}
          />
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">Settings</p>
        <details className="disclosure">
          <summary>
            Long-run assumptions
            <span className="summary-note">
              {moneyShort(p.currentValue)} now ·{' '}
              {p.moveYears.length ? `move at ${[...p.moveYears].sort((a, b) => a - b).join('y, ')}y` : 'no move plans'}{' '}
              · {pct(p.investmentReturnPct, 1)} return
            </span>
          </summary>
          <div className="disclosure-body">
            <div className="group">
              <p className="eyebrow">The house you're in</p>
              <div className="field-grid">
                <NumberField
                  label="What it's worth now"
                  value={p.currentValue}
                  onChange={(n) => setProjection({ currentValue: n })}
                  prefix="$"
                  grouped
                  min={0}
                />
                <NumberField
                  label="Mortgage balance"
                  value={p.currentBalance}
                  onChange={(n) => setProjection({ currentBalance: n })}
                  prefix="$"
                  grouped
                  min={0}
                />
                <NumberField
                  label="Your rate"
                  value={p.currentRatePct}
                  onChange={(n) => setProjection({ currentRatePct: n })}
                  suffix="%"
                  min={0}
                  max={20}
                />
                <NumberField
                  label="Years left on it"
                  value={p.currentRemainingYears}
                  onChange={(n) => setProjection({ currentRemainingYears: n })}
                  min={0}
                  max={40}
                />
                <SelectField
                  label="Property tax"
                  value={p.currentTaxMode}
                  options={TAX_MODES}
                  onChange={(m) => setProjection({ currentTaxMode: m })}
                />
                {p.currentTaxMode === 'percent' ? (
                  <NumberField
                    label="Tax rate"
                    sub="of value, yearly"
                    value={p.currentTaxRatePct}
                    onChange={(n) => setProjection({ currentTaxRatePct: n })}
                    suffix="%"
                    min={0}
                    max={10}
                  />
                ) : (
                  <NumberField
                    label="Tax bill"
                    sub="per year, today"
                    value={p.currentTaxAnnual}
                    onChange={(n) => setProjection({ currentTaxAnnual: n })}
                    prefix="$"
                    grouped
                    min={0}
                  />
                )}
                <NumberField
                  label="Insurance"
                  sub="per year"
                  value={p.currentInsuranceAnnual}
                  onChange={(n) => setProjection({ currentInsuranceAnnual: n })}
                  prefix="$"
                  grouped
                  min={0}
                />
                <NumberField
                  label="HOA"
                  sub="per month"
                  value={p.currentHoaMonthly}
                  onChange={(n) => setProjection({ currentHoaMonthly: n })}
                  prefix="$"
                  grouped
                  min={0}
                />
                <SelectField
                  label="Upkeep"
                  value={p.currentMaintenanceMode}
                  options={TAX_MODES}
                  onChange={(m) => setProjection({ currentMaintenanceMode: m })}
                />
                {p.currentMaintenanceMode === 'percent' ? (
                  <NumberField
                    label="Upkeep rate"
                    sub="of value, yearly"
                    value={p.currentMaintenancePct}
                    onChange={(n) => setProjection({ currentMaintenancePct: n })}
                    suffix="%"
                    min={0}
                    max={10}
                  />
                ) : (
                  <NumberField
                    label="Upkeep budget"
                    sub="per year, today"
                    value={p.currentMaintenanceAnnual}
                    onChange={(n) => setProjection({ currentMaintenanceAnnual: n })}
                    prefix="$"
                    grouped
                    min={0}
                  />
                )}
                <NumberField
                  label="Appreciation"
                  sub="per year"
                  value={p.currentAppreciationPct}
                  onChange={(n) => setProjection({ currentAppreciationPct: n })}
                  suffix="%"
                  min={-20}
                  max={20}
                />
              </div>
              <p className="hint">
                Upkeep as a percent of value climbs as the house does, which on an expensive house
                overstates what you actually spend. Switch it to a flat budget if you know your own
                number — land, a well, a long driveway don't get pricier just because the house
                appraises higher.
              </p>
            </div>

            <div className="group">
              <p className="eyebrow">The house you'd move to</p>
              <div className="field-grid">
                <NumberField
                  label="Price today"
                  sub="shared with the estimator"
                  value={state.purchasePrice}
                  onChange={(n) => set('purchasePrice', n)}
                  prefix="$"
                  grouped
                  min={0}
                />
                <NumberField
                  label="Rate if you move later"
                  value={p.rateLaterPct}
                  onChange={(n) => setProjection({ rateLaterPct: n })}
                  suffix="%"
                  min={0}
                  max={20}
                />
                <SelectField
                  label="Property tax"
                  value={state.costs.taxMode}
                  options={[
                    { value: 'percent' as const, label: 'Percent of price' },
                    { value: 'fixed' as const, label: 'Fixed amount' },
                  ]}
                  onChange={(m) => setCosts({ taxMode: m })}
                />
                {state.costs.taxMode === 'percent' ? (
                  <NumberField
                    label="Tax rate"
                    sub="of price, yearly"
                    value={state.costs.taxRatePct}
                    onChange={(n) => setCosts({ taxRatePct: n })}
                    suffix="%"
                    min={0}
                    max={10}
                  />
                ) : (
                  <NumberField
                    label="Tax bill"
                    sub="per year, today"
                    value={state.costs.taxAnnual}
                    onChange={(n) => setCosts({ taxAnnual: n })}
                    prefix="$"
                    grouped
                    min={0}
                  />
                )}
                <NumberField
                  label="Insurance"
                  sub="per year"
                  value={state.costs.insuranceAnnual}
                  onChange={(n) => setCosts({ insuranceAnnual: n })}
                  prefix="$"
                  grouped
                  min={0}
                />
                <NumberField
                  label="HOA"
                  sub="per month"
                  value={state.costs.hoaMonthly}
                  onChange={(n) => setCosts({ hoaMonthly: n })}
                  prefix="$"
                  grouped
                  min={0}
                />
                <SelectField
                  label="Upkeep"
                  value={p.nextMaintenanceMode}
                  options={TAX_MODES}
                  onChange={(m) => setProjection({ nextMaintenanceMode: m })}
                />
                {p.nextMaintenanceMode === 'percent' ? (
                  <NumberField
                    label="Upkeep rate"
                    sub="of value, yearly"
                    value={p.nextMaintenancePct}
                    onChange={(n) => setProjection({ nextMaintenancePct: n })}
                    suffix="%"
                    min={0}
                    max={10}
                  />
                ) : (
                  <NumberField
                    label="Upkeep budget"
                    sub="per year, today"
                    value={p.nextMaintenanceAnnual}
                    onChange={(n) => setProjection({ nextMaintenanceAnnual: n })}
                    prefix="$"
                    grouped
                    min={0}
                  />
                )}
                <NumberField
                  label="Appreciation"
                  sub="per year"
                  value={p.nextAppreciationPct}
                  onChange={(n) => setProjection({ nextAppreciationPct: n })}
                  suffix="%"
                  min={-20}
                  max={20}
                />
              </div>
              <p className="hint">
                Price, tax, insurance and HOA are the same figures the Payment Estimator uses —
                edit them here or there, it's one set of numbers.
              </p>
              <p className="hint">
                Renovations count as pure cost here — nothing comes back at resale. If a project
                would genuinely raise what the house is worth, put that in the appreciation rate or
                the value above, or it won't show up at all.
              </p>
            </div>

            <div className="group">
              <p className="eyebrow">The comparison itself</p>
              <div className="field-grid">
                <SelectField
                  label="Project out"
                  value={p.horizonYears}
                  options={[10, 15, 20, 25, 30, 40].map((v) => ({ value: v, label: `${v} years` }))}
                  onChange={(n) => setProjection({ horizonYears: n })}
                />
                <NumberField
                  label="Investment return"
                  sub="on cash not in a house"
                  value={p.investmentReturnPct}
                  onChange={(n) => setProjection({ investmentReturnPct: n })}
                  suffix="%"
                  min={0}
                  max={20}
                />
                <NumberField
                  label="Cost inflation"
                  sub="insurance, HOA, flat bills"
                  value={p.costInflationPct}
                  onChange={(n) => setProjection({ costInflationPct: n })}
                  suffix="%"
                  min={0}
                  max={20}
                />
              </div>
              {(p.currentTaxMode === 'fixed' ||
                state.costs.taxMode === 'fixed' ||
                p.currentMaintenanceMode === 'fixed' ||
                p.nextMaintenanceMode === 'fixed') && (
                <p className="hint">
                  Anything you entered as a flat yearly figure — a tax bill, an upkeep budget —
                  stays off the home's value but still drifts up with cost inflation (
                  {pct(p.costInflationPct, 1)}); over {p.horizonYears} years a genuinely frozen bill
                  isn't realistic. Set cost inflation to 0% to hold them exactly.
                </p>
              )}
              <p className="hint">
                Set the investment return to 0% and this becomes plain cash-flow accounting — money
                spent and equity built, nothing credited for staying liquid. Worth flipping to see
                how much of the answer rests on that one number.
              </p>
            </div>
          </div>
        </details>
      </section>

      <footer className="footnote">
        <p>
          Every figure is measured against staying put, because only the gaps carry meaning. Each
          plan tracks home equity plus a cash balance that housing costs are drawn from and that
          compounds at the return rate — so a plan tying money up in a house shows more equity and
          less cash, and one that spends more each month falls behind on both. The absolute balance
          isn't shown; it has no reading on its own.
        </p>
        <p>
          Mortgage interest and principal are recomputed every month off the live balance, for the
          current loan and any loan that replaces it — the year-by-year table is that schedule.
          Commission, seller closing, and buyer closing are charged on every move. Sunk costs from
          houses you've already owned are deliberately excluded: they can't change what you should
          do now.
        </p>
      </footer>
    </>
  );
}
