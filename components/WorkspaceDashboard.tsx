'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MODULE_COUNT, QUESTION_COUNT, overallProgress } from '@/lib/library';
import {
  deleteQuestionnaire,
  watchQuestionnaires,
  type Questionnaire,
} from '@/lib/store';
import { currentGoogleUser, fbSignOut } from '@/lib/firebase';
import { TopBar } from './Shell';

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

export default function WorkspaceDashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [items, setItems] = useState<Questionnaire[]>([]);
  const [filter, setFilter] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [flash, setFlash] = useState('');
  const [syncError, setSyncError] = useState('');
  const [origin, setOrigin] = useState('');

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
      ? Math.round(items.reduce((total, item) => total + overallProgress(item.answers).percent, 0) / items.length)
      : 0;
    return { total: items.length, submitted, pending: items.length - submitted, avg };
  }, [items]);

  const visible = useMemo(() => {
    const search = filter.trim().toLowerCase();
    if (!search) return items;
    return items.filter((item) =>
      [item.title, item.clientName, item.clientEmail, item.token].join(' ').toLowerCase().includes(search),
    );
  }, [items, filter]);

  function fullUrl(token: string) {
    return `${origin || window.location.origin}/q/${token}`;
  }

  async function copyLink(token: string) {
    const url = fullUrl(token);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this direct link:', url);
    }
    setCopied(token);
    window.setTimeout(() => setCopied(null), 1800);
  }

  async function remove(item: Questionnaire) {
    if (!window.confirm(`Delete "${item.title}" and all its answers? This cannot be undone.`)) return;
    try {
      await deleteQuestionnaire(item.token);
      setFlash(`Deleted ${item.title}.`);
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'Delete failed.');
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="section-title">Your questionnaires</h1>
              <p className="muted">
                {MODULE_COUNT} modules · {QUESTION_COUNT} questions · answers autosave as the client types.
              </p>
            </div>
            <input
              className="input max-w-xs"
              placeholder="Search client, project or token…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Search questionnaires"
            />
          </div>

          {flash && (
            <p className="mt-4 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
              {flash}
            </p>
          )}

          {syncError && (
            <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {syncError}
            </p>
          )}

          <div className="mt-5 space-y-3">
            {visible.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/[0.12] p-8 text-center">
                <p className="text-sm text-slate-300">
                  {items.length === 0
                    ? 'No questionnaires yet — create the first one for your client.'
                    : 'No matches for that search.'}
                </p>
                {items.length === 0 && (
                  <Link href="/new" className="btn-primary mt-4">
                    + New questionnaire
                  </Link>
                )}
              </div>
            )}

            {visible.map((item) => {
              const progress = overallProgress(item.answers);
              const direct = fullUrl(item.token);
              return (
                <article key={item.token} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-semibold text-white">{item.title}</h2>
                        <span className={`chip ${item.submittedAt ? 'chip-on' : 'chip-wait'}`}>
                          {item.submittedAt ? 'Submitted' : 'In progress'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {item.clientName || 'Unnamed client'}
                        {item.clientEmail ? ` · ${item.clientEmail}` : ''} · share token{' '}
                        <span className="font-mono text-slate-300">{item.token}</span>
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Created {when(item.createdAt)} · Updated {when(item.updatedAt)}
                        {item.submittedAt ? ` · Submitted ${when(item.submittedAt)}` : ''}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          className="input h-8 flex-1 font-mono text-[11px]"
                          readOnly
                          value={direct}
                          onFocus={(e) => e.currentTarget.select()}
                          aria-label={`Direct link for ${item.title}`}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-emerald-300/80">
                        Direct link — clients can edit this questionnaire only.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button className="btn-ghost btn-sm" onClick={() => copyLink(item.token)} type="button">
                        {copied === item.token ? 'Link copied ✓' : 'Copy direct link'}
                      </button>
                      <a href={direct} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                        Open direct ↗
                      </a>
                      <Link href={`/q/${item.token}`} className="btn-ghost btn-sm">
                        Preview
                      </Link>
                      <button className="btn-danger btn-sm" onClick={() => remove(item)} type="button">
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="bar">
                      <div className="bar-fill" style={{ width: `${progress.percent}%` }} />
                    </div>
                    <span className="w-28 shrink-0 text-right text-xs text-slate-400">
                      {progress.done}/{progress.total} answered
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
