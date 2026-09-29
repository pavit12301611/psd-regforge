'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ACCESS_PIN, OWNER_EMAIL, isCorrectPin, isOwnerEmail } from '@/lib/access';
import { firebaseConfigured, ownerSignIn, readableAuthError } from '@/lib/firebase';
import { getSession, setSession } from '@/lib/session';

type Tab = 'owner' | 'client';

export default function Gate() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('owner');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [token, setToken] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Already the owner on this browser? Skip the gate.
  useEffect(() => {
    if (getSession()?.role === 'owner') router.replace('/owner');
  }, [router]);

  const ownerEmailTyped = isOwnerEmail(email);
  const pinOk = isCorrectPin(pin);

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!email.trim()) {
      setError('Enter your email address first.');
      return;
    }
    // Owner email is hard-coded → allowed in without the PIN.
    if (!ownerEmailTyped && !pinOk) {
      setError(
        pin.trim()
          ? 'That PIN is not correct.'
          : 'The PIN is required unless you sign in with the owner email.',
      );
      return;
    }

    setBusy(true);
    try {
      // Firebase Auth runs alongside the gate. For the owner the access PIN doubles
      // as the account password, and the account is created on first login.
      if (firebaseConfigured) {
        try {
          await ownerSignIn(ownerEmailTyped ? OWNER_EMAIL : email.trim(), pinOk ? pin.trim() : ACCESS_PIN);
        } catch (err) {
          console.warn('[regforge] firebase sign-in failed:', err);
          setNotice(`${readableAuthError(err)} Continuing without Firebase sync.`);
        }
      }
      setSession(email, 'owner'); // PIN-verified → dashboard rights
      router.push('/owner');
    } finally {
      setBusy(false);
    }
  }

  function openClient(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const raw = token.trim();
    if (!raw) {
      setError('Paste the questionnaire link or token the owner sent you.');
      return;
    }
    const match = raw.match(/\/q\/([A-Za-z0-9_-]+)/);
    const t = match ? match[1] : raw.replace(/^\//, '');
    setSession(email || 'client', 'client');
    router.push(`/q/${t}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-spark-500 to-emerald-400 text-2xl font-black text-ink-900 shadow-xl shadow-spark-600/30">
          R
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">RegForge</h1>
        <p className="mt-1 text-sm text-slate-400">
          Requirement questionnaires — for me and my clients only.
        </p>
      </div>

      <div className="card-pad">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-white/[0.05] p-1">
          {(['owner', 'client'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setError('');
                setNotice('');
              }}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                tab === t ? 'bg-spark-500 text-white shadow' : 'text-slate-300 hover:text-white'
              }`}
            >
              {t === 'owner' ? 'Owner access' : 'Open a questionnaire'}
            </button>
          ))}
        </div>

        {tab === 'owner' ? (
          <form onSubmit={enter} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input mt-1.5"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="help">
                <span className="font-mono text-slate-300">{OWNER_EMAIL}</span> gets in without the
                PIN.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="pin">
                Access PIN {ownerEmailTyped && <span className="text-emerald-300">(not needed)</span>}
              </label>
              <input
                id="pin"
                className={`input mt-1.5 tracking-[0.4em] ${
                  pinOk ? 'border-emerald-400/50' : ''
                }`}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                placeholder={'•'.repeat(ACCESS_PIN.length)}
                maxLength={12}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
              <p className="help">
                {ownerEmailTyped
                  ? 'Owner email detected — the PIN is optional.'
                  : pinOk
                    ? 'PIN accepted.'
                    : 'Required unless you sign in with the owner email.'}
              </p>
            </div>

            {error && (
              <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                {notice}
              </p>
            )}

            <button className="btn-primary w-full" disabled={busy} type="submit">
              {busy ? 'Checking…' : 'Enter dashboard'}
            </button>

            <p className="text-center text-[11px] text-slate-500">
              {firebaseConfigured
                ? 'Backed by Firebase Authentication + Firestore.'
                : 'Firebase keys not set yet — running in local mode. See README.'}
            </p>
          </form>
        ) : (
          <form onSubmit={openClient} className="space-y-4">
            <div>
              <label className="label" htmlFor="token">
                Questionnaire link or token
              </label>
              <input
                id="token"
                className="input mt-1.5 font-mono text-xs"
                placeholder="/q/ab12cd34ef56"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <p className="help">
                Paste the link the owner sent you. No account needed — your answers save straight to
                your own questionnaire.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="client-email">
                Your email <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="client-email"
                className="input mt-1.5"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && (
              <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}

            <button className="btn-primary w-full" type="submit">
              Open questionnaire
            </button>
          </form>
        )}
      </div>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-500">
        Access PIN lives in <span className="font-mono">lib/access.ts</span> — hard-coded, never stored
        in a database.
      </p>
    </main>
  );
}
