'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MODULE_COUNT, QUESTION_COUNT } from '@/lib/library';
import { firebaseConfigured } from '@/lib/firebase';
import Sheet from './Sheet';
import Icon from './Icon';

export function storageLabel(): string {
  return firebaseConfigured ? 'Firebase live' : 'Firebase setup needed';
}

/** Short form for narrow phones, where the full label would push the bar wide. */
function storageLabelShort(): string {
  return firebaseConfigured ? 'Live' : 'Setup';
}

export function StorageBadge() {
  return (
    <span
      className={`chip ${firebaseConfigured ? 'chip-on' : 'chip-wait'}`}
      title={
        firebaseConfigured
          ? 'Firebase Authentication + Firestore are configured'
          : 'Add the Firebase web-app configuration to enable the app'
      }
      aria-label={storageLabel()}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span className="hidden sm:inline">{storageLabel()}</span>
      <span className="sm:hidden">{storageLabelShort()}</span>
    </span>
  );
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <Link href="/" className="group flex min-h-[2.75rem] min-w-0 items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-spark-500 to-emerald-400 text-base font-black text-ink-900 shadow-lg shadow-spark-600/30 sm:h-10 sm:w-10 sm:text-lg">
        R
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[15px] font-bold tracking-tight text-white group-hover:text-spark-400 sm:text-base">
          RegForge
        </span>
        {/* On phones the subtitle only steals vertical room. */}
        <span className="hidden truncate text-[11px] text-slate-400 sm:block">
          {subtitle ?? `${MODULE_COUNT} modules · ${QUESTION_COUNT} questions`}
        </span>
      </span>
    </Link>
  );
}

/**
 * Shared sticky header. Fixed height on purpose: sticky offsets elsewhere use
 * `--topbar-h`, so pages can place their own progress bar right underneath.
 */
export function TopBar({
  children,
  storageBadge = true,
}: {
  children?: React.ReactNode;
  storageBadge?: boolean;
}) {
  return (
    <header
      className="pad-safe-x sticky top-0 z-40 border-b border-white/10 bg-ink-900/85 backdrop-blur"
      style={{ paddingTop: 'var(--safe-t)' }}
    >
      <div className="mx-auto flex h-[var(--topbar-h)] max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <Brand />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {children}
          {storageBadge && <StorageBadge />}
        </div>
      </div>
    </header>
  );
}

/**
 * Account control for the workspace header. On phones the sign-out and email
 * live behind a sheet, so the top bar keeps room for the primary action.
 */
export function AccountButton({
  email,
  onSignOut,
  extraActions,
}: {
  email: string;
  onSignOut: () => void;
  extraActions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const initial = (email.trim()[0] ?? 'R').toUpperCase();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-icon"
        aria-label={`Account and settings${email ? ` — signed in as ${email}` : ''}`}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-spark-500 to-emerald-400 text-xs font-black text-ink-900">
          {initial}
        </span>
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Your account"
        description={email || 'Signed in with Google'}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button type="button" className="btn-danger w-full sm:w-auto" onClick={onSignOut}>
              Sign out
            </button>
            <button type="button" className="btn-ghost w-full sm:w-auto" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <dl className="card px-4 py-1">
            <div className="meta-row">
              <dt className="meta-key">Signed in</dt>
              <dd className="meta-value">{email || 'Google account'}</dd>
            </div>
            <div className="meta-row">
              <dt className="meta-key">Storage</dt>
              <dd className="meta-value">{storageLabel()}</dd>
            </div>
            <div className="meta-row">
              <dt className="meta-key">Library</dt>
              <dd className="meta-value">
                {MODULE_COUNT} modules · {QUESTION_COUNT} questions
              </dd>
            </div>
          </dl>

          <p className="help">
            Your questionnaires live in a private workspace keyed to this Google account. Shared client links
            open one questionnaire only.
          </p>

          {extraActions && <div className="flex flex-col gap-2 pt-1">{extraActions}</div>}
        </div>
      </Sheet>
    </>
  );
}
