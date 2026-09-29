'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MODULE_COUNT, QUESTION_COUNT, overallProgress } from '@/lib/library';
import { formatBudgetValue } from '@/lib/answers';
import { briefFilename, buildTxtBrief, copyToClipboard, downloadTextFile } from '@/lib/export';
import { absoluteTime, relativeTime } from '@/lib/time';
import {
  deleteQuestionnaire,
  watchQuestionnaires,
  type Questionnaire,
} from '@/lib/store';
import { currentGoogleUser, fbSignOut } from '@/lib/firebase';
import { AccountButton, TopBar } from './Shell';
import Sheet, { ActionList, useConfirm } from './Sheet';
import Icon from './Icon';
import { ToastStack, useToasts } from './Toast';

type StatusFilter = 'all' | 'progress' | 'submitted';

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
  const [shareItem, setShareItem] = useState<Questionnaire | null>(null);
  const [actionsItem, setActionsItem] = useState<Questionnaire | null>(null);
  const { toasts, push, dismiss } = useToasts();
  const { confirm, element: confirmElement } = useConfirm();

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

  /** Native share sheet on phones, copy to clipboard everywhere else. */
  async function shareLink(item: Questionnaire) {
    const url = fullUrl(item.token);
    const share = (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share;
    if (typeof share === 'function') {
      try {
        await share.call(navigator, {
          title: item.title,
          text: `${item.clientName || 'Your'} requirements questionnaire — ${item.title}`,
          url,
        });
        return;
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
      }
    }
    await copyLink(item);
  }

  async function remove(item: Questionnaire) {
    const ok = await confirm({
      title: `Delete “${item.title}”?`,
      body: `All ${overallProgress(item.answers).done} saved answers and the share link stop working. This cannot be undone.`,
      confirmLabel: 'Delete questionnaire',
      tone: 'danger',
    });
    if (!ok) return;
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

  function resetSync() {
    setSyncError('');
    setItems([]);
    setReady(false);
    window.setTimeout(() => setReady(true), 0);
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
    <div className="min-h-dvh">
      <TopBar>
        <Link href="/new" className="btn-primary btn-sm px-3" aria-label="New questionnaire">
          <Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />
          <span>New</span>
        </Link>
        <AccountButton email={userEmail} onSignOut={signOut} />
      </TopBar>

      <main className="pad-safe-x mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {/* Stats: two tidy rows of tiles on a phone, one row on wider screens. */}
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3" aria-label="Workspace totals">
          {[
            { label: 'Questionnaires', short: 'Projects', value: stats.total },
            { label: 'Awaiting client', short: 'Awaiting', value: stats.pending },
            { label: 'Submitted', short: 'Submitted', value: stats.submitted },
            { label: 'Avg. completion', short: 'Avg. done', value: `${stats.avg}%` },
          ].map((stat) => (
            <div key={stat.label} className="card px-3 py-2.5 sm:p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 sm:hidden">{stat.short}</p>
              <p className="hidden text-[11px] uppercase tracking-wider text-slate-400 sm:block">
                {stat.label}
              </p>
              <p className="mt-0.5 text-xl font-bold text-white sm:mt-1 sm:text-2xl">{stat.value}</p>
            </div>
          ))}
        </section>

        {/* Search + filters stay reachable while scrolling a long phone list. */}
        <div
          className="sticky z-30 mt-3 rounded-2xl border border-white/10 bg-ink-900/95 px-3 py-2.5 shadow-lg shadow-black/30 backdrop-blur [top:calc(var(--topbar-h)-0.75rem)] sm:static sm:mt-4 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none"
        >
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <Icon name="search" className="h-4 w-4" />
              </span>
              <label className="sr-only" htmlFor="questionnaire-search">
                Search questionnaires
              </label>
              <input
                id="questionnaire-search"
                className="input pl-8 sm:max-w-xs"
                placeholder="Search client, project or token…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="search"
                enterKeyHint="search"
                autoComplete="off"
              />
            </div>
            <div
              className="hidden shrink-0 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 sm:flex"
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

          {/* Phone equivalent of the segmented control: a swipeable chip rail. */}
          <div
            className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-0.5 sm:hidden"
            role="group"
            aria-label="Filter by status"
          >
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                aria-pressed={statusFilter === filter.id}
                className={`chip min-w-[2.75rem] shrink-0 justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-spark-400/70 ${
                  statusFilter === filter.id ? 'border-spark-400/60 bg-spark-500/25 text-white' : ''
                }`}
                style={{ minHeight: '2.625rem' }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <section className="mt-4 sm:card-pad sm:mt-4">
          <div className="mb-3 hidden sm:block">
            <h1 className="section-title">Your questionnaires</h1>
            <p className="muted">
              {MODULE_COUNT} modules · {QUESTION_COUNT} questions · answers autosave as the client types.
            </p>
          </div>
          <h1 className="sr-only">Your questionnaires</h1>

          {syncError && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              <span className="min-w-0 flex-1">{syncError}</span>
              <button
                type="button"
                className="rounded underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70"
                onClick={resetSync}
              >
                Retry sync
              </button>
            </div>
          )}

          <div className="space-y-3">
            {visible.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/[0.12] p-6 text-center sm:p-8">
                <p className="text-sm leading-relaxed text-slate-300">
                  {items.length === 0
                    ? 'No questionnaires yet — create the first one and send your client a direct link.'
                    : 'No questionnaires match this search or filter.'}
                </p>
                {items.length === 0 ? (
                  <Link href="/new" className="btn-primary mt-4 w-full sm:w-auto">
                    + New questionnaire
                  </Link>
                ) : (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      className="btn-ghost w-full sm:w-auto"
                      onClick={() => {
                        setSearch('');
                        setStatusFilter('all');
                      }}
                    >
                      Clear search and filters
                    </button>
                    <Link href="/new" className="btn-ghost w-full sm:w-auto">
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-white sm:truncate sm:text-base">
                        {item.title}
                      </h2>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {item.clientName || 'Unnamed client'}
                        {item.clientEmail ? ` · ${item.clientEmail}` : ''}
                      </p>
                    </div>
                    <span className={`chip shrink-0 ${item.submittedAt ? 'chip-on' : 'chip-wait'}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {item.submittedAt ? 'Submitted' : 'In progress'}
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <div className="flex items-baseline justify-between gap-2 text-[11px] text-slate-400">
                      <span>
                        {progress.done}/{progress.total} answered
                        {budget ? ` · Budget ${budget}` : ''}
                      </span>
                      <span className="font-semibold text-white">{progress.percent}%</span>
                    </div>
                    <div className="bar mt-1.5" aria-hidden>
                      <div className="bar-fill" style={{ width: `${progress.percent}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Updated {relativeTime(item.updatedAt)}
                      {item.submittedAt ? ` · Submitted ${relativeTime(item.submittedAt)}` : ''} ·{' '}
                      <span className="font-mono">…{item.token.slice(-8)}</span>
                    </p>
                  </div>

                  {/* Phone: three thumb-sized controls, everything else in the sheet. */}
                  <div className="mt-3 flex items-center gap-2 sm:hidden">
                    <Link
                      href={`/dashboard/questionnaires/${item.token}`}
                      className="btn-primary flex-1 px-3 text-[13px]"
                    >
                      View answers
                    </Link>
                    <button
                      type="button"
                      className="btn-ghost px-3 text-[13px]"
                      onClick={() => setShareItem(item)}
                    >
                      <Icon name="share" className="h-4 w-4" />
                      Share
                    </button>
                    <button
                      type="button"
                      className="btn-icon shrink-0"
                      aria-label={`More actions for ${item.title}`}
                      onClick={() => setActionsItem(item)}
                    >
                      <Icon name="list" />
                    </button>
                  </div>

                  {/* Wider screens keep the full action row. */}
                  <div className="mt-4 hidden flex-wrap gap-2 sm:flex">
                    <Link href={`/dashboard/questionnaires/${item.token}`} className="btn-primary btn-sm">
                      View answers
                    </Link>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => copyLink(item)}>
                      Copy direct link
                    </button>
                    <a
                      href={direct}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost btn-sm"
                    >
                      Open client link
                      <Icon name="external" className="h-3.5 w-3.5" />
                    </a>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => copyBrief(item)}>
                      Copy AI brief
                    </button>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => downloadBrief(item)}>
                      Download .txt
                    </button>
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      onClick={() => remove(item)}
                      disabled={busyToken === item.token}
                    >
                      {busyToken === item.token ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      {/* Share sheet — the phone path to "send this to my client". */}
      <Sheet
        open={Boolean(shareItem)}
        onClose={() => setShareItem(null)}
        title="Share this questionnaire"
        description={shareItem ? `${shareItem.title} — one link, one client.` : undefined}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              onClick={() => shareItem && shareLink(shareItem)}
            >
              Share link
            </button>
            <button
              type="button"
              className="btn-ghost w-full sm:w-auto"
              onClick={() => shareItem && copyLink(shareItem)}
            >
              Copy link
            </button>
          </div>
        }
      >
        {shareItem && (
          <div className="space-y-3">
            <div>
              <label className="sr-only" htmlFor="share-url">
                Direct client link
              </label>
              <input
                id="share-url"
                className="input font-mono text-base sm:text-xs"
                readOnly
                value={fullUrl(shareItem.token)}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
            <ActionList
              actions={[
                {
                  id: 'open',
                  label: 'Open client link',
                  hint: 'See exactly what your client sees',
                  icon: 'external',
                  onSelect: () => {
                    window.open(fullUrl(shareItem.token), '_blank', 'noopener,noreferrer');
                  },
                },
                {
                  id: 'answers',
                  label: 'View submitted answers',
                  icon: 'eye',
                  onSelect: () => {
                    const token = shareItem.token;
                    setShareItem(null);
                    router.push(`/dashboard/questionnaires/${token}`);
                  },
                },
              ]}
            />
            <p className="help">
              Clients can read and update this one questionnaire only. The link never exposes your
              workspace or other briefs.
            </p>
          </div>
        )}
      </Sheet>

      {/* Overflow sheet for the remaining per-questionnaire actions. */}
      <Sheet
        open={Boolean(actionsItem)}
        onClose={() => setActionsItem(null)}
        title={actionsItem ? actionsItem.title : 'Actions'}
        description={actionsItem ? absoluteTime(actionsItem.updatedAt) + ' · last updated' : undefined}
      >
        {actionsItem && (
          <ActionList
            actions={[
              {
                id: 'copy-link',
                label: 'Copy direct link',
                icon: 'copy',
                onSelect: () => {
                  const item = actionsItem;
                  setActionsItem(null);
                  void copyLink(item);
                },
              },
              {
                id: 'brief',
                label: 'Copy AI-ready brief',
                hint: 'Plain text, ready to paste into an AI tool',
                icon: 'copy',
                onSelect: () => {
                  const item = actionsItem;
                  setActionsItem(null);
                  void copyBrief(item);
                },
              },
              {
                id: 'txt',
                label: 'Download .txt brief',
                icon: 'download',
                onSelect: () => {
                  const item = actionsItem;
                  setActionsItem(null);
                  downloadBrief(item);
                },
              },
              {
                id: 'delete',
                label: busyToken === actionsItem.token ? 'Deleting…' : 'Delete questionnaire',
                hint: 'Removes the answers and disables the link',
                icon: 'trash',
                tone: 'danger',
                onSelect: () => {
                  const item = actionsItem;
                  setActionsItem(null);
                  void remove(item);
                },
              },
            ]}
          />
        )}
      </Sheet>

      {confirmElement}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
