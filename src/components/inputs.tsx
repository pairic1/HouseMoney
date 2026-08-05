import { useEffect, useId, useRef, useState } from 'react';

interface NumberFieldProps {
  label: string;
  sub?: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  /** Show thousands separators while the field is idle. */
  grouped?: boolean;
  min?: number;
  max?: number;
}

/**
 * Editing a number is a string operation — holding the raw text while focused
 * lets you clear the field or type "6." without the value snapping back.
 */
export function NumberField({
  label,
  sub,
  value,
  onChange,
  prefix,
  suffix,
  grouped,
  min,
  max,
}: NumberFieldProps) {
  // Not derived from the label: both house groups on the Long Run page carry an
  // "Insurance" and an "Upkeep", and duplicate ids would point every one of
  // those labels at the first matching input.
  const id = useId();
  const [raw, setRaw] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setRaw(null);
  }, [value]);

  const display =
    raw !== null
      ? raw
      : grouped
        ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
        : String(value);

  const commit = (text: string) => {
    setRaw(text);
    const cleaned = text.replace(/[,\s$%]/g, '');
    if (cleaned === '' || cleaned === '-') return;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return;
    let next = n;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    onChange(next);
  };

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {sub && <span className="sub"> · {sub}</span>}
      </label>
      <div className="input-wrap">
        {prefix && <span className="affix">{prefix}</span>}
        <input
          id={id}
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={display}
          onChange={(e) => commit(e.target.value)}
          onFocus={(e) => {
            setRaw(String(value));
            requestAnimationFrame(() => e.target.select());
          }}
          onBlur={() => setRaw(null)}
        />
        {suffix && <span className="affix">{suffix}</span>}
      </div>
    </div>
  );
}

interface SelectFieldProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <select
          id={id}
          value={String(value)}
          onChange={(e) => {
            const picked = options.find((o) => String(o.value) === e.target.value);
            if (picked) onChange(picked.value);
          }}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
