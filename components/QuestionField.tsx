'use client';

import type { AnswerValue, Question } from '@/lib/library';
import CurrencyField from './CurrencyField';

interface Props {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue | undefined) => void;
  number: number;
  invalid?: boolean;
}

export default function QuestionField({ question, value, onChange, number, invalid }: Props) {
  const options = question.options ?? [];
  const helpId = `${question.id}-help`;
  const fieldId = `${question.id}-input`;
  const labelId = `${question.id}-label`;
  const labelTargetsField = question.type === 'text' || question.type === 'textarea';

  function toggleOption(option: string) {
    const current = Array.isArray(value) ? value : [];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    onChange(next);
  }

  const selected = Array.isArray(value) ? value : [];

  return (
    <div
      id={`q-${question.id}`}
      className={`scroll-mt-[9rem] rounded-2xl border p-3.5 transition sm:p-4 ${
        invalid ? 'border-rose-400/50 bg-rose-500/[0.06]' : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <span className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-[11px] font-bold text-slate-300">
          {number}
        </span>
        <label
          id={labelId}
          className="label min-w-0 flex-1 leading-snug"
          htmlFor={labelTargetsField ? fieldId : undefined}
        >
          {question.label}
          {question.required && (
            <span className="ml-1 text-rose-300" aria-hidden>
              *
            </span>
          )}
          {question.required && <span className="sr-only"> (required)</span>}
        </label>
      </div>

      {question.help && (
        <p id={helpId} className="help ml-0 sm:ml-9">
          {question.help}
        </p>
      )}

      <div className="mt-3 sm:ml-9">
        {question.type === 'text' && (
          <input
            id={fieldId}
            className="input"
            placeholder={question.placeholder}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={question.help ? helpId : undefined}
            autoComplete="off"
            enterKeyHint="next"
          />
        )}

        {question.type === 'textarea' && (
          <textarea
            id={fieldId}
            className="input min-h-[7rem] resize-y leading-relaxed"
            placeholder={question.placeholder}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={question.help ? helpId : undefined}
            enterKeyHint="done"
          />
        )}

        {question.type === 'currency' && (
          <CurrencyField
            id={question.id}
            value={value}
            onChange={onChange}
            placeholder={question.placeholder}
            required={question.required}
            invalid={invalid}
            describedById={question.help ? helpId : undefined}
            labelledById={labelId}
          />
        )}

        {question.type === 'rating' && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={question.label}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(value === n ? undefined : n)}
                aria-pressed={value === n}
                aria-label={`${n} out of 5`}
                className={`h-12 w-12 rounded-xl border text-base font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-spark-400/70 sm:h-11 sm:w-11 sm:text-sm ${
                  value === n
                    ? 'border-spark-400/60 bg-spark-500/20 text-white'
                    : 'border-white/[0.12] bg-white/[0.04] text-slate-300 hover:border-white/30'
                }`}
              >
                {n}
              </button>
            ))}
            <span className="text-xs text-slate-400">{value ? `${value} / 5` : 'Not rated yet'}</span>
          </div>
        )}

        {question.type === 'radio' && (
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={question.label}>
            {options.map((option) => (
              <label
                key={option}
                className={`option focus-within:ring-2 focus-within:ring-spark-400/60 ${
                  value === option ? 'option-on' : ''
                }`}
              >
                <input
                  type="radio"
                  name={question.id}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-spark-500"
                  checked={value === option}
                  onChange={() => onChange(value === option ? undefined : option)}
                />
                <span className="min-w-0 leading-snug">{option}</span>
              </label>
            ))}
          </div>
        )}

        {question.type === 'checkbox' && (
          <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={question.label}>
            {options.map((option) => (
              <label
                key={option}
                className={`option focus-within:ring-2 focus-within:ring-spark-400/60 ${
                  selected.includes(option) ? 'option-on' : ''
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 accent-spark-500"
                  checked={selected.includes(option)}
                  onChange={() => toggleOption(option)}
                />
                <span className="min-w-0 leading-snug">{option}</span>
              </label>
            ))}
            {selected.length > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-slate-400 sm:col-span-2">
                <span>
                  {selected.length} selected —{' '}
                  <button
                    type="button"
                    className="rounded underline hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-spark-400/70"
                    onClick={() => onChange([])}
                  >
                    clear all
                  </button>
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
