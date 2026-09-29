'use client';

import { useEffect, useRef, useState } from 'react';
import type { AnswerValue } from '@/lib/library';
import {
  INR_SYMBOL,
  amountToDisplay,
  caretIndexForDigits,
  digitsBefore,
  isCanonicalAmount,
  readAmountEntry,
  shortINR,
} from '@/lib/money';

interface Props {
  /** Stable question id — used for ids, labels and error wiring. */
  id: string;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue | undefined) => void;
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
  /** Help text is rendered by the parent; the field only needs its id. */
  describedById?: string;
  /** Id of the visible question label, so the input is announced correctly. */
  labelledById?: string;
}

/**
 * Free-form Indian Rupee input.
 *
 * - `inputMode="decimal"` so mobile keypads open the number pad.
 * - Groups digits live in Indian style (₹1,25,000) without moving the caret.
 * - Stores the cleaned amount as a string, so ₹99,99,99,99,999 never overflows.
 * - A value saved by the old dollar-range radio question is preserved and shown
 *   verbatim; it is only replaced when the user deliberately types a new amount,
 *   or removed through the explicit Clear action.
 */
export default function CurrencyField({
  id,
  value,
  onChange,
  placeholder,
  required,
  invalid,
  describedById,
  labelledById,
}: Props) {
  const inputId = `${id}-input`;
  const errorId = `${id}-error`;
  const legacyId = `${id}-legacy`;
  const hintId = `${id}-hint`;

  const stored = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  const canonicalStored = isCanonicalAmount(stored) ? stored : null;
  const legacyStored = stored && !canonicalStored ? stored : '';
  const [text, setText] = useState(canonicalStored ? amountToDisplay(canonicalStored) : '');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingCaretDigits = useRef<number | null>(null);

  // Reflect external changes (detail reload, cleared legacy value, reset) while
  // leaving the user's own in-progress typing untouched.
  useEffect(() => {
    const next = canonicalStored ? amountToDisplay(canonicalStored) : '';
    setText((current) => (current === next ? current : next));
  }, [canonicalStored]);

  useEffect(() => {
    const element = inputRef.current;
    if (!element || pendingCaretDigits.current === null) return;
    const index = caretIndexForDigits(element.value, pendingCaretDigits.current);
    pendingCaretDigits.current = null;
    try {
      element.setSelectionRange(index, index);
    } catch {
      /* setSelectionRange is unavailable in a few embedded browsers. */
    }
  }, [text]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const element = event.target;
    const raw = element.value;
    const caret = element.selectionStart ?? raw.length;
    pendingCaretDigits.current = digitsBefore(raw, caret);
    const { display, canonical } = readAmountEntry(raw);
    setText(display);
    // A value saved by the old radio question is never dropped by stray
    // keystrokes: it is only replaced by a real amount, or removed through the
    // explicit Clear action below (which asks for confirmation).
    if (canonical === null && legacyStored) return;
    onChange(canonical ?? undefined);
  }

  function clear(removeLegacy = false) {
    if (
      removeLegacy &&
      !window.confirm('Remove the earlier saved budget answer? This cannot be undone.')
    ) {
      return;
    }
    setText('');
    onChange(undefined);
  }

  const short = canonicalStored ? shortINR(canonicalStored) : null;
  const described = [describedById, hintId, legacyStored ? legacyId : null, invalid ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-ink-800/80 px-3.5 transition focus-within:ring-2 ${
          invalid
            ? 'border-rose-400/60 focus-within:border-rose-300 focus-within:ring-rose-500/25'
            : 'border-white/[0.12] focus-within:border-spark-400/70 focus-within:ring-spark-500/25'
        }`}
      >
        <span aria-hidden className="select-none text-base font-semibold text-slate-300">
          {INR_SYMBOL}
        </span>
        <input
          id={inputId}
          ref={inputRef}
          className="w-full bg-transparent py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder={placeholder ?? `e.g. ${INR_SYMBOL}50,000`}
          value={text}
          onChange={handleChange}
          aria-label={labelledById ? undefined : `Amount in Indian Rupees${required ? ' (required)' : ''}`}
          aria-labelledby={labelledById}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={described || undefined}
          aria-errormessage={invalid ? errorId : undefined}
        />
        {(text || legacyStored) && (
          <button
            type="button"
            onClick={() => clear(Boolean(legacyStored))}
            className="rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-spark-400/70"
            aria-label={legacyStored ? 'Remove earlier saved budget answer' : 'Clear budget amount'}
          >
            Clear
          </button>
        )}
      </div>

      <p id={hintId} className="text-xs text-slate-400">
        {canonicalStored
          ? `Saved as ${INR_SYMBOL}${amountToDisplay(canonicalStored)}${short ? ` — about ${short}` : ''}.`
          : 'Enter any amount in Indian Rupees (INR). Commas are optional.'}
      </p>

      {legacyStored && (
        <div
          id={legacyId}
          role="status"
          className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100"
        >
          <span className="font-semibold">Earlier answer kept:</span>{' '}
          <span className="break-all">{legacyStored}</span>
          <span className="mt-1 block text-amber-200/80">
            This was saved before the budget question became a free-form INR amount. It is shown
            exactly as stored and is not overwritten unless you type a new amount.
          </span>
        </div>
      )}

      {invalid && (
        <p id={errorId} role="alert" className="text-xs font-medium text-rose-200">
          Enter your budget as an amount in Indian Rupees, or leave it blank if you are not sure yet.
        </p>
      )}
    </div>
  );
}
