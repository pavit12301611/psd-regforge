'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MODULES,
  overallProgress,
  type Question,
  type AnswerValue,
} from '@/lib/library';
import { formatAnswer, formatBudgetValue, NOT_ANSWERED } from '@/lib/answers';
import {
  briefFilename,
  buildJsonBrief,
  buildTxtBrief,
  copyToClipboard,
  downloadTextFile,
  formatTimestamp,
} from '@/lib/export';
import { currentGoogleUser } from '@/lib/firebase';
import {
  describeStoreError,
  getOwnedQuestionnaire,
  watchOwnedQuestionnaire,
  type Questionnaire,
  type StoreError,
} from '@/lib/store';
import { TopBar } from './Shell';
import { ToastStack, useToasts } from './Toast';

type SessionState = 'checking' | 'google' | 'blocked' | 'error';
type ViewState = 'loading' | 'ready' | 'empty' | 'denied' | 'error';

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-xs text-slate-200">{value}</dd>
    </div>
  );
}

export function AnswerBody({ question, value }: { question: Question; value: AnswerValue | undefined }) {
  const formatted = formatAnswer(question, value);

  if (!formatted.answered) {
    return (
      <p className="text-sm italic text-slate-500">
        {NOT_ANSWERED}
        {question.required ? ' — required, still empty' : ''}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {formatted.list && formatted.list.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {formatted.list.map((entry) => (
            <li
              key={entry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-100"
            >
              <span aria-hidden>✓</span>
              {entry}
            </li>
          ))}
        </ul>
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-100">
          {formatted.text}
        </p>
      )}

      {formatted.legacy && (
        <p className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-100">
          <span aria-hidden>⚠</span>
          {formatted.note ?? 'saved earlier — shown exactly as stored'}
        </p>
      )}
    </div>
  );
}

export default function AnswerDetail({ token }: { token: string }) {
  const [session, setSession] = useState<SessionState>('checking');
  const [view, setView] = useState<ViewState>('loading');
  const [item, setItem] = useState<Questionnaire | null>(null);
  const [error, setError] = useState<StoreError | null>(null);
  const [email, setEmail] = useState('');
  const [origin, setOrigin] = useState('');
  const [activeModule, setActiveModule] = useState(MODULES[0].key);
  const [retryKey, setRetryKey] = useState(0);
  const { toasts, push, dismiss } = useToasts();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    // React StrictMode runs effects twice in development, so reset on mount.
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /**
   * One-shot read of the same owner-only path. Used when the live listener
   * cannot attach (some networks block the realtime transport) so the creator
   * still gets the saved answers instead of an error screen.
   */
  const loadOnce = useCallback(async () => {
    try {
      const found = await getOwnedQuestionnaire(token);
      if (!alive.current) return 'gone' as const;
      if (!found) {
        setItem(null);
        setView('empty');
        return 'missing' as const;
      }
      setError(null);
      setItem(found);
      setView('ready');
      return 'ok' as const;
    } catch (err) {
      if (!alive.current) return 'gone' as const;
      const described = describeStoreError(err);
      setError(described);
      setView(described.kind === 'permission-denied' ? 'denied' : 'error');
      return 'failed' as const;
    }
  }, [token]);

  /* --------------------------------------------------- creator-only auth gate */
  useEffect(() => {
    let active = true;
    currentGoogleUser()
      .then((user) => {
        if (!active) return;
        if (!user) {
          // Anonymous shared-link sessions never reach the creator view.
          setSession('blocked');
          setError({
            kind: 'permission-denied',
            message: 'This answer view is private to the questionnaire creator.',
          });
          return;
        }
        setEmail(user.email ?? '');
        setOrigin(window.location.origin);
        setView('loading');
        setSession('google');
      })
      .catch((err) => {
        if (!active) return;
        setSession('error');
        setError(describeStoreError(err));
      });
    return () => {
      active = false;
    };
  }, [token]);

  /* ------------------------------------------ live read of the owned document */
  useEffect(() => {
    if (session !== 'google') return undefined;
    let first = true;
    return watchOwnedQuestionnaire(
      token,
      (found) => {
        first = false;
        if (!found) {
          setItem(null);
          setView('empty');
          return;
        }
        setError(null);
        setItem(found);
        setView('ready');
      },
      (err) => {
        // Fall back to a single document read: the answers are still shown if
        // only the realtime channel is unavailable.
        void loadOnce().then((result) => {
          if (result === 'ok') {
            push('Live updates are unavailable — showing the answers saved so far.', 'info');
          } else if (!first) {
            push(err.message, 'error');
          }
        });
      },
    );
  }, [token, session, retryKey, push, loadOnce]);

  /* ------------------------------------------------------------ scroll spy */
  useEffect(() => {
    if (view !== 'ready') return undefined;
    const container = scrollerRef.current;
    if (!container) return undefined;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        let current = MODULES[0].key;
        for (const module of MODULES) {
          const section = document.getElementById(`detail-module-${module.key}`);
          if (section && section.getBoundingClientRect().top <= 200) current = module.key;
        }
        setActiveModule(current);
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [view]);

  const progress = useMemo(() => overallProgress(item?.answers ?? {}), [item]);

  const directLink = item ? `${origin || ''}/q/${item.token}` : '';

  const download = useCallback(
    (kind: 'txt' | 'json') => {
      if (!item) return;
      const text = kind === 'txt' ? buildTxtBrief(item) : buildJsonBrief(item);
      const filename = briefFilename(item, kind);
      const ok = downloadTextFile(
        filename,
        text,
        kind === 'txt' ? 'text/plain;charset=utf-8' : 'application/json;charset=utf-8',
      );
      push(
        ok
          ? `Downloaded ${filename}`
          : 'The browser blocked the download. Try again, or use “Copy AI brief”.',
        ok ? 'success' : 'error',
      );
    },
    [item, push],
  );

  const copyBrief = useCallback(async () => {
    if (!item) return;
    const ok = await copyToClipboard(buildTxtBrief(item));
    push(
      ok
        ? 'AI-ready brief copied to clipboard.'
        : 'Clipboard access failed. Download the .txt brief instead.',
      ok ? 'success' : 'error',
    );
  }, [item, push]);

  const copyLink = useCallback(async () => {
    if (!item) return;
    const url = `${origin || window.location.origin}/q/${item.token}`;
    const ok = await copyToClipboard(url);
    push(ok ? 'Direct client link copied.' : 'Clipboard access failed — select the link manually.', ok ? 'success' : 'error');
  }, [item, origin, push]);

  function jump(key: string) {
    setActiveModule(key);
    document
      .getElementById(`detail-module-${key}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* --------------------------------------------------------------- rendering */

  if (session === 'checking' || (session === 'google' && view === 'loading')) {
    return (
      <div className="min-h-screen">
        <TopBar>
          <Link href="/dashboard" className="btn-ghost btn-sm">
            ← Dashboard
          </Link>
        </TopBar>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-spark-400" />
          <p className="muted mt-4">
            {session === 'checking' ? 'Checking your workspace session…' : 'Loading answers…'}
          </p>
        </div>
      </div>
    );
  }

  if (session === 'blocked' || view === 'denied') {
    return (
      <div className="min-h-screen">
        <TopBar>
          <Link href="/dashboard" className="btn-ghost btn-sm">
            ← Dashboard
          </Link>
        </TopBar>
        <div className="mx-auto max-w-md px-4 py-20">
          <div className="card-pad text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-400/15 text-2xl">
              🔒
            </div>
            <h1 className="mt-4 text-lg font-bold text-white">Creator access only</h1>
            <p className="muted mt-2">
              {error?.message ??
                'Sign in with the Google account that owns this questionnaire to read its answers.'}
            </p>
            <p className="help mt-3">
              Shared client links open <span className="font-mono">/q/&lt;token&gt;</span> only and can never
              load this page.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/" className="btn-primary">
                Sign in with Google
              </Link>
              {directLink && (
                <a href={directLink} className="btn-ghost">
                  Open client link
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'empty') {
    return (
      <div className="min-h-screen">
        <TopBar>
          <Link href="/dashboard" className="btn-ghost btn-sm">
            ← Dashboard
          </Link>
        </TopBar>
        <div className="mx-auto max-w-md px-4 py-20">
          <div className="card-pad text-center">
            <h1 className="text-lg font-bold text-white">Questionnaire not found</h1>
            <p className="muted mt-2">
              No questionnaire with that reference exists in your workspace ({email || 'your account'}).
              It may have been deleted, or the link may belong to another account.
            </p>
            <Link href="/dashboard" className="btn-primary mt-5">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (session === 'error' || view === 'error' || !item) {
    return (
      <div className="min-h-screen">
        <TopBar>
          <Link href="/dashboard" className="btn-ghost btn-sm">
            ← Dashboard
          </Link>
        </TopBar>
        <div className="mx-auto max-w-md px-4 py-20">
          <div className="card-pad text-center">
            <h1 className="text-lg font-bold text-white">Could not load the answers</h1>
            <p className="muted mt-2">{error?.message ?? 'Unexpected error while reading this document.'}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setError(null);
                  setView('loading');
                  setRetryKey((key) => key + 1);
                }}
              >
                Try again
              </button>
              <Link href="/dashboard" className="btn-ghost">
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const submitted = Boolean(item.submittedAt);
  const budget = formatBudgetValue(item.answers['budget.budget']);

  return (
    <div className="min-h-screen">
      <TopBar>
        <Link href="/dashboard" className="btn-ghost btn-sm">
          ← Dashboard
        </Link>
        <button type="button" className="btn-ghost btn-sm hidden sm:inline-flex" onClick={copyBrief}>
          Copy AI brief
        </button>
        <button type="button" className="btn-primary btn-sm" onClick={() => download('txt')}>
          Download .txt
        </button>
      </TopBar>

      <main ref={scrollerRef} className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <section className="card-pad">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`chip ${submitted ? 'chip-on' : 'chip-wait'}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {submitted ? 'Submitted' : 'In progress'}
                </span>
                <span className="chip" title="Answers update live while the client types">
                  Live
                </span>
                <span className="chip font-mono text-[10px]">{item.token}</span>
              </div>
              <h1 className="mt-3 text-xl font-bold text-white sm:text-2xl">{item.title}</h1>
              <p className="muted mt-1">
                {item.clientName || 'Unnamed client'}
                {item.clientEmail ? ` · ${item.clientEmail}` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-white">{progress.percent}%</p>
              <p className="text-xs text-slate-400">
                {progress.done}/{progress.total} answered
              </p>
            </div>
          </div>

          <div className="mt-4 bar" aria-hidden>
            <div className="bar-fill" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="sr-only" role="status">
            {progress.done} of {progress.total} questions answered.
          </p>

          <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MetaItem label="Created" value={formatTimestamp(item.createdAt)} />
            <MetaItem label="Last updated" value={formatTimestamp(item.updatedAt)} />
            <MetaItem
              label="Submitted"
              value={item.submittedAt ? formatTimestamp(item.submittedAt) : 'Not submitted yet'}
            />
            <MetaItem label="Budget" value={budget ?? NOT_ANSWERED} />
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => download('txt')}>
              Download .txt
            </button>
            <button type="button" className="btn-ghost w-full sm:w-auto" onClick={copyBrief}>
              Copy AI brief
            </button>
            <button type="button" className="btn-ghost w-full sm:w-auto" onClick={() => download('json')}>
              Download .json
            </button>
            <button type="button" className="btn-ghost w-full sm:w-auto" onClick={copyLink}>
              Copy client link
            </button>
            <a
              href={directLink || `/q/${item.token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost w-full sm:w-auto"
            >
              Open client link ↗
            </a>
          </div>

          <p className="help mt-4">
            {submitted
              ? 'The client has submitted this brief. Answers stay editable if they reopen the link.'
              : 'The client has not submitted yet — answers below update live as they type.'}
          </p>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Question modules" className="lg:sticky lg:top-24 lg:self-start">
            <div className="card p-3">
              <p className="px-2 pb-2 text-[11px] uppercase tracking-wider text-slate-400">
                {MODULES.length} modules
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                {MODULES.map((module, index) => {
                  const moduleAnswers = module.questions.filter(
                    (question) => formatAnswer(question, item.answers[question.id]).answered,
                  ).length;
                  const complete = moduleAnswers === module.questions.length;
                  return (
                    <button
                      key={module.key}
                      type="button"
                      onClick={() => jump(module.key)}
                      aria-current={activeModule === module.key ? 'true' : undefined}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-spark-400/70 lg:w-full ${
                        activeModule === module.key
                          ? 'bg-spark-500/20 text-white'
                          : 'text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-slate-500">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="flex-1 whitespace-nowrap lg:whitespace-normal">{module.title}</span>
                      <span className={`text-[10px] ${complete ? 'text-emerald-300' : 'text-slate-500'}`}>
                        {complete ? '✓' : `${moduleAnswers}/${module.questions.length}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          <div className="space-y-6">
            {MODULES.map((module, moduleIndex) => (
              <section
                key={module.key}
                id={`detail-module-${module.key}`}
                className="card-pad scroll-mt-32"
                aria-labelledby={`detail-module-title-${module.key}`}
              >
                <header className="mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">
                      {String(moduleIndex + 1).padStart(2, '0')}
                    </span>
                    <h2 id={`detail-module-title-${module.key}`} className="section-title">
                      {module.title} {module.icon && <span aria-hidden>{module.icon}</span>}
                    </h2>
                  </div>
                  <p className="muted mt-1">{module.blurb}</p>
                </header>

                <div className="space-y-3">
                  {module.questions.map((question, questionIndex) => {
                    const globalIndex =
                      MODULES.slice(0, moduleIndex).reduce(
                        (total, entry) => total + entry.questions.length,
                        0,
                      ) +
                      questionIndex +
                      1;
                    const formatted = formatAnswer(question, item.answers[question.id]);
                    return (
                      <article
                        key={question.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-[11px] font-bold text-slate-300">
                            {globalIndex}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold text-slate-100">
                              {question.label}
                              {question.required && (
                                <span className="ml-1 text-rose-300" title="Required">
                                  *
                                </span>
                              )}
                            </h3>
                            <p className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                                {question.id}
                              </span>
                              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                                {question.type}
                              </span>
                            </p>
                            <div className="mt-3">
                              <AnswerBody question={question} value={item.answers[question.id]} />
                            </div>
                            {formatted.answered && formatted.list && formatted.list.length > 0 && (
                              <p className="mt-2 text-[11px] text-slate-500">
                                {formatted.list.length} selected
                              </p>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}

            <section className="card-pad">
              <h2 className="section-title">Export this brief</h2>
              <p className="muted mt-1">
                The .txt file is plain text, built in your browser with a Blob, and structured to paste
                straight into an AI tool. It contains the answers above — never credentials or tokens.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => download('txt')}>
                  Download .txt
                </button>
                <button type="button" className="btn-ghost w-full sm:w-auto" onClick={copyBrief}>
                  Copy AI brief
                </button>
                <Link href="/dashboard" className="btn-ghost w-full sm:w-auto">
                  ← Back to dashboard
                </Link>
              </div>
            </section>

            <p className="pb-6 text-center text-[11px] text-slate-500">
              RegForge · answers for {item.title} · read from your private workspace
            </p>
          </div>
        </div>
      </main>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
