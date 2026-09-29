'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon, { type IconName } from './Icon';

/**
 * Sheet — the mobile workhorse of RegForge.
 *
 * On phones it is a bottom sheet (drag handle, safe-area padding, scrollable
 * body, thumb-reachable footer). From 640px up it becomes a centred dialog so
 * the desktop layout is unchanged in spirit. Focus moves into the panel, Tab is
 * trapped inside it, Escape and backdrop taps close it, and the page behind
 * stops scrolling while it is open.
 */
export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** Sticky, always-visible actions (usually the primary button). */
  footer?: React.ReactNode;
  /** Panel width from 640px up. */
  maxWidth?: 'sm' | 'md' | 'lg';
}

const WIDTH: Record<NonNullable<SheetProps['maxWidth']>, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
};

export default function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'sm',
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  /* Lock background scrolling without losing the scroll position. */
  useEffect(() => {
    if (!open) return undefined;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        '[data-autofocus], button:not([disabled]), a[href], input, textarea, select',
      );
      (focusable ?? panelRef.current)?.focus();
    }, 30);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      restoreFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="sheet-backdrop absolute inset-0 h-full w-full cursor-default bg-black/65 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`sheet-panel relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10
          bg-ink-800 shadow-2xl shadow-black/60 outline-none sm:max-h-[85dvh] sm:rounded-2xl ${WIDTH[maxWidth]}`}
        style={{ paddingBottom: 'var(--safe-b)' }}
      >
        {/* Drag affordance on phones. */}
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/20 sm:hidden" aria-hidden />

        <header className="flex items-start gap-3 px-4 pb-3 pt-3 sm:px-5 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold leading-snug text-white">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-slate-400">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-spark-400/70"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-white/10 bg-ink-800/95 px-4 pb-3 pt-3 sm:px-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* --------------------------------------------------------------- action list */

export interface SheetAction {
  id: string;
  label: string;
  hint?: string;
  icon?: IconName;
  tone?: 'default' | 'primary' | 'danger';
  onSelect: () => void;
}

const ACTION_TONE: Record<NonNullable<SheetAction['tone']>, string> = {
  default: 'text-slate-100 hover:bg-white/[0.07]',
  primary: 'text-white hover:bg-spark-500/20',
  danger: 'text-rose-200 hover:bg-rose-500/15',
};

/** Full-width, 56px-tall rows — the standard phone action list. */
export function ActionList({ actions }: { actions: SheetAction[] }) {
  return (
    <ul className="-mx-1 space-y-1">
      {actions.map((action) => (
        <li key={action.id}>
          <button
            type="button"
            onClick={action.onSelect}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-spark-400/70 ${ACTION_TONE[action.tone ?? 'default']}`}
            style={{ minHeight: '3.25rem' }}
          >
            {action.icon && (
              <span className="grid w-6 shrink-0 place-items-center text-slate-300">
                <Icon name={action.icon} className="h-[18px] w-[18px]" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{action.label}</span>
              {action.hint && <span className="mt-0.5 block text-xs font-normal text-slate-400">{action.hint}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------------- confirm */

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

/**
 * Promise-based confirmation sheet, so call sites read like `window.confirm`
 * but get a real, thumb-sized dialog on phones.
 */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setRequest(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setRequest(null);
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  const element = (
    <Sheet
      open={Boolean(request)}
      onClose={() => settle(false)}
      title={request?.title ?? 'Are you sure?'}
      description={request?.body}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
          <button
            type="button"
            data-autofocus
            className={`w-full sm:w-auto ${request?.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => settle(true)}
          >
            {request?.confirmLabel ?? 'Confirm'}
          </button>
          <button type="button" className="btn-ghost w-full sm:w-auto" onClick={() => settle(false)}>
            {request?.cancelLabel ?? 'Cancel'}
          </button>
        </div>
      }
    />
  );

  return { confirm, element };
}
