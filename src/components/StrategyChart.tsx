import { useId, useState } from 'react';
import { money, moneyShort } from '../lib/format';

export interface ChartSeries {
  key: string;
  label: string;
  /** One of the s-stay / s-sell / s-later palette classes. */
  className: string;
  values: number[];
}

interface Props {
  years: number[];
  series: ChartSeries[];
  crossings: { label: string; year: number }[];
  zeroNote: string;
}

const W = 760;
const H = 340;
const PAD = { top: 22, right: 116, bottom: 34, left: 66 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(raw))));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) out.push(v);
  return out;
}

export function StrategyChart({ years, series, crossings, zeroNote }: Props) {
  const titleId = useId();
  const [hoverYear, setHoverYear] = useState<number | null>(null);

  const lastYear = years[years.length - 1] ?? 1;
  const all = series.flatMap((s) => s.values);
  const rawMin = Math.min(...all, 0);
  const rawMax = Math.max(...all, 0);
  const pad = (rawMax - rawMin) * 0.08 || 1000;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;

  const x = (year: number) => PAD.left + (year / lastYear) * PLOT_W;
  const y = (v: number) => PAD.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;

  const yTicks = niceTicks(yMin, yMax);
  const xStep = lastYear > 20 ? 5 : lastYear > 10 ? 2 : 1;
  const xTicks: number[] = [];
  for (let v = 0; v <= lastYear; v += xStep) xTicks.push(v);

  const hoverIdx =
    hoverYear === null ? null : Math.max(0, Math.min(years.length - 1, Math.round(hoverYear)));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const yr = ((px - PAD.left) / PLOT_W) * lastYear;
    setHoverYear(yr < -0.5 || yr > lastYear + 0.5 ? null : yr);
  };

  // Avoid stacking end-labels on top of each other when lines finish close together.
  const labelYs = series.map((s) => y(s.values[s.values.length - 1]));
  const order = labelYs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const placed = new Array(series.length).fill(0);
  let lastY = -Infinity;
  for (const { v, i } of order) {
    const next = Math.max(v, lastY + 13);
    placed[i] = next;
    lastY = next;
  }

  return (
    <div className="chart-wrap">
      <div className="chart-scroll">
        <svg
        className="strategy-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={titleId}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverYear(null)}
      >
        <title id={titleId}>
          How far ahead or behind each plan runs against {zeroNote}, over {Math.round(lastYear)}{' '}
          years. Exact figures are in the table below.
        </title>

        {yTicks.map((t) => (
          <g key={t}>
            <line
              className={Math.abs(t) < 1e-9 ? 'axis-zero' : 'gridline'}
              x1={PAD.left}
              x2={PAD.left + PLOT_W}
              y1={y(t)}
              y2={y(t)}
            />
            <text
              className="tick"
              x={PAD.left - 9}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {Math.abs(t) < 1e-9 ? '0' : moneyShort(t)}
            </text>
          </g>
        ))}

        <text className="zero-note" x={PAD.left + 6} y={y(0) - 7}>
          {zeroNote}
        </text>

        {xTicks.map((t) => (
          <text key={t} className="tick" x={x(t)} y={H - 12} textAnchor="middle">
            {t === 0 ? 'now' : `${t}y`}
          </text>
        ))}

        {/* Where a line crosses zero the better choice changes — the whole point. */}
        {crossings.map((c) => (
          <g key={`${c.label}-${c.year}`}>
            <line
              className="crossover"
              x1={x(c.year)}
              x2={x(c.year)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
            />
            <text className="crossover-label" x={x(c.year)} y={PAD.top - 7} textAnchor="middle">
              {c.year.toFixed(1)}y
            </text>
          </g>
        ))}

        {series.map((s) => (
          <path
            key={s.key}
            className={`series ${s.className}`}
            d={s.values
              .map((v, k) => `${k === 0 ? 'M' : 'L'}${x(years[k]).toFixed(2)},${y(v).toFixed(2)}`)
              .join(' ')}
          />
        ))}

        {/* Direct labels, so identity never rests on color alone. */}
        {series.map((s, i) => (
          <text
            key={s.key}
            className={`series-label ${s.className}`}
            x={PAD.left + PLOT_W + 8}
            y={placed[i]}
            dominantBaseline="middle"
          >
            {s.label}
          </text>
        ))}

        {hoverIdx !== null && (
          <g>
            <line
              className="crosshair"
              x1={x(years[hoverIdx])}
              x2={x(years[hoverIdx])}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
            />
            {series.map((s) => (
              <circle
                key={s.key}
                className={`dot ${s.className}`}
                cx={x(years[hoverIdx])}
                cy={y(s.values[hoverIdx])}
                r={4}
              />
            ))}
          </g>
        )}
        </svg>
      </div>

      <div className="chart-readout">
        <span className="readout-year">
          {hoverIdx === null
            ? `Year ${Math.round(lastYear)}`
            : hoverIdx === 0
              ? 'Today'
              : `Year ${Math.round(years[hoverIdx])}`}
        </span>
        {series.map((s) => {
          const v = s.values[hoverIdx ?? s.values.length - 1];
          return (
            <span key={s.key} className="readout-item">
              <span className={`readout-swatch ${s.className}`} />
              {s.label}
              <strong className="num">
                {v >= 0 ? '+' : '−'}
                {money(Math.abs(v))}
              </strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}
