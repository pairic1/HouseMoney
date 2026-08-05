import { useState } from 'react';

interface Props {
  moveYears: number[];
  horizonYears: number;
  /** Palette class per plan, in the same order the chart draws them. */
  classNames: string[];
  max: number;
  onChange: (next: number[]) => void;
}

/**
 * "Wait, then move" isn't one plan — waiting five years and waiting ten are
 * different bets, and the whole question is which timing wins. Each row here
 * becomes its own line on the chart.
 */
export function MovePlans({ moveYears, horizonYears, classNames, max, onChange }: Props) {
  const [draft, setDraft] = useState('');

  const sorted = [...moveYears].sort((a, b) => a - b);
  const full = sorted.length >= max;

  const add = () => {
    const y = Number(draft);
    if (!Number.isFinite(y) || y <= 0 || y > horizonYears) return;
    if (sorted.includes(y)) return;
    onChange([...sorted, y].sort((a, b) => a - b));
    setDraft('');
  };

  return (
    <div className="move-plans">
      <ul className="move-list">
        {sorted.map((y, i) => (
          <li key={y} className="move-row">
            <span className={`readout-swatch ${classNames[i] ?? ''}`} />
            <span className="move-when">
              Move in <strong className="num">{y}</strong> {y === 1 ? 'year' : 'years'}
            </span>
            <button
              type="button"
              className="btn quiet"
              onClick={() => onChange(sorted.filter((x) => x !== y))}
              aria-label={`Remove the move-in-${y}-years plan`}
            >
              Remove
            </button>
          </li>
        ))}
        {sorted.length === 0 && (
          <li className="move-row empty">
            No wait-then-move plans — just staying put against selling now.
          </li>
        )}
      </ul>

      {!full && (
        <div className="move-form">
          <div className="field">
            <label htmlFor="move-add">Add a plan · move after</label>
            <div className="input-wrap">
              <input
                id="move-add"
                type="text"
                inputMode="numeric"
                value={draft}
                placeholder="7"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
              />
              <span className="affix">yr</span>
            </div>
          </div>
          <button type="button" className="btn primary" onClick={add}>
            Add
          </button>
        </div>
      )}

      <p className="hint">
        {full
          ? `${max} plans is the limit — past that the lines stop being tellable apart.`
          : `Up to ${max} timings at once, anywhere inside the ${horizonYears}-year window.`}{' '}
        Each one is identical to staying put until its move date, so its line rides the zero
        baseline until then — that's the dashed stretch on the chart.
      </p>
    </div>
  );
}
