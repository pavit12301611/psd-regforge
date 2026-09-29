/**
 * RegForge — Indian Rupee (INR) amount helpers.
 *
 * Money is handled as **strings** end to end. Very large budgets never pass
 * through `Number()` / `parseInt()`, so a value such as ₹99,99,99,99,999 is
 * stored byte-for-byte in Firestore instead of being rounded, truncated or
 * replaced by `Infinity`.
 *
 * Canonical storage format: digits with an optional decimal point and up to two
 * decimal places, never any grouping characters — `"125000"`, `"125000.5"`,
 * `"0.75"`. Everything else stored under an INR question is treated as a legacy
 * value (for example the old "$1,000 – $3,000" radio answer) and is shown
 * exactly as it was saved.
 */

export const INR_SYMBOL = '₹';
export const CURRENCY_CODE = 'INR';
/** Paise are the smallest INR unit; more digits than this are ignored while typing. */
export const MAX_DECIMAL_DIGITS = 2;

const CANONICAL_AMOUNT = /^\d+(\.\d{1,2})?$/;

/** True when a stored value is in RegForge's canonical INR string format. */
export function isCanonicalAmount(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_AMOUNT.test(value);
}

/** Indian digit grouping: 1,000 · 10,000 · 1,25,000 · 10,00,000 · 1,00,00,000. */
export function groupIndianDigits(integerDigits: string): string {
  const digits = String(integerDigits).replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+$)/g, ',')},${tail}`;
}

/** Canonical string → grouped display text without the currency symbol. */
export function amountToDisplay(canonical: string): string {
  const [whole, fraction] = canonical.split('.');
  const grouped = groupIndianDigits(whole);
  if (fraction === undefined || fraction === '') return grouped;
  return `${grouped}.${fraction}`;
}

/**
 * Format any stored budget value for humans.
 * Canonical amounts become `₹1,25,000`; anything else (legacy radio answers) is
 * returned untouched so old data is never silently rewritten.
 */
export function formatINR(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return `${INR_SYMBOL}—`;
    return `${INR_SYMBOL}${amountToDisplay(String(Math.max(0, Math.trunc(value))))}`;
  }
  const text = value.trim();
  if (!text) return '';
  return isCanonicalAmount(text) ? `${INR_SYMBOL}${amountToDisplay(text)}` : text;
}

export interface AmountEntry {
  /** Grouped text to show inside the input (the `₹` is a separate prefix). */
  display: string;
  /** Canonical value to store, or `null` when the field has no digits yet. */
  canonical: string | null;
}

/**
 * Turn whatever the user typed — "₹1,25,000", "Rs 125000.50", "1,00,00,000" —
 * into grouped display text plus a canonical stored value.
 */
export function readAmountEntry(raw: string): AmountEntry {
  const stripped = raw.replace(/[^\d.]/g, '');
  const dot = stripped.indexOf('.');
  const wholeRaw = (dot === -1 ? stripped : stripped.slice(0, dot)).replace(/^0+(?=\d)/, '');
  const fraction = dot === -1
    ? ''
    : stripped.slice(dot + 1).replace(/\./g, '').slice(0, MAX_DECIMAL_DIGITS);
  const typedDecimalPoint = dot !== -1;

  if (!wholeRaw && !fraction) return { display: '', canonical: null };

  const whole = wholeRaw || '0';
  const display = `${groupIndianDigits(whole)}${typedDecimalPoint ? `.${fraction}` : ''}`;
  const canonical = `${whole}${typedDecimalPoint && fraction ? `.${fraction}` : ''}`;
  return { display, canonical };
}

/**
 * Caret index that keeps the cursor in place while grouping characters are
 * inserted or removed. `digitCount` is how many digits sat before the caret.
 */
export function caretIndexForDigits(display: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < display.length; i += 1) {
    if (display[i] >= '0' && display[i] <= '9') {
      seen += 1;
      if (seen === digitCount) {
        let index = i + 1;
        while (index < display.length && display[index] === ',') index += 1;
        return index;
      }
    }
  }
  return display.length;
}

/** Digits typed before the caret, used to restore the caret after re-grouping. */
export function digitsBefore(raw: string, caret: number): number {
  let count = 0;
  for (let i = 0; i < Math.min(caret, raw.length); i += 1) {
    if (raw[i] >= '0' && raw[i] <= '9') count += 1;
  }
  return count;
}

const SHORT_UNITS: Array<{ value: number; suffix: string }> = [
  { value: 1_00_00_000, suffix: 'crore' },
  { value: 1_00_000, suffix: 'lakh' },
  { value: 1_000, suffix: 'thousand' },
];

/**
 * Friendly Indian short form for a large amount ("₹1.25 lakh").
 * Only computed for amounts small enough to divide safely; longer values are
 * simply shown in full so nothing is ever rounded away.
 */
export function shortINR(canonical: string): string | null {
  if (!isCanonicalAmount(canonical)) return null;
  const [whole] = canonical.split('.');
  if (whole.length > 15) return null;
  const amount = Number(whole);
  if (!Number.isFinite(amount)) return null;
  for (const unit of SHORT_UNITS) {
    if (amount >= unit.value) {
      const scaled = Math.round((amount / unit.value) * 100) / 100;
      return `${INR_SYMBOL}${scaled.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${unit.suffix}`;
    }
  }
  return null;
}
