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
import { MODULE_COUNT, QUESTION_COUNT } from '@/lib/library';
import { StorageBadge } from './Shell';
import Icon, { type IconName } from './Icon';

function tokenFromInput(raw: string): string {
  const value = raw.trim();
  const match = value.match(/\/q\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  return value.replace(/^\/+/, '').replace(/^q\//, '').split(/[?#]/, 1)[0];
}

const VALUE_PROPS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'list', title: `${MODULE_COUNT} modules`, body: `${QUESTION_COUNT} questions` },
  { icon: 'check', title: 'Autosave', body: 'Saves as they type' },
  { icon: 'share', title: 'Private links', body: 'One token, one brief' },
];

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
    <main
      className="pad-safe-x mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-8 sm:py-12"
      style={{ paddingBottom: 'calc(var(--safe-b) + 2rem)' }}
    >
      <div className="mb-6 text-center sm:mb-8">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-spark-500 to-emerald-400 text-3xl font-black text-ink-900 shadow-xl shadow-spark-600/30">
          R
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <h1 className="text-[28px] font-bold tracking-tight text-white sm:text-3xl">RegForge</h1>
          <StorageBadge />
        </div>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
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
          <button
            className="btn-primary w-full text-base"
            type="button"
            onClick={signIn}
            disabled={checking || busy}
            style={{ minHeight: '3rem' }}
          >
            <span className="grid h-5 w-5 place-items-center rounded bg-white text-xs font-bold text-slate-700">
              G
            </span>
            {busy ? 'Opening Google sign-in…' : checking ? 'Checking session…' : 'Continue with Google'}
          </button>
        ) : (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-sm leading-relaxed text-amber-100">
            Add the Firebase web-app configuration to enable Google sign-in. See the setup guide in the
            repository README.
          </div>
        )}

        {email && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
            <span className="min-w-0 truncate">Signed in as {email}</span>
            <button type="button" className="underline hover:no-underline" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-200">
            {error}
          </p>
        )}

        <ul className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
          {VALUE_PROPS.map((item) => (
            <li key={item.title} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-2.5 text-center">
              <span className="mx-auto grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-spark-400">
                <Icon name={item.icon} className="h-4 w-4" />
              </span>
              <p className="mt-1.5 text-[11px] font-semibold leading-tight text-slate-100">{item.title}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="card-pad mt-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Opening a shared questionnaire?</h2>
          <p className="help">
            Direct links open without a workspace sign-in. The link grants access to that one questionnaire
            only; it cannot list or open other workspaces.
          </p>
        </div>
        <form onSubmit={openShared} className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="share-link">
            Questionnaire link or share token
          </label>
          <input
            id="share-link"
            className="input font-mono text-base sm:text-xs"
            placeholder="Paste link or share token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
          />
          <button className="btn-ghost w-full" type="submit">
            Open link
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-500">
        Google Authentication protects workspaces. Shared questionnaire links are scoped to one random
        token, and Firestore rules enforce both boundaries.
      </p>
    </main>
  );
}
