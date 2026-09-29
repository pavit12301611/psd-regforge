'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createQuestionnaire, type Questionnaire } from '@/lib/store';
import { currentGoogleUser } from '@/lib/firebase';
import { MODULE_COUNT, QUESTION_COUNT } from '@/lib/library';
import { ToastStack, useToasts } from './Toast';
import { TopBar } from './Shell';
import Icon from './Icon';

export default function NewQuestionnaire() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Questionnaire | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');
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
        setReady(true);
        setOrigin(window.location.origin);
      })
      .catch(() => {
        if (active) router.replace('/');
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim() && !clientName.trim()) {
      setError('Give the project a name (or at least a client name).');
      return;
    }
    setBusy(true);
    try {
      const item = await createQuestionnaire({ title, clientName, clientEmail });
      setCreated(item);
      push('Questionnaire created — send the link to your client.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create the questionnaire.';
      setError(message);
      push(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function linkFor(item: Questionnaire) {
    return `${origin || window.location.origin}/q/${item.token}`;
  }

  async function copyLink() {
    if (!created) return;
    const url = linkFor(created);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      push('Direct client link copied.', 'success');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  async function shareLink() {
    if (!created) return;
    const url = linkFor(created);
    const share = (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share;
    if (typeof share === 'function') {
      try {
        await share.call(navigator, { title: created.title, url });
        return;
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
      }
    }
    await copyLink();
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-spark-400" />
        <p className="muted mt-4">Opening your workspace…</p>
      </div>
    );
  }

  const fullLink = created ? linkFor(created) : '';

  return (
    <div className="min-h-dvh">
      <TopBar storageBadge={false}>
        <Link href="/dashboard" className="btn-ghost btn-sm px-3">
          <Icon name="chevron-right" className="h-4 w-4 rotate-180" /> Dashboard
        </Link>
      </TopBar>

      <main className="pad-safe-x mx-auto max-w-2xl px-4 pb-10 pt-4 sm:px-6 sm:pt-8">
        {!created ? (
          <form onSubmit={create} className="card-pad space-y-4">
            <div>
              <h1 className="text-xl font-bold text-white">New questionnaire</h1>
              <p className="muted mt-1">
                {MODULE_COUNT} modules, {QUESTION_COUNT} questions. Your client can answer at their own
                pace; every change autosaves to your private Firebase workspace.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="title">
                Project / business name
              </label>
              <input
                id="title"
                className="input mt-1.5"
                placeholder="e.g. The Daily Bloom — website"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoComplete="organization"
                enterKeyHint="next"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="clientName">
                  Client name
                </label>
                <input
                  id="clientName"
                  className="input mt-1.5"
                  placeholder="e.g. Amara Okafor"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  autoComplete="name"
                  enterKeyHint="next"
                />
              </div>
              <div>
                <label className="label" htmlFor="clientEmail">
                  Client email
                </label>
                <input
                  id="clientEmail"
                  className="input mt-1.5"
                  type="email"
                  inputMode="email"
                  placeholder="client@example.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="done"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-200">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
              <button className="btn-primary w-full sm:w-auto" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create questionnaire'}
              </button>
              <Link href="/dashboard" className="btn-ghost w-full sm:w-auto">
                Cancel
              </Link>
            </div>
          </form>
        ) : (
          <div className="card-pad space-y-5">
            <div>
              <span className="chip chip-on">Created in your workspace</span>
              <h1 className="mt-2.5 text-xl font-bold leading-snug text-white">{created.title}</h1>
              <p className="muted mt-1 break-words">
                {created.clientName || 'Client'}
                {created.clientEmail ? ` · ${created.clientEmail}` : ''}
              </p>
            </div>

            <div>
              <label className="label" htmlFor="direct-link">
                Direct client link
              </label>
              <input
                id="direct-link"
                className="input mt-1.5 font-mono text-base sm:text-xs"
                readOnly
                value={fullLink || `/q/${created.token}`}
                onFocus={(e) => e.currentTarget.select()}
              />
              <p className="help">
                Send this link to your client. It opens only this questionnaire and does not expose your
                workspace or other questionnaires.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button className="btn-primary w-full" type="button" onClick={shareLink}>
                <Icon name="share" className="h-4 w-4" />
                Share link
              </button>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" type="button" onClick={copyLink}>
                  <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" />
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <a
                  href={fullLink || `/q/${created.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost flex-1"
                >
                  Open
                  <Icon name="external" className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
              <Link href="/dashboard" className="btn-ghost w-full sm:w-auto">
                Back to dashboard
              </Link>
              <button
                className="btn-ghost w-full sm:w-auto"
                type="button"
                onClick={() => {
                  setCreated(null);
                  setTitle('');
                  setClientName('');
                  setClientEmail('');
                }}
              >
                Create another
              </button>
            </div>
          </div>
        )}
      </main>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
