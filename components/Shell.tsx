'use client';

import Link from 'next/link';
import { MODULE_COUNT, QUESTION_COUNT } from '@/lib/library';
import { firebaseConfigured } from '@/lib/firebase';

export function storageLabel(): string {
  return firebaseConfigured ? 'Firebase live' : 'Firebase setup needed';
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
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {storageLabel()}
    </span>
  );
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-spark-500 to-emerald-400 text-lg font-black text-ink-900 shadow-lg shadow-spark-600/30">
        R
      </span>
      <span className="leading-tight">
        <span className="block text-base font-bold tracking-tight text-white group-hover:text-spark-400">
          RegForge
        </span>
        <span className="block text-[11px] text-slate-400">
          {subtitle ?? `${MODULE_COUNT} modules · ${QUESTION_COUNT} questions`}
        </span>
      </span>
    </Link>
  );
}

export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Brand />
        <div className="flex items-center gap-2">
          {children}
          <StorageBadge />
        </div>
      </div>
    </header>
  );
}
