'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  currentGoogleUser,
  fbSignOut,
  firebaseConfigured,
  googleSignIn,
  readableAuthError,
} from '@/lib/firebase';
import { StorageBadge } from './Shell';

function tokenFromInput(raw: string): string {
  const value = raw.trim();
  const match = value.match(/\/q\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  return value.replace(/^\/+/, '').replace(/^q\//, '').split(/[?#]/, 1)[0];
}

export default function Gate() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    // Keep direct links convenient when a client receives ?token=… or ?link=…
    // instead of the canonical /q/{token} URL.
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('token') || params.get('q') || params.get('id') || params.get('link') || '';
    const directToken = tokenFromInput(raw);
    if (directToken) {
      router.replace(`/q/${directToken}`);
      return () => {
        active = false;
      };
    }

    currentGoogleUser()
      .then((user) => {
        if (!active) return;
        if (user) {
          setEmail(user.email ?? '');
          router.replace('/dashboard');
        } else {
          setChecking(false);
        }
      })
      .catch((err) => {
        if (!active) return;
        setChecking(false);
        setError(readableAuthError(err));
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function signIn() {
    setError('');
    if (!firebaseConfigured) {
      setError('Firebase is not configured yet. Add the Firebase web app settings before signing in.');
      return;
    }

    setBusy(true);
    try {
      const user = await googleSignIn();
      setEmail(user.email ?? '');
      router.push('/dashboard');
    } catch (err) {
      console.warn('[regforge] Google sign-in failed:', err);
      setError(readableAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fbSignOut();
    setEmail('');
    setError('');
  }

  function openShared(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const directToken = tokenFromInput(token);
    if (!directToken) {
      setError('Paste the direct questionnaire link or its share token.');
      return;
    }
    router.push(`/q/${directToken}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-spark-500 to-emerald-400 text-2xl font-black text-ink-900 shadow-xl shadow-spark-600/30">
          R
        </div>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">RegForge</h1>
          <StorageBadge />
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Private requirement workspaces for independent teams and their clients.
        </p>
      </div>

      <div className="card-pad space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Your workspace</h2>
          <p className="muted mt-1">
            Sign in with Google to create and manage your own private questionnaires. Every workspace is
            isolated by Firebase Authentication UID.
          </p>
        </div>

        {firebaseConfigured ? (
          <button className="btn-primary w-full" type="button" onClick={signIn} disabled={checking || busy}>
            <span className="grid h-5 w-5 place-items-center rounded bg-white text-xs font-bold text-slate-700">G</span>
            {busy ? 'Opening Google sign-in…' : checking ? 'Checking session…' : 'Continue with Google'}
          </button>
        ) : (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-sm text-amber-100">
            Add the Firebase web-app configuration to enable Google sign-in. See the setup guide in the
            repository README.
          </div>
        )}

        {email && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
            <span>Signed in as {email}</span>
            <button type="button" className="underline hover:no-underline" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        )}

        <div className="border-t border-white/10 pt-5">
          <h2 className="text-sm font-semibold text-white">Opening a shared questionnaire?</h2>
          <p className="help">
            Direct links open without a workspace sign-in. The link grants access to that one questionnaire
            only; it cannot list or open other workspaces.
          </p>
          <form onSubmit={openShared} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="input font-mono text-xs"
              placeholder="https://your-site.com/q/share-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              aria-label="Questionnaire link or share token"
            />
            <button className="btn-ghost shrink-0" type="submit">
              Open link
            </button>
          </form>
        </div>
      </div>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-500">
        Google Authentication protects workspaces. Shared questionnaire links are scoped to one random
        token, and Firestore rules enforce both boundaries.
      </p>
    </main>
  );
}
