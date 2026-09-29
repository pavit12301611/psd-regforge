'use client';

import type { AnswerValue, Question } from '@/lib/library';

interface Props {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue | undefined) => void;
  number: number;
  invalid?: boolean;
}

export default function QuestionField({ question, value, onChange, number, invalid }: Props) {
  const options = question.options ?? [];

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
      className={`scroll-mt-28 rounded-2xl border p-4 transition ${
        invalid ? 'border-rose-400/50 bg-rose-500/[0.06]' : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-[11px] font-bold text-slate-300">
          {number}
        </span>
        <label className="label flex-1">
          {question.label}
          {question.required && <span className="ml-1 text-rose-300">*</span>}
        </label>
      </div>

      {question.help && <p className="help ml-9">{question.help}</p>}

      <div className="ml-9 mt-3">
        {question.type === 'text' && (
          <input
            className="input"
            placeholder={question.placeholder}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )}

        {question.type === 'textarea' && (
          <textarea
            className="input min-h-[104px] resize-y leading-relaxed"
            placeholder={question.placeholder}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )}

        {question.type === 'rating' && (
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(value === n ? undefined : n)}
                aria-pressed={value === n}
                className={`h-11 w-11 rounded-xl border text-sm font-bold transition ${
                  value === n
                    ? 'border-spark-400/60 bg-spark-500/20 text-white'
                    : 'border-white/[0.12] bg-white/[0.04] text-slate-300 hover:border-white/30'
                }`}
              >
                {n}
              </button>
            ))}
            <span className="self-center text-xs text-slate-400">
              {value ? `${value} / 5` : 'Not rated yet'}
            </span>
          </div>
        )}

        {question.type === 'radio' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((option) => (
              <label
                key={option}
                className={`option ${value === option ? 'option-on' : ''}`}
              >
                <input
                  type="radio"
                  name={question.id}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-spark-500"
                  checked={value === option}
                  onChange={() => onChange(value === option ? undefined : option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        )}

        {question.type === 'checkbox' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((option) => (
              <label
                key={option}
                className={`option ${selected.includes(option) ? 'option-on' : ''}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-spark-500"
                  checked={selected.includes(option)}
                  onChange={() => toggleOption(option)}
                />
                <span>{option}</span>
              </label>
            ))}
            {selected.length > 0 && (
              <p className="text-xs text-slate-400 sm:col-span-2">
                {selected.length} selected — <button
                  type="button"
                  className="underline hover:text-slate-200"
                  onClick={() => onChange([])}
                >
                  clear
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
