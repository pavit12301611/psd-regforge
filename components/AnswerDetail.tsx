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
} from '@/lib/export';
import { absoluteTime, relativeTime } from '@/lib/time';
import { currentGoogleUser, fbSignOut } from '@/lib/firebase';
import {
  describeStoreError,
  getOwnedQuestionnaire,
  watchOwnedQuestionnaire,
  type Questionnaire,
  type StoreError,
} from '@/lib/store';
import { AccountButton, TopBar } from './Shell';
import Sheet, { ActionList, type SheetAction } from './Sheet';
import Icon from './Icon';
import { ToastStack, useToasts } from './Toast';

type SessionState = 'checking' | 'google' | 'blocked' | 'error';
type ViewState = 'loading' | 'ready' | 'empty' | 'denied' | 'error';

function MetaItem({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2" title={title}>
      <dt className="text-[10px] uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate text-xs text-slate-200">{value}</dd>
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
        <ul className="flex flex-wrap gap-1.5">
          {formatted.list.map((entry) => (
            <li
              key={entry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs leading-snug text-emerald-100"
            >
              <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
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
          <span aria-hidden>!</span>
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
  const [modulesOpen, setModulesOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
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
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
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
    setModulesOpen(false);
    document
      .getElementById(`detail-module-${key}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const backLink = (
    <Link
      href="/dashboard"
      className="btn-ghost h-11 w-11 shrink-0 px-0 sm:h-auto sm:w-auto sm:px-3"
      aria-label="Back to dashboard"
    >
      <span aria-hidden>←</span>
      <span className="hidden sm:inline">Dashboard</span>
    </Link>
  );

  /* --------------------------------------------------------------- rendering */

  if (session === 'checking' || (session === 'google' && view === 'loading')) {
    return (
      <div className="min-h-dvh">
        <TopBar storageBadge={false}>
          {backLink}
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
      <div className="min-h-dvh">
        <TopBar storageBadge={false}>{backLink}</TopBar>
        <div className="pad-safe-x mx-auto max-w-md px-4 py-12 sm:py-20">
          <div className="card-pad text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-400/15 text-amber-200">
              <Icon name="lock" className="h-6 w-6" />
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
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link href="/" className="btn-primary w-full sm:w-auto">
                Sign in with Google
              </Link>
              {directLink && (
                <a href={directLink} className="btn-ghost w-full sm:w-auto">
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
      <div className="min-h-dvh">
        <TopBar storageBadge={false}>{backLink}</TopBar>
        <div className="pad-safe-x mx-auto max-w-md px-4 py-12 sm:py-20">
          <div className="card-pad text-center">
            <h1 className="text-lg font-bold text-white">Questionnaire not found</h1>
            <p className="muted mt-2">
              No questionnaire with that reference exists in your workspace ({email || 'your account'}).
              It may have been deleted, or the link may belong to another account.
            </p>
            <Link href="/dashboard" className="btn-primary mt-5 w-full sm:w-auto">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (session === 'error' || view === 'error' || !item) {
    return (
      <div className="min-h-dvh">
        <TopBar storageBadge={false}>{backLink}</TopBar>
        <div className="pad-safe-x mx-auto max-w-md px-4 py-12 sm:py-20">
          <div className="card-pad text-center">
            <h1 className="text-lg font-bold text-white">Could not load the answers</h1>
            <p className="muted mt-2">{error?.message ?? 'Unexpected error while reading this document.'}</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                className="btn-primary w-full sm:w-auto"
                onClick={() => {
                  setError(null);
                  setView('loading');
                  setRetryKey((key) => key + 1);
                }}
              >
                Try again
              </button>
              <Link href="/dashboard" className="btn-ghost w-full sm:w-auto">
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

  const exportActions: SheetAction[] = [
    {
      id: 'txt',
      label: 'Download .txt brief',
      hint: 'Plain text, ready to paste into an AI tool',
      icon: 'download',
      onSelect: () => {
        setActionsOpen(false);
        download('txt');
      },
    },
    {
      id: 'json',
      label: 'Download .json',
      hint: 'Structured answers for your own tooling',
      icon: 'download',
      onSelect: () => {
        setActionsOpen(false);
        download('json');
      },
    },
    {
      id: 'brief',
      label: 'Copy AI-ready brief',
      icon: 'copy',
      onSelect: () => {
        setActionsOpen(false);
        void copyBrief();
      },
    },
    {
      id: 'link',
      label: 'Copy client link',
      icon: 'copy',
      onSelect: () => {
        setActionsOpen(false);
        void copyLink();
      },
    },
    {
      id: 'open',
      label: 'Open client link',
      icon: 'external',
      onSelect: () => {
        setActionsOpen(false);
        window.open(directLink || `/q/${item.token}`, '_blank', 'noopener,noreferrer');
      },
    },
  ];

  return (
    <div className="min-h-dvh">
      <TopBar storageBadge={false}>
        {backLink}
        <button
          type="button"
          className="btn-ghost btn-sm hidden px-3 sm:inline-flex"
          onClick={copyBrief}
        >
          Copy AI brief
        </button>
        <button
          type="button"
          className="btn-primary btn-sm hidden px-3 sm:inline-flex"
          onClick={() => download('txt')}
        >
          Download .txt
        </button>
        <button
          type="button"
          className="btn-icon sm:hidden"
          aria-label="Export and share this brief"
          aria-haspopup="dialog"
          onClick={() => setActionsOpen(true)}
        >
          <Icon name="list" />
        </button>
        <AccountButton
          email={email}
          onSignOut={() => {
            void fbSignOut().finally(() => {
              window.location.href = '/';
            });
          }}
        />
      </TopBar>

      {/* Sticky reading rail: jump between modules and keep the score in view. */}
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
              <span className="shrink-0">{submitted ? 'Submitted' : 'Live'}</span>
            </div>
            <div className="bar mt-1.5 h-1.5" aria-hidden>
              <div className="bar-fill" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        </div>
      </div>

      <main ref={scrollerRef} className="pad-safe-x mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6 sm:pt-6">
        <section className="card-pad">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${submitted ? 'chip-on' : 'chip-wait'}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {submitted ? 'Submitted' : 'In progress'}
            </span>
            <span className="chip" title="Answers update live while the client types">
              Live
            </span>
            <span className="chip max-w-[10rem] truncate font-mono text-[10px]" title={item.token}>
              {item.token}
            </span>
          </div>

          <h1 className="mt-2.5 text-xl font-bold leading-snug text-white sm:text-2xl">{item.title}</h1>
          <p className="muted mt-1 break-words">
            {item.clientName || 'Unnamed client'}
            {item.clientEmail ? ` · ${item.clientEmail}` : ''}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <div className="bar flex-1">
              <div className="bar-fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="shrink-0 text-sm font-bold text-white">{progress.percent}%</p>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {progress.done}/{progress.total} questions answered
          </p>
          <p className="sr-only" role="status">
            {progress.done} of {progress.total} questions answered.
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetaItem label="Created" value={relativeTime(item.createdAt)} title={absoluteTime(item.createdAt)} />
            <MetaItem
              label="Last updated"
              value={relativeTime(item.updatedAt)}
              title={absoluteTime(item.updatedAt)}
            />
            <MetaItem
              label="Submitted"
              value={item.submittedAt ? relativeTime(item.submittedAt) : 'Not yet'}
              title={item.submittedAt ? absoluteTime(item.submittedAt) : 'Not submitted yet'}
            />
            <MetaItem label="Budget" value={budget ?? NOT_ANSWERED} title={budget ?? NOT_ANSWERED} />
          </dl>

          {/* Phones: one clear primary action, the rest in the action sheet. */}
          <div className="mt-4 flex items-center gap-2 sm:hidden">
            <button type="button" className="btn-primary flex-1 px-3 text-[13px]" onClick={() => download('txt')}>
              Download .txt
            </button>
            <button type="button" className="btn-ghost flex-1 px-3 text-[13px]" onClick={() => void copyBrief()}>
              Copy brief
            </button>
            <button
              type="button"
              className="btn-icon shrink-0"
              aria-label="More export options"
              onClick={() => setActionsOpen(true)}
            >
              <Icon name="list" />
            </button>
          </div>

          <div className="mt-5 hidden flex-wrap gap-2 sm:flex">
            <button type="button" className="btn-primary btn-sm" onClick={() => download('txt')}>
              Download .txt
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={copyBrief}>
              Copy AI brief
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => download('json')}>
              Download .json
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={copyLink}>
              Copy client link
            </button>
            <a
              href={directLink || `/q/${item.token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost btn-sm"
            >
              Open client link
              <Icon name="external" className="h-3.5 w-3.5" />
            </a>
          </div>

          <p className="help mt-4">
            {submitted
              ? 'The client has submitted this brief. Answers stay editable if they reopen the link.'
              : 'The client has not submitted yet — answers below update live as they type.'}
          </p>
        </section>

        <div className="mt-4 grid gap-5 lg:grid-cols-[240px_1fr] lg:gap-6 sm:mt-6">
          {/* module rail — desktop only; phones use the sticky Modules sheet */}
          <nav
            aria-label="Question modules"
            className="hidden lg:sticky lg:top-[7.5rem] lg:block lg:self-start"
          >
            <div className="card p-3">
              <p className="px-2 pb-2 text-[11px] uppercase tracking-wider text-slate-400">
                {MODULES.length} modules
              </p>
              <div className="flex flex-col gap-1">
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
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-spark-400/70 ${
                        activeModule === module.key
                          ? 'bg-spark-500/20 text-white'
                          : 'text-slate-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-slate-500">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="flex-1">{module.title}</span>
                      <span
                        className={`flex items-center gap-1 text-[10px] ${
                          complete ? 'text-emerald-300' : 'text-slate-500'
                        }`}
                      >
                        {complete && <Icon name="check" className="h-3 w-3" strokeWidth={2.6} />}
                        {complete ? 'done' : `${moduleAnswers}/${module.questions.length}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          <div className="space-y-4 sm:space-y-6">
            {MODULES.map((module, moduleIndex) => (
              <section
                key={module.key}
                id={`detail-module-${module.key}`}
                className="card-pad scroll-mt-[8.5rem]"
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

                <div className="space-y-2.5 sm:space-y-3">
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
                        className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 sm:p-4"
                      >
                        <div className="flex items-start gap-2.5 sm:gap-3">
                          <span className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-[11px] font-bold text-slate-300">
                            {globalIndex}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold leading-snug text-slate-100">
                              {question.label}
                              {question.required && (
                                <span className="ml-1 text-rose-300" title="Required">
                                  *
                                </span>
                              )}
                            </h3>
                            <p className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                                {question.id}
                              </span>
                              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                                {question.type}
                              </span>
                            </p>
                            <div className="mt-2.5">
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
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  className="btn-primary w-full sm:w-auto"
                  onClick={() => download('txt')}
                >
                  Download .txt
                </button>
                <button type="button" className="btn-ghost w-full sm:w-auto" onClick={copyBrief}>
                  Copy AI brief
                </button>
                <Link href="/dashboard" className="btn-ghost w-full sm:w-auto">
                  Back to dashboard
                </Link>
              </div>
            </section>

            <p className="pb-4 text-center text-[11px] text-slate-500">
              RegForge · answers for {item.title} · read from your private workspace
            </p>
          </div>
        </div>
      </main>

      {/* Module jump sheet (phones + tablets). */}
      <Sheet
        open={modulesOpen}
        onClose={() => setModulesOpen(false)}
        title="Jump to a module"
        description={`${progress.done} of ${progress.total} questions answered`}
        footer={
          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() => {
              setModulesOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Back to top
          </button>
        }
      >
        <ul className="space-y-1.5">
          {MODULES.map((module, index) => {
            const moduleAnswers = module.questions.filter(
              (question) => formatAnswer(question, item.answers[question.id]).answered,
            ).length;
            const complete = moduleAnswers === module.questions.length;
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
                      {moduleAnswers}/{module.questions.length} answered
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
      </Sheet>

      <Sheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title="Export and share"
        description={item.title}
      >
        <ActionList actions={exportActions} />
      </Sheet>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
