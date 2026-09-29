/**
 * RegForge — access rules.
 *
 * Hard-coded by design (NOT stored in the database):
 *   • the owner email below gets in without the PIN
 *   • the PIN below opens the owner dashboard
 */

export const OWNER_EMAIL = 'pavitsingh1611@gmail.com';
export const ACCESS_PIN = '5161211';

export const BRAND = 'RegForge';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isOwnerEmail(email: string): boolean {
  return normalizeEmail(email) === OWNER_EMAIL;
}

export function isCorrectPin(pin: string): boolean {
  return pin.trim() === ACCESS_PIN;
}
