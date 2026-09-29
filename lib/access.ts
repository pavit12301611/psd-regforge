/**
 * RegForge — access rules.
 *
 * Vercel-ready: tries ENV vars first, falls back to hard-coded defaults.
 * Vercel pe NEXT_PUBLIC_OWNER_EMAIL aur NEXT_PUBLIC_ACCESS_PIN set kar sakte ho.
 * Agar env nahi hai to default values use hongi (NOT stored in database).
 */
import { ENV } from './env';

export const OWNER_EMAIL = ENV.OWNER_EMAIL || 'pavitsingh1611@gmail.com';
export const ACCESS_PIN = ENV.ACCESS_PIN || '5161211';

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
