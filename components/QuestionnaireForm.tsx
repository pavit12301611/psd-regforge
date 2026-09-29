'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MODULES,
  isAnswered,
  missingRequired,
  overallProgress,
  type AnswerValue,
  type Answers,
} from '@/lib/library';
import {
  currentUserOwnsQuestionnaire,
  getQuestionnaire,
  reopenQuestionnaire,
  saveAnswers,
  submitQuestionnaire,
  type Questionnaire,
} from '@/lib/store';
import QuestionField from './QuestionField';
import Sheet from './Sheet';
import Icon from './Icon';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_TEXT: Record<SaveState, string> = {
  idle: 'Autosave on',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved',
};

export default function QuestionnaireForm({ token }: { token: string }) {
  const [item, setItem] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [activeModule, setActiveModule] = useState(MODULES[0].key);
  const [justSaved, setJustSaved] = useState<string>('');
  const [workspacePreview, setWorkspacePreview] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);

  const dirty = useRef(false);

  /* ------------------------------------------------------------------- load */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const found = await getQuestionnaire(token);
        if (!alive) return;
        if (!found) {
          setLoadError(
            'This questionnaire could not be found. Check the link, or ask the workspace owner to resend it.',
          );
        } else {
          setItem(found);
          setAnswers(found.answers ?? {});
          setSubmitted(Boolean(found.submittedAt));
          currentUserOwnsQuestionnaire(token)
            .then((owns) => {
              if (alive) setWorkspacePreview(owns);
            })
            .catch(() => {
              if (alive) setWorkspacePreview(false);
            });
        }
      } catch (err) {
        if (alive) setLoadError(err instanceof Error ? err.message : 'Could not load the questionnaire.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  /* --------------------------------------------------------------- autosave */
  useEffect(() => {
    if (!item || !dirty.current) return;
    setSaveState('saving');
    const handle = window.setTimeout(async () => {
      try {
        await saveAnswers(token, answers);
        dirty.current = false;
        setSaveState('saved');
        setSaveError('');
        setJustSaved(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
      } catch (err) {
        setSaveState('error');
        setSaveError(err instanceof Error ? err.message : 'Autosave failed.');
      }
    }, 600);
    return () => window.clearTimeout(handle);
  }, [answers, item, token]);

  const progress = useMemo(() => overallProgress(answers), [answers]);
  const missing = useMemo(() => missingRequired(answers), [answers]);

  const update = useCallback((id: string, value: AnswerValue | undefined) => {
    dirty.current = true;
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined || (typeof value === 'string' && value.length === 0) ||
        (Array.isArray(value) && value.length === 0)) {
        delete next[id];
      } else {
        next[id] = value;
      }
      return next;
    });
  }, []);

  /* --------------------------------------------------- active module tracking */
  useEffect(() => {
    if (!item || submitted) return undefined;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        let current = MODULES[0].key;
        for (const module of MODULES) {
          const section = document.getElementById(`module-${module.key}`);
          if (section && section.getBoundingClientRect().top <= 180) current = module.key;
        }
        setActiveModule(current);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [item, submitted]);

  async function submit() {
    setShowMissing(true);
    if (missing.length > 0) {
      const first = document.getElementById(`q-${missing[0].id}`);
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    try {
      await submitQuestionnaire(token, answers);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : 'Submission failed — try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function editAgain() {
    try {
      await reopenQuestionnaire(token);
      setSubmitted(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not reopen.');
    }
  }

  function jump(key: string) {
    setActiveModule(key);
    setModulesOpen(false);
    const section = document.getElementById(`module-${key}`);
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function jumpToMissing() {
    if (!missing.length) return;
    const first = document.getElementById(`q-${missing[0].id}`);
    first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-spark-400" />
        <p className="muted mt-4">Loading questionnaire…</p>
      </div>
    );
  }

  if (loadError || !item) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:py-20">
        <div className="card-pad text-center">
          <h1 className="text-lg font-bold text-white">Questionnaire not found</h1>
          <p className="muted mt-2">{loadError}</p>
          <Link href="/" className="btn-primary mt-5 w-full sm:w-auto">
            Back to RegForge
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="card-pad text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300">
            <Icon name="check" className="h-8 w-8" strokeWidth={2.4} />
          </div>
          <h1 className="mt-4 text-xl font-bold leading-snug text-white sm:text-2xl">
            Answers submitted — thank you!
          </h1>
          <p className="muted mx-auto mt-2 max-w-md">
            {item.clientName ? `${item.clientName}, your` : 'Your'} brief for{' '}
            <span className="text-slate-200">{item.title}</span> is in. Every answer is stored against
            this questionnaire.
          </p>

          <dl className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-2 text-left">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-slate-400">Answered</dt>
              <dd className="mt-0.5 text-sm font-semibold text-white">
                {progress.done}/{progress.total}
              </dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-slate-400">Completion</dt>
              <dd className="mt-0.5 text-sm font-semibold text-white">{progress.percent}%</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button className="btn-ghost w-full sm:w-auto" type="button" onClick={editAgain}>
              Edit my answers
            </button>
            {workspacePreview && (
              <Link href="/dashboard" className="btn-primary w-full sm:w-auto">
                Back to dashboard
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const saveTone =
    saveState === 'error'
      ? 'text-rose-300'
      : saveState === 'saving'
        ? 'text-amber-200'
        : 'text-emerald-300';

  return (
    <div className="min-h-dvh" style={{ ['--bottom-bar-h' as string]: '4.75rem' }}>
      {/* Sticky progress rail: modules, completion and save state stay in reach
          while the client scrolls 50 questions on a phone. */}
      <div className="sticky-under-topbar pad-safe-x sticky z-30 border-b border-white/10 bg-ink-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
          <button
            type="button"
            className="btn-ghost btn-sm shrink-0 px-3 lg:hidden"
            onClick={() => setModulesOpen(true)}
            aria-haspopup="dialog"
          >
            <Icon name="list" className="h-4 w-4" />
            Modules
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3 text-[11px] text-slate-400">
              <span className="truncate">
                <span className="font-semibold text-white">{progress.percent}%</span> · {progress.done}/
                {progress.total} answered
              </span>
              <span className={`shrink-0 ${saveTone}`}>
                {saveState === 'saved' && justSaved ? `Saved ${justSaved}` : SAVE_TEXT[saveState]}
              </span>
            </div>
            <div className="bar mt-1.5 h-1.5" aria-hidden>
              <div className="bar-fill" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        </div>
      </div>

      <main className="pad-safe-x clear-bottom-bar mx-auto max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
        {/* header */}
        <div className="card-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="chip">{workspacePreview ? 'Workspace preview' : 'Client questionnaire'}</span>
              <h1 className="mt-2.5 text-xl font-bold leading-snug text-white sm:text-2xl">{item.title}</h1>
              <p className="muted mt-1 break-words">
                {item.clientName ? `Prepared for ${item.clientName}` : 'Prepared for you'}
                {item.clientEmail ? ` · ${item.clientEmail}` : ''}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-3xl font-black leading-none text-white">{progress.percent}%</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {progress.done}/{progress.total} answered
              </p>
            </div>
          </div>

          <dl className="mt-4 card px-3.5 py-1 sm:px-4">
            <div className="meta-row">
              <dt className="meta-key">Autosave</dt>
              <dd className={`meta-value ${saveTone}`}>
                {saveState === 'saving' && 'Saving your answers…'}
                {saveState === 'saved' && `Saved ${justSaved ? `at ${justSaved}` : 'just now'}`}
                {saveState === 'error' && `Not saved: ${saveError}`}
                {saveState === 'idle' && 'On — answers save as you type'}
              </dd>
            </div>
            <div className="meta-row">
              <dt className="meta-key">Sections</dt>
              <dd className="meta-value">{MODULES.length} modules</dd>
            </div>
            {missing.length > 0 && (
              <div className="meta-row">
                <dt className="meta-key">Still needed</dt>
                <dd className="meta-value text-amber-200">
                  {missing.length} required question{missing.length > 1 ? 's' : ''}
                </dd>
              </div>
            )}
          </dl>

          {showMissing && missing.length > 0 && (
            <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
              <p className="font-semibold">
                {missing.length} required question{missing.length > 1 ? 's' : ''} still empty
              </p>
              <p className="mt-1 leading-relaxed">
                {missing.slice(0, 3).map((q) => q.label).join(' · ')}
                {missing.length > 3 ? ` · and ${missing.length - 3} more` : ''}
              </p>
              <button type="button" className="btn-ghost btn-sm mt-2 w-full sm:w-auto" onClick={jumpToMissing}>
                Go to first empty question
              </button>
            </div>
          )}

          {workspacePreview && (
            <p className="mt-3 text-xs text-slate-400">
              You are previewing a share link from your workspace.{' '}
              <Link href="/dashboard" className="underline hover:text-slate-200">
                Back to dashboard
              </Link>
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[240px_1fr] lg:gap-6 sm:mt-6">
          {/* module nav — desktop rail */}
          <nav
            className="hidden lg:sticky lg:top-[7.5rem] lg:block lg:self-start"
            aria-label="Question modules"
          >
            <div className="card p-3">
              <p className="px-2 pb-2 text-[11px] uppercase tracking-wider text-slate-400">
                {MODULES.length} modules
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                {MODULES.map((m, i) => {
                  const modDone = m.questions.filter((q) => isAnswered(q, answers[q.id])).length;
                  const complete = modDone === m.questions.length;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => jump(m.key)}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-spark-400/70 lg:w-full ${
                        activeModule === m.key
                          ? 'bg-spark-500/20 text-white'
                          : 'text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-slate-500">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="flex-1 whitespace-nowrap lg:whitespace-normal">{m.title}</span>
                      <span
                        className={`flex items-center gap-1 text-[10px] ${
                          complete ? 'text-emerald-300' : 'text-slate-500'
                        }`}
                      >
                        {complete && <Icon name="check" className="h-3 w-3" strokeWidth={2.6} />}
                        {complete ? 'done' : `${modDone}/${m.questions.length}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* questions */}
          <div className="space-y-4 sm:space-y-6">
            {MODULES.map((m, mi) => (
              <section key={m.key} id={`module-${m.key}`} className="card-pad scroll-mt-[9rem]">
                <header className="mb-4 sm:mb-5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">
                      {String(mi + 1).padStart(2, '0')}
                    </span>
                    <h2 className="section-title">
                      {m.title} {m.icon && <span aria-hidden>{m.icon}</span>}
                    </h2>
                  </div>
                  <p className="muted mt-1">{m.blurb}</p>
                </header>

                <div className="space-y-2.5 sm:space-y-3">
                  {m.questions.map((q, qi) => {
                    const globalIndex =
                      MODULES.slice(0, mi).reduce((a, mod) => a + mod.questions.length, 0) + qi + 1;
                    const invalid = showMissing && Boolean(q.required) && !isAnswered(q, answers[q.id]);
                    return (
                      <QuestionField
                        key={q.id}
                        question={q}
                        number={globalIndex}
                        value={answers[q.id]}
                        onChange={(v) => update(q.id, v)}
                        invalid={invalid}
                      />
                    );
                  })}
                </div>

                {/* Phone-friendly "keep going" affordance at the end of each section. */}
                {mi < MODULES.length - 1 && (
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
                    <span className="text-[11px] text-slate-500">
                      Module {mi + 1} of {MODULES.length}
                    </span>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => jump(MODULES[mi + 1].key)}
                    >
                      Next: {MODULES[mi + 1].title}
                      <Icon name="chevron-right" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </section>
            ))}

            {/* submit */}
            <section className="card-pad">
              <h2 className="section-title">Ready to send?</h2>
              <p className="muted mt-1">
                {missing.length === 0
                  ? 'All required questions are answered. Submit whenever you like — your workspace receives the full brief instantly.'
                  : `${missing.length} required question${missing.length > 1 ? 's' : ''} still empty.`}
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button className="btn-primary w-full sm:w-auto" onClick={submit} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit answers'}
                </button>
                <span className="text-xs text-slate-400">
                  {progress.done}/{progress.total} answered · autosaved
                </span>
              </div>
            </section>

            <p className="pb-4 text-center text-[11px] text-slate-500">
              RegForge · this link is unique to {item.title}
            </p>
          </div>
        </div>
      </main>

      {/* Module jump list — the phone replacement for the desktop sidebar. */}
      <Sheet
        open={modulesOpen}
        onClose={() => setModulesOpen(false)}
        title="Jump to a module"
        description={`${progress.done} of ${progress.total} questions answered · ${progress.percent}% complete`}
      >
        <ul className="space-y-1.5">
          {MODULES.map((module, index) => {
            const modDone = module.questions.filter((q) => isAnswered(q, answers[q.id])).length;
            const complete = modDone === module.questions.length;
            return (
              <li key={module.key}>
                <button
                  type="button"
                  onClick={() => jump(module.key)}
                  aria-current={activeModule === module.key ? 'true' : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-spark-400/70 ${
                    activeModule === module.key
                      ? 'border-spark-400/60 bg-spark-500/15 text-white'
                      : 'border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/25'
                  }`}
                  style={{ minHeight: '3.25rem' }}
                >
                  <span className="font-mono text-[11px] text-slate-500">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{module.title}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">
                      {modDone}/{module.questions.length} answered
                    </span>
                  </span>
                  <span className={complete ? 'text-emerald-300' : 'text-slate-500'}>
                    <Icon name={complete ? 'check' : 'chevron-right'} className="h-4 w-4" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="help mt-3">
          Answers save automatically — you can close this list and come back to any section later.
        </p>
      </Sheet>

      {/* Floating submit bar: always one thumb-tap away on a long form. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-900/95 backdrop-blur"
        style={{ paddingBottom: 'var(--safe-b)' }}
      >
        <div className="pad-safe-x mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] text-slate-400">
              <span className="font-semibold text-white">{progress.done}</span>/{progress.total} answered
              {missing.length > 0 ? ` · ${missing.length} required left` : ' · all required done'}
            </p>
            <p className={`truncate text-[11px] ${saveTone}`}>
              {saveState === 'error' ? 'Not saved — check connection' : SAVE_TEXT[saveState]}
            </p>
          </div>
          <button
            className="btn-primary shrink-0 px-5"
            onClick={submit}
            disabled={submitting}
            type="button"
            style={{ minHeight: '3rem' }}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
