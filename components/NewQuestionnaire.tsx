'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createQuestionnaire, storageMode, type Questionnaire } from '@/lib/store';
import { isOwnerSession } from '@/lib/session';
import { MODULE_COUNT, QUESTION_COUNT } from '@/lib/library';
import { TopBar } from './Shell';

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

  useEffect(() => {
    if (!isOwnerSession()) {
      router.replace('/');
      return;
    }
    setReady(true);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the questionnaire.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    const url = `${window.location.origin}/q/${created.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen">
      <TopBar>
        <Link href="/owner" className="btn-ghost btn-sm">
          ← Dashboard
        </Link>
      </TopBar>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        {!created ? (
          <form onSubmit={create} className="card-pad space-y-4">
            <div>
              <h1 className="text-xl font-bold text-white">New questionnaire</h1>
              <p className="muted mt-1">
                {MODULE_COUNT} modules, {QUESTION_COUNT} questions. The client opens the link, answers at
                their own pace — every keystroke autosaves to {storageMode() === 'firebase' ? 'Firestore' : 'this browser'}.
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
                  placeholder="client@example.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn-primary" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create questionnaire'}
              </button>
              <Link href="/owner" className="btn-ghost">
                Cancel
              </Link>
            </div>
          </form>
        ) : (
          <div className="card-pad space-y-4">
            <div>
              <span className="chip chip-on">Created</span>
              <h1 className="mt-3 text-xl font-bold text-white">{created.title}</h1>
              <p className="muted mt-1">
                {created.clientName || 'Client'}
                {created.clientEmail ? ` · ${created.clientEmail}` : ''}
              </p>
            </div>

            <div>
              <label className="label">Client link</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input
                  className="input flex-1 font-mono text-xs"
                  readOnly
                  value={`/q/${created.token}`}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button className="btn-ghost" type="button" onClick={copyLink}>
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
              <p className="help">
                Send this to your client. Anyone with the link answers this one questionnaire — no
                account needed.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Link href={`/q/${created.token}`} className="btn-primary">
                Open questionnaire
              </Link>
              <Link href="/owner" className="btn-ghost">
                Back to dashboard
              </Link>
              <button
                className="btn-ghost"
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
    </div>
  );
}
