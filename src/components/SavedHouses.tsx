import { useState } from 'react';
import { computePayment, type HouseCosts, type LoanTerms } from '../lib/mortgage';
import { computeProceeds, type SaleAssumptions } from '../lib/proceeds';
import { money, moneyShort } from '../lib/format';
import type { SavedHouse } from '../state/defaults';
import { NumberField } from './inputs';

interface Props {
  houses: SavedHouse[];
  currentPrice: number;
  costs: HouseCosts;
  sale: SaleAssumptions;
  terms: LoanTerms;
  salePrices: number[];
  rates: number[];
  onSave: (h: SavedHouse) => void;
  onRemove: (id: string) => void;
  onLoad: (h: SavedHouse) => void;
}

/** A house's own overrides win; anything left blank falls back to the global assumption. */
function costsFor(h: SavedHouse, base: HouseCosts): HouseCosts {
  return {
    taxMode: base.taxMode,
    taxRatePct: h.taxRatePct ?? base.taxRatePct,
    taxAnnual: h.taxAnnual ?? base.taxAnnual,
    insuranceAnnual: h.insuranceAnnual ?? base.insuranceAnnual,
    hoaMonthly: h.hoaMonthly ?? base.hoaMonthly,
  };
}

/** Best case is the strongest sale at the lowest rate; worst case is the reverse. */
function paymentRange(
  h: SavedHouse,
  base: HouseCosts,
  sale: SaleAssumptions,
  terms: LoanTerms,
  salePrices: number[],
  rates: number[],
) {
  const costs = costsFor(h, base);
  const best = computePayment(
    h.price,
    computeProceeds(Math.max(...salePrices), sale).cashToClose,
    Math.min(...rates),
    costs,
    terms,
  );
  const worst = computePayment(
    h.price,
    computeProceeds(Math.min(...salePrices), sale).cashToClose,
    Math.max(...rates),
    costs,
    terms,
  );
  return { best, worst };
}

const blankDraft = {
  nickname: '',
  price: 650_000,
  tax: '',
  insuranceAnnual: '',
  hoaMonthly: '',
};

export function SavedHouses({
  houses,
  currentPrice,
  costs,
  sale,
  terms,
  salePrices,
  rates,
  onSave,
  onRemove,
  onLoad,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ ...blankDraft, price: currentPrice });

  const startAdding = () => {
    setDraft({ ...blankDraft, price: currentPrice });
    setAdding(true);
  };

  const submit = () => {
    const optional = (s: string) => {
      const n = Number(s.replace(/[,\s$%]/g, ''));
      return s.trim() === '' || !Number.isFinite(n) ? null : n;
    };
    // The tax override is entered in whichever unit the active mode uses.
    const tax = optional(draft.tax);
    onSave({
      id: crypto.randomUUID(),
      nickname: draft.nickname.trim() || moneyShort(draft.price),
      price: draft.price,
      taxRatePct: costs.taxMode === 'percent' ? tax : null,
      taxAnnual: costs.taxMode === 'fixed' ? tax : null,
      insuranceAnnual: optional(draft.insuranceAnnual),
      hoaMonthly: optional(draft.hoaMonthly),
      note: '',
    });
    setAdding(false);
  };

  return (
    <>
      {houses.length === 0 && !adding && (
        <div className="panel empty-state">
          Nothing saved yet. Add a listing you're looking at and it'll show the full spread of
          what it could cost you.
          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn primary" onClick={startAdding}>
              Add a listing
            </button>
          </div>
        </div>
      )}

      {houses.length > 0 && (
        <div className="house-list">
          {houses.map((h) => {
            const { best, worst } = paymentRange(h, costs, sale, terms, salePrices, rates);
            const c = costsFor(h, costs);
            return (
              <div
                key={h.id}
                className={`house-card${h.price === currentPrice ? ' active' : ''}`}
              >
                <div className="house-id">
                  <p className="house-name">{h.nickname}</p>
                  <p className="house-meta">
                    {money(h.price)} ·{' '}
                    {c.taxMode === 'fixed' ? `${money(c.taxAnnual)}/yr tax` : `${c.taxRatePct}% tax`}
                    {c.hoaMonthly > 0 ? ` · ${money(c.hoaMonthly)} HOA` : ''}
                  </p>
                </div>

                <div className="house-range">
                  <p className="house-range-figures">
                    {worst.isShort ? (
                      <span className="hi">can't close</span>
                    ) : (
                      <>
                        <span className="lo">{money(best.totalMonthly)}</span>
                        <span className="dash">–</span>
                        <span className="hi">{money(worst.totalMonthly)}</span>
                      </>
                    )}
                  </p>
                  <p className="house-range-label">per month</p>
                </div>

                <div className="house-actions">
                  <button type="button" className="btn quiet" onClick={() => onLoad(h)}>
                    Open in grid
                  </button>
                  <button type="button" className="btn quiet" onClick={() => onRemove(h.id)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {houses.length > 0 && !adding && (
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={startAdding}>
            Add another listing
          </button>
        </div>
      )}

      {adding && (
        <div className="panel add-house-form">
          <div className="field-grid">
            <div className="field">
              <label htmlFor="house-nickname">Nickname</label>
              <div className="input-wrap">
                <input
                  id="house-nickname"
                  type="text"
                  value={draft.nickname}
                  placeholder="Maple St."
                  onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
                />
              </div>
            </div>
            <NumberField
              label="Asking price"
              value={draft.price}
              onChange={(n) => setDraft({ ...draft, price: n })}
              prefix="$"
              grouped
              min={0}
            />
            <div className="field">
              <label htmlFor="house-tax">
                Property tax
                <span className="sub">
                  {' '}
                  · blank uses{' '}
                  {costs.taxMode === 'fixed' ? `${money(costs.taxAnnual)}/yr` : `${costs.taxRatePct}%`}
                </span>
              </label>
              <div className="input-wrap">
                {costs.taxMode === 'fixed' && <span className="affix">$</span>}
                <input
                  id="house-tax"
                  type="text"
                  inputMode="decimal"
                  value={draft.tax}
                  placeholder={String(
                    costs.taxMode === 'fixed' ? costs.taxAnnual : costs.taxRatePct,
                  )}
                  onChange={(e) => setDraft({ ...draft, tax: e.target.value })}
                />
                {costs.taxMode === 'percent' && <span className="affix">%</span>}
              </div>
            </div>
            <div className="field">
              <label htmlFor="house-hoa">
                HOA<span className="sub"> · per month</span>
              </label>
              <div className="input-wrap">
                <span className="affix">$</span>
                <input
                  id="house-hoa"
                  type="text"
                  inputMode="decimal"
                  value={draft.hoaMonthly}
                  placeholder={String(costs.hoaMonthly)}
                  onChange={(e) => setDraft({ ...draft, hoaMonthly: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="house-ins">
                Insurance<span className="sub"> · per year</span>
              </label>
              <div className="input-wrap">
                <span className="affix">$</span>
                <input
                  id="house-ins"
                  type="text"
                  inputMode="decimal"
                  value={draft.insuranceAnnual}
                  placeholder={String(costs.insuranceAnnual)}
                  onChange={(e) => setDraft({ ...draft, insuranceAnnual: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn primary" onClick={submit}>
              Save listing
            </button>
            <button type="button" className="btn" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
