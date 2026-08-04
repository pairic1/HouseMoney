import type { AppState } from '../state/defaults';
import { NumberField, SelectField } from './inputs';
import { money } from '../lib/format';

interface Props {
  state: AppState;
  set: <K extends keyof AppState>(key: K, value: AppState[K]) => void;
  setCosts: (patch: Partial<AppState['costs']>) => void;
  setSale: (patch: Partial<AppState['sale']>) => void;
  setTerms: (patch: Partial<AppState['terms']>) => void;
  onReset: () => void;
}

export function AssumptionsPanel({ state, set, setCosts, setSale, setTerms, onReset }: Props) {
  const { sale, costs, terms } = state;

  return (
    <details className="disclosure">
      <summary>
        Assumptions
        <span className="summary-note">
          {money(sale.payoff)} payoff · {sale.commissionPct}% commission · {costs.taxRatePct}% tax
        </span>
      </summary>

      <div className="disclosure-body">
        <div className="group">
          <p className="eyebrow">Selling your current house</p>
          <div className="field-grid">
            <NumberField
              label="Mortgage payoff"
              value={sale.payoff}
              onChange={(n) => setSale({ payoff: n })}
              prefix="$"
              grouped
              min={0}
            />
            <NumberField
              label="Agent commission"
              value={sale.commissionPct}
              onChange={(n) => setSale({ commissionPct: n })}
              suffix="%"
              min={0}
              max={20}
            />
            <NumberField
              label="Seller closing"
              sub="title, escrow, transfer tax"
              value={sale.sellerClosingPct}
              onChange={(n) => setSale({ sellerClosingPct: n })}
              suffix="%"
              min={0}
              max={20}
            />
            <NumberField
              label="Concessions & repairs"
              value={sale.concessions}
              onChange={(n) => setSale({ concessions: n })}
              prefix="$"
              grouped
              min={0}
            />
            <NumberField
              label="Cash held back"
              sub="reserves, moving"
              value={sale.cashHeldBack}
              onChange={(n) => setSale({ cashHeldBack: n })}
              prefix="$"
              grouped
              min={0}
            />
            <NumberField
              label="Savings added"
              value={sale.extraSavings}
              onChange={(n) => setSale({ extraSavings: n })}
              prefix="$"
              grouped
              min={0}
            />
          </div>
        </div>

        <div className="group">
          <p className="eyebrow">Buying the next one</p>
          <div className="field-grid">
            <NumberField
              label="Property tax"
              sub="of purchase price, yearly"
              value={costs.taxRatePct}
              onChange={(n) => setCosts({ taxRatePct: n })}
              suffix="%"
              min={0}
              max={10}
            />
            <NumberField
              label="Insurance"
              sub="per year"
              value={costs.insuranceAnnual}
              onChange={(n) => setCosts({ insuranceAnnual: n })}
              prefix="$"
              grouped
              min={0}
            />
            <NumberField
              label="HOA dues"
              sub="per month"
              value={costs.hoaMonthly}
              onChange={(n) => setCosts({ hoaMonthly: n })}
              prefix="$"
              grouped
              min={0}
            />
            <NumberField
              label="Buyer closing"
              sub="lender, title, escrow"
              value={terms.buyerClosingPct}
              onChange={(n) => setTerms({ buyerClosingPct: n })}
              suffix="%"
              min={0}
              max={20}
            />
            <NumberField
              label="PMI rate"
              sub="of loan, yearly"
              value={terms.pmiRatePct}
              onChange={(n) => setTerms({ pmiRatePct: n })}
              suffix="%"
              min={0}
              max={5}
            />
            <SelectField
              label="Loan term"
              value={terms.termYears}
              options={[
                { value: 30, label: '30 years' },
                { value: 20, label: '20 years' },
                { value: 15, label: '15 years' },
              ]}
              onChange={(n) => setTerms({ termYears: n })}
            />
          </div>
        </div>

        <div className="group">
          <p className="eyebrow">What the grid covers</p>
          <div className="field-grid">
            <NumberField
              label="Sale price from"
              value={state.saleLow}
              onChange={(n) => set('saleLow', n)}
              prefix="$"
              grouped
              min={0}
            />
            <NumberField
              label="Sale price to"
              value={state.saleHigh}
              onChange={(n) => set('saleHigh', n)}
              prefix="$"
              grouped
              min={0}
            />
            <NumberField
              label="Sale step"
              value={state.saleStep}
              onChange={(n) => set('saleStep', n)}
              prefix="$"
              grouped
              min={1000}
            />
            <NumberField
              label="Rate from"
              value={state.rateLow}
              onChange={(n) => set('rateLow', n)}
              suffix="%"
              min={0}
              max={20}
            />
            <NumberField
              label="Rate to"
              value={state.rateHigh}
              onChange={(n) => set('rateHigh', n)}
              suffix="%"
              min={0}
              max={20}
            />
            <NumberField
              label="Rate step"
              value={state.rateStep}
              onChange={(n) => set('rateStep', n)}
              suffix="%"
              min={0.05}
              max={5}
            />
          </div>
          <p className="hint">
            Everything here is saved in this browser only. Nothing is uploaded anywhere.{' '}
            <button type="button" className="btn quiet" onClick={onReset}>
              Reset to defaults
            </button>
          </p>
        </div>
      </div>
    </details>
  );
}
