'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MODULE_COUNT, QUESTION_COUNT, overallProgress } from '@/lib/library';
import { formatBudgetValue } from '@/lib/answers';
import { briefFilename, buildTxtBrief, copyToClipboard, downloadTextFile } from '@/lib/export';
import {
  deleteQuestionnaire,
  watchQuestionnaires,
  type Questionnaire,
} from '@/lib/store';
import { currentGoogleUser, fbSignOut } from '@/lib/firebase';
import { TopBar } from './Shell';
import { ToastStack, useToasts } from './Toast';

type StatusFilter = 'all' | 'progress' | 'submitted';

function when(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'progress', label: 'In progress' },
  { id: 'submitted', label: 'Submitted' },
];

export default function WorkspaceDashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [items, setItems] = useState<Questionnaire[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [syncError, setSyncError] = useState('');
  const [origin, setOrigin] = useState('');
  const [busyToken, setBusyToken] = useState('');
  const { toasts, push, dismiss } = useToasts();

  useEffect(() => {
    let active = true;
    currentGoogleUser()
      .then((user) => {
        if (!active) return;
        if (!user) {
          router.replace('/');
          return;
        }
        setUserEmail(user.email ?? '');
        setOrigin(window.location.origin);
        setReady(true);
      })
      .catch(() => {
        if (active) router.replace('/');
      });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!ready) return undefined;
    return watchQuestionnaires(setItems, setSyncError);
  }, [ready]);

  const stats = useMemo(() => {
    const submitted = items.filter((item) => item.submittedAt).length;
    const avg = items.length
      ? Math.round(
          items.reduce((total, item) => total + overallProgress(item.answers).percent, 0) / items.length,
        )
      : 0;
    return { total: items.length, submitted, pending: items.length - submitted, avg };
  }, [items]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === 'submitted' && !item.submittedAt) return false;
      if (statusFilter === 'progress' && item.submittedAt) return false;
      if (!needle) return true;
      return [item.title, item.clientName, item.clientEmail, item.token]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [items, search, statusFilter]);

  function fullUrl(token: string) {
    return `${origin || (typeof window === 'undefined' ? '' : window.location.origin)}/q/${token}`;
  }

  async function copyLink(item: Questionnaire) {
    const ok = await copyToClipboard(fullUrl(item.token));
    push(
      ok ? 'Direct client link copied to clipboard.' : 'Clipboard access failed — select the link manually.',
      ok ? 'success' : 'error',
    );
  }

  async function copyBrief(item: Questionnaire) {
    const ok = await copyToClipboard(buildTxtBrief(item));
    push(
      ok
        ? `AI-ready brief for “${item.title}” copied.`
        : 'Clipboard access failed — try “Download .txt” instead.',
      ok ? 'success' : 'error',
    );
  }

  function downloadBrief(item: Questionnaire) {
    const filename = briefFilename(item, 'txt');
    const ok = downloadTextFile(filename, buildTxtBrief(item));
    push(
      ok ? `Downloaded ${filename}` : 'The browser blocked the download. Try again from the answers page.',
      ok ? 'success' : 'error',
    );
  }

  async function remove(item: Questionnaire) {
    if (
      !window.confirm(
        `Delete “${item.title}” and all ${overallProgress(item.answers).done} saved answers? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyToken(item.token);
    try {
      await deleteQuestionnaire(item.token);
      push(`Deleted “${item.title}”.`, 'info');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Delete failed.', 'error');
    } finally {
      setBusyToken('');
    }
  }

  async function signOut() {
    await fbSignOut();
    router.replace('/');
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-spark-400" />
        <p className="muted mt-4">Opening your workspace…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar>
        <span className="hidden max-w-[15rem] truncate text-xs text-slate-400 sm:inline" title={userEmail}>
          {userEmail}
        </span>
        <Link href="/new" className="btn-primary btn-sm">
          + New questionnaire
        </Link>
        <button className="btn-ghost btn-sm" onClick={signOut} type="button">
          Sign out
        </button>
      </TopBar>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <section className="grid gap-3 sm:grid-cols-4">
          {[
            { label: 'Questionnaires', value: stats.total },
            { label: 'Awaiting client', value: stats.pending },
            { label: 'Submitted', value: stats.submitted },
            { label: 'Avg. completion', value: `${stats.avg}%` },
          ].map((stat) => (
            <div key={stat.label} className="card p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </section>

        <section className="card-pad">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="section-title">Your questionnaires</h1>
              <p className="muted">
                {MODULE_COUNT} modules · {QUESTION_COUNT} questions · answers autosave as the client types.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <label className="sr-only" htmlFor="questionnaire-search">
                Search questionnaires
              </label>
              <input
                id="questionnaire-search"
                className="input sm:max-w-xs"
                placeholder="Search client, project or token…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="search"
              />
              <div
                className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
                role="group"
                aria-label="Filter by status"
              >
                {FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setStatusFilter(filter.id)}
                    aria-pressed={statusFilter === filter.id}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-spark-400/70 ${
                      statusFilter === filter.id
                        ? 'bg-spark-500/25 text-white'
                        : 'text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {syncError && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              <span>{syncError}</span>
              <button
                type="button"
                className="rounded underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70"
                onClick={() => {
                  setSyncError('');
                  setItems([]);
                  setReady(false);
                  window.setTimeout(() => setReady(true), 0);
                }}
              >
                Retry sync
              </button>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {visible.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/[0.12] p-8 text-center">
                <p className="text-sm text-slate-300">
                  {items.length === 0
                    ? 'No questionnaires yet — create the first one and send your client a direct link.'
                    : 'No questionnaires match this search or filter.'}
                </p>
                {items.length === 0 ? (
                  <Link href="/new" className="btn-primary mt-4 w-full sm:w-auto">
                    + New questionnaire
                  </Link>
                ) : (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setSearch('');
                        setStatusFilter('all');
                      }}
                    >
                      Clear search and filters
                    </button>
                    <Link href="/new" className="btn-ghost">
                      + New questionnaire
                    </Link>
                  </div>
                )}
              </div>
            )}

            {visible.map((item) => {
              const progress = overallProgress(item.answers);
              const direct = fullUrl(item.token);
              const budget = formatBudgetValue(item.answers['budget.budget']);
              return (
                <article key={item.token} className="card-pad">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-white">{item.title}</h2>
                        <span className={`chip ${item.submittedAt ? 'chip-on' : 'chip-wait'}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {item.submittedAt ? 'Submitted' : 'In progress'}
                        </span>
                        {budget && (
                          <span className="chip" title="Client’s budget answer (INR)">
                            Budget · {budget}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {item.clientName || 'Unnamed client'}
                        {item.clientEmail ? ` · ${item.clientEmail}` : ''} · share token{' '}
                        <span className="font-mono text-slate-300">{item.token}</span>
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Created {when(item.createdAt)} · Last updated {when(item.updatedAt)}
                        {item.submittedAt ? ` · Submitted ${when(item.submittedAt)}` : ''}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-black text-white">{progress.percent}%</p>
                      <p className="text-[11px] text-slate-400">
                        {progress.done}/{progress.total} answered
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="bar" aria-hidden>
                      <div className="bar-fill" style={{ width: `${progress.percent}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/questionnaires/${item.token}`}
                      className="btn-primary btn-sm w-full sm:w-auto"
                    >
                      View answers
                    </Link>
                    <button
                      type="button"
                      className="btn-ghost btn-sm w-full sm:w-auto"
                      onClick={() => copyLink(item)}
                    >
                      Copy direct link
                    </button>
                    <a
                      href={direct}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost btn-sm w-full sm:w-auto"
                    >
                      Open client link ↗
                    </a>
                    <button
                      type="button"
                      className="btn-ghost btn-sm w-full sm:w-auto"
                      onClick={() => copyBrief(item)}
                    >
                      Copy AI brief
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm w-full sm:w-auto"
                      onClick={() => downloadBrief(item)}
                    >
                      Download .txt
                    </button>
                    <button
                      type="button"
                      className="btn-danger btn-sm w-full sm:w-auto"
                      onClick={() => remove(item)}
                      disabled={busyToken === item.token}
                    >
                      {busyToken === item.token ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>

                  <details className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                    <summary className="cursor-pointer text-xs text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-spark-400/70">
                      Shareable link for this client
                    </summary>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <label className="sr-only" htmlFor={`link-${item.token}`}>
                        Direct link for {item.title}
                      </label>
                      <input
                        id={`link-${item.token}`}
                        className="input h-9 flex-1 font-mono text-[11px]"
                        readOnly
                        value={direct}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => copyLink(item)}
                      >
                        Copy
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-emerald-300/80">
                      Clients can read and update this one questionnaire only.
                    </p>
                  </details>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
