import { useState } from 'react';
import type { PlannedExpense, PropertyRef } from '../lib/projection';
import { money } from '../lib/format';

interface Props {
  expenses: PlannedExpense[];
  startYear: number;
  horizonYears: number;
  onChange: (next: PlannedExpense[]) => void;
}

const WHERE: { value: PropertyRef; label: string }[] = [
  { value: 'current', label: 'This house' },
  { value: 'next', label: 'The next one' },
  { value: 'both', label: 'Either house' },
];

const whereLabel = (r: PropertyRef) => WHERE.find((w) => w.value === r)?.label ?? r;

export function PlannedExpenses({ expenses, startYear, horizonYears, onChange }: Props) {
  const [label, setLabel] = useState('');
  const [year, setYear] = useState(String(startYear + 3));
  const [amount, setAmount] = useState('');
  const [appliesTo, setAppliesTo] = useState<PropertyRef>('current');

  const add = () => {
    const amt = Number(amount.replace(/[,\s$]/g, ''));
    const yr = Number(year);
    if (!Number.isFinite(amt) || amt <= 0 || !Number.isFinite(yr)) return;
    onChange([
      ...expenses,
      {
        id: crypto.randomUUID(),
        label: label.trim() || 'Expense',
        year: yr,
        amount: amt,
        appliesTo,
      },
    ]);
    setLabel('');
    setAmount('');
  };

  const sorted = [...expenses].sort((a, b) => a.year - b.year);
  const endYear = startYear + horizonYears;

  return (
    <div className="expenses">
      {sorted.length > 0 && (
        <ul className="expense-list">
          {sorted.map((e) => (
            <li key={e.id} className={e.year > endYear ? 'expense-row past-horizon' : 'expense-row'}>
              <span className="expense-year num">{e.year}</span>
              <span className="expense-label">{e.label}</span>
              <span className="expense-where">{whereLabel(e.appliesTo)}</span>
              <span className="expense-amount num">{money(e.amount)}</span>
              <button
                type="button"
                className="btn quiet"
                onClick={() => onChange(expenses.filter((x) => x.id !== e.id))}
                aria-label={`Remove ${e.label}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {sorted.some((e) => e.year > endYear) && (
        <p className="hint">
          Greyed rows fall outside the {horizonYears}-year window, so they aren't counted yet.
        </p>
      )}

      <div className="expense-form">
        <div className="field">
          <label htmlFor="exp-label">What</label>
          <div className="input-wrap">
            <input
              id="exp-label"
              type="text"
              value={label}
              placeholder="Roof"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="exp-year">Year</label>
          <div className="input-wrap">
            <input
              id="exp-year"
              type="text"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="exp-amount">Cost</label>
          <div className="input-wrap">
            <span className="affix">$</span>
            <input
              id="exp-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              placeholder="18,000"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="exp-where">Which house</label>
          <div className="input-wrap">
            <select
              id="exp-where"
              value={appliesTo}
              onChange={(e) => setAppliesTo(e.target.value as PropertyRef)}
            >
              {WHERE.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="btn primary expense-add" onClick={add}>
          Add
        </button>
      </div>

      <p className="hint">
        An expense only lands on a strategy that still owns that house when the year comes — a roof
        due in {startYear + 3} never hits a plan that sold in {startYear + 1}. That asymmetry is
        often the whole argument.
      </p>
    </div>
  );
}
