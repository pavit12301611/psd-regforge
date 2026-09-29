'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MODULES,
  overallProgress,
  isAnswered,
  missingRequired,
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

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

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
            .then((owns) => { if (alive) setWorkspacePreview(owns); })
            .catch(() => { if (alive) setWorkspacePreview(false); });
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
    document.getElementById(`module-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      <div className="mx-auto max-w-md px-4 py-20">
        <div className="card-pad text-center">
          <h1 className="text-lg font-bold text-white">Questionnaire not found</h1>
          <p className="muted mt-2">{loadError}</p>
          <Link href="/" className="btn-primary mt-5">
            Back to RegForge
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="card-pad text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/15 text-2xl">
            ✓
          </div>
          <h1 className="mt-4 text-xl font-bold text-white">Answers submitted — thank you!</h1>
          <p className="muted mx-auto mt-2 max-w-md">
            {item.clientName ? `${item.clientName}, your` : 'Your'} brief for{' '}
            <span className="text-slate-200">{item.title}</span> is in. Every answer is stored against
            this questionnaire.
          </p>
          <p className="mt-4 text-sm text-slate-300">
            {progress.done} of {progress.total} questions answered ({progress.percent}%)
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button className="btn-ghost" type="button" onClick={editAgain}>
              Edit my answers
            </button>
            {workspacePreview && (
              <Link href="/dashboard" className="btn-primary">
                Back to dashboard
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* header */}
      <div className="card-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="chip">{workspacePreview ? 'Workspace preview' : 'Client questionnaire'}</span>
            <h1 className="mt-3 text-xl font-bold text-white sm:text-2xl">{item.title}</h1>
            <p className="muted mt-1">
              {item.clientName ? `Prepared for ${item.clientName}` : 'Prepared for you'}
              {item.clientEmail ? ` · ${item.clientEmail}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-white">{progress.percent}%</p>
            <p className="text-xs text-slate-400">
              {progress.done}/{progress.total} answered
            </p>
            <p
              className={`mt-2 text-[11px] ${
                saveState === 'error'
                  ? 'text-rose-300'
                  : saveState === 'saving'
                    ? 'text-amber-200'
                    : 'text-emerald-300'
              }`}
            >
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'saved' && `All changes saved ${justSaved && `at ${justSaved}`}`}
              {saveState === 'error' && `Not saved: ${saveError}`}
              {saveState === 'idle' && 'Autosave on — answers save as you type'}
            </p>
          </div>
        </div>

        <div className="mt-4 bar">
          <div className="bar-fill" style={{ width: `${progress.percent}%` }} />
        </div>

        {showMissing && missing.length > 0 && (
          <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {missing.length} required question{missing.length > 1 ? 's' : ''} still empty:{' '}
            {missing.map((q) => q.label).join(' · ')}
          </div>
        )}

        {workspacePreview && (
          <p className="mt-4 text-xs text-slate-400">
            You are previewing a share link from your workspace.{' '}
            <Link href="/dashboard" className="underline hover:text-slate-200">
              Back to dashboard
            </Link>
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* module nav */}
        <nav className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-3">
            <p className="px-2 pb-2 text-[11px] uppercase tracking-wider text-slate-400">
              12 modules
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
                    className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition lg:w-full ${
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
                      className={`text-[10px] ${
                        complete ? 'text-emerald-300' : 'text-slate-500'
                      }`}
                    >
                      {complete ? '✓' : `${modDone}/${m.questions.length}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* questions */}
        <div className="space-y-6">
          {MODULES.map((m, mi) => (
            <section
              key={m.key}
              id={`module-${m.key}`}
              className="card-pad scroll-mt-24"
            >
              <header className="mb-5">
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

              <div className="space-y-3">
                {m.questions.map((q, qi) => {
                  const globalIndex =
                    MODULES.slice(0, mi).reduce((a, mod) => a + mod.questions.length, 0) + qi + 1;
                  const invalid =
                    showMissing && Boolean(q.required) && !isAnswered(q, answers[q.id]);
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
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button className="btn-primary" onClick={submit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit answers'}
              </button>
              <span className="text-xs text-slate-400">
                {progress.done}/{progress.total} answered · autosaved
              </span>
            </div>
          </section>

          <p className="pb-6 text-center text-[11px] text-slate-500">
            RegForge · this link is unique to {item.title}
          </p>
        </div>
      </div>
    </div>
  );
}
