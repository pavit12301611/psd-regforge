'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100',
  error: 'border-rose-400/40 bg-rose-500/15 text-rose-100',
  info: 'border-white/[0.16] bg-ink-700/95 text-slate-100',
};

const TONE_ICON: Record<ToastTone, 'check' | 'close' | 'spark'> = {
  success: 'check',
  error: 'close',
  info: 'spark',
};

/** Small toast queue with auto-dismiss; used for copy/download/delete feedback. */
export function useToasts(timeout = 3600) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      const handle = window.setTimeout(() => dismiss(id), timeout);
      timers.current.push(handle);
      return id;
    },
    [dismiss, timeout],
  );

  useEffect(
    () => () => {
      timers.current.forEach((handle) => window.clearTimeout(handle));
      timers.current = [];
    },
    [],
  );

  return { toasts, push, dismiss };
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (!toasts.length) return null;
  return (
    <div
      aria-live="polite"
      role="status"
      className="toast-stack pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-3 sm:items-end sm:px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-3.5 py-3 text-sm shadow-xl shadow-black/40 backdrop-blur ${TONE_CLASS[toast.tone]}`}
        >
          <span
            aria-hidden
            className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-black/20"
          >
            <Icon name={TONE_ICON[toast.tone]} className="h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
          <span className="flex-1 break-words leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="Dismiss notification"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
