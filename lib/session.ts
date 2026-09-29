/** RegForge — local session marker (which role this browser is holding). */

import { isOwnerEmail, normalizeEmail } from './access';

const KEY = 'regforge.session.v1';

export type Role = 'owner' | 'client';

export interface Session {
  email: string;
  role: Role;
  at: number;
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.email || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSession(email: string, role: Role): Session {
  const session: Session = { email: normalizeEmail(email), role, at: Date.now() };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
  return session;
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function isOwnerSession(): boolean {
  const s = getSession();
  return Boolean(s && s.role === 'owner' && isOwnerEmail(s.email));
}
