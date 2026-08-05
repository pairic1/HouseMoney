const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** $1,234 — for anything the user reads at a glance. */
export function money(n: number): string {
  return usd0.format(Math.round(n));
}

/** $1,234.56 — for breakdowns where the cents matter. */
export function moneyExact(n: number): string {
  return usd2.format(n);
}

/** $850k / $1.2M / −$100k — compact axis labels. */
export function moneyShort(n: number): string {
  // Sign goes outside the currency symbol; "$-100k" reads badly on an axis.
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2).replace(/0$/, '')}M`;
  }
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}${money(abs)}`;
}

/** 6.75% */
export function pct(n: number, digits = 2): string {
  return `${n.toFixed(digits)}%`;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** June 2019 — for a purchase date. `month` is 1–12. */
export function monthYear(year: number, month: number, short = false): string {
  const name = MONTHS[Math.min(11, Math.max(0, Math.round(month) - 1))];
  return `${short ? name.slice(0, 3) : name} ${year}`;
}

/** 14 years, 2 months — for the PMI drop-off. */
export function monthsToYears(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} month${m === 1 ? '' : 's'}`;
  if (m === 0) return `${y} year${y === 1 ? '' : 's'}`;
  return `${y} yr ${m} mo`;
}
