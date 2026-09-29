/** Shared non-secret helpers for RegForge. Admin authorization lives in Firebase. */

export const BRAND = 'RegForge';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
