'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createQuestionnaire, storageMode, type Questionnaire } from '@/lib/store';
import { currentAdminUser } from '@/lib/firebase';
import { clearSession, isOwnerSession } from '@/lib/session';
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
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    let active = true;
    if (!isOwnerSession()) {
      router.replace('/');
      return () => { active = false; };
    }
    (async () => {
      try {
        const admin = await currentAdminUser();
        if (!active) return;
        if (!admin) {
          clearSession();
          router.replace('/');
          return;
        }
        setReady(true);
        // Capture origin for direct shareable link (Vercel URL included)
        if (typeof window !== 'undefined') setOrigin(window.location.origin);
      } catch {
        if (!active) return;
        clearSession();
        router.replace('/');
      }
    })();
    return () => { active = false; };
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
    const url = `${origin || (typeof window !== 'undefined' ? window.location.origin : '')}/q/${created.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  const fullLink = created ? `${origin || ''}/q/${created.token}` : '';

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
              <label className="label">Direct client link — opens without login</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input
                  className="input flex-1 font-mono text-xs"
                  readOnly
                  value={fullLink || `/q/${created.token}`}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button className="btn-ghost" type="button" onClick={copyLink}>
                  {copied ? 'Copied ✓' : 'Copy full link'}
                </button>
              </div>
              <p className="help">
                ✅ This link opens directly — no ID, no PIN needed. Just send it to your client.
                Anyone with the link can answer this one questionnaire — no account needed.
              </p>
              {origin && (
                <p className="mt-2 text-[11px] text-emerald-300">
                  Direct URL: {fullLink} — client clicks and starts answering instantly.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <a href={fullLink || `/q/${created.token}`} target="_blank" rel="noopener noreferrer" className="btn-primary">
                Open direct link ↗
              </a>
              <Link href={`/q/${created.token}`} className="btn-ghost">
                Preview here
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
