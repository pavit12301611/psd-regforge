/**
 * RegForge — answer rendering.
 *
 * One place turns a stored answer into display text so the client form, the
 * creator dashboard, the answer detail view and the TXT/JSON export all agree.
 * Legacy values (for example the old dollar-range budget answer) are always
 * shown exactly as stored, flagged instead of rewritten.
 */
import { isAnswered, type AnswerValue, type Question } from './library';
import { formatINR, isCanonicalAmount } from './money';

export const NOT_ANSWERED = 'Not answered';

/** Note appended to values that were saved before a question changed. */
export const LEGACY_INR_NOTE = 'saved earlier — before the INR budget update';
export const LEGACY_OPTION_NOTE = 'saved earlier — not in the current option list';

export interface FormattedAnswer {
  answered: boolean;
  /** Pastable single-line text; arrays are joined with ", ". */
  text: string;
  /** Individual entries when the answer is an array (checkbox answers). */
  list: string[] | null;
  /** True when the value predates a question change and is shown verbatim. */
  legacy: boolean;
  /** Short explanation shown next to a legacy value. */
  note?: string;
}

function unanswered(): FormattedAnswer {
  return { answered: false, text: NOT_ANSWERED, list: null, legacy: false };
}

/** A stored value that is a non-empty string but is not one of the current options. */
function isStaleOption(question: Question, text: string): boolean {
  const options = question.options ?? [];
  if (!options.length || question.type === 'currency') return false;
  return !options.includes(text);
}

export function formatAnswer(question: Question, value: AnswerValue | undefined): FormattedAnswer {
  if (value === undefined || value === null) return unanswered();

  if (Array.isArray(value)) {
    const list = value.map((entry) => String(entry)).filter((entry) => entry.trim().length > 0);
    if (!list.length) return unanswered();
    return { answered: true, text: list.join(', '), list, legacy: false };
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return unanswered();
    if (question.type === 'currency') {
      return { answered: true, text: formatINR(value), list: null, legacy: false };
    }
    if (question.type === 'rating') {
      return { answered: value > 0, text: value > 0 ? `${value} / 5` : NOT_ANSWERED, list: null, legacy: false };
    }
    return { answered: value > 0, text: value > 0 ? String(value) : NOT_ANSWERED, list: null, legacy: false };
  }

  const text = value.trim();
  if (!text) return unanswered();

  if (question.type === 'currency') {
    if (isCanonicalAmount(text)) {
      return { answered: true, text: formatINR(text), list: null, legacy: false };
    }
    // Old radio answer such as "$1,000 – $3,000" or "Not sure yet — advise me".
    return {
      answered: true,
      text,
      list: null,
      legacy: true,
      note: LEGACY_INR_NOTE,
    };
  }

  if (isStaleOption(question, text)) {
    return { answered: true, text, list: null, legacy: true, note: LEGACY_OPTION_NOTE };
  }

  return { answered: true, text, list: null, legacy: false };
}

/** Budget value formatted as INR for compact UI spots (dashboard cards, chips). */
export function formatBudgetValue(value: AnswerValue | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.length ? value.join(', ') : null;
  const text = String(value).trim();
  if (!text) return null;
  return formatINR(text);
}
