/**
 * RegForge — Centralized ENV handling for Vercel + Local.
 *
 * Vercel pe jaake bas inhi naam ke variables ki value daalni hai:
 * - NEXT_PUBLIC_FIREBASE_API_KEY
 * - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 * - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 * - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 * - NEXT_PUBLIC_FIREBASE_APP_ID
 * - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID (optional)
 * - NEXT_PUBLIC_OWNER_EMAIL (optional, default: pavitsingh1611@gmail.com)
 * - NEXT_PUBLIC_ACCESS_PIN (optional, default: 5161211)
 *
 * Code mein sirf is file se env read hota hai, taaki Vercel pe naam pehle se set ho.
 */

function env(key: string, fallback = ''): string {
  const v = process.env[key];
  if (typeof v === 'string') return v.trim();
  return fallback;
}

export const ENV = {
  // Firebase - REQUIRED for Firebase mode (Vercel pe yahi naam use karne hain)
  FIREBASE_API_KEY: env('NEXT_PUBLIC_FIREBASE_API_KEY'),
  FIREBASE_AUTH_DOMAIN: env('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  FIREBASE_PROJECT_ID: env('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  FIREBASE_STORAGE_BUCKET: env('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  FIREBASE_MESSAGING_SENDER_ID: env('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  FIREBASE_APP_ID: env('NEXT_PUBLIC_FIREBASE_APP_ID'),
  FIREBASE_MEASUREMENT_ID: env('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'),

  // Access - OPTIONAL, Vercel pe override kar sakte ho
  OWNER_EMAIL: env('NEXT_PUBLIC_OWNER_EMAIL', env('OWNER_EMAIL', 'pavitsingh1611@gmail.com')),
  ACCESS_PIN: env('NEXT_PUBLIC_ACCESS_PIN', env('ACCESS_PIN', '5161211')),
} as const;

// Firebase config object ready for initializeApp
export const firebaseEnvConfig = {
  apiKey: ENV.FIREBASE_API_KEY,
  authDomain: ENV.FIREBASE_AUTH_DOMAIN,
  projectId: ENV.FIREBASE_PROJECT_ID,
  storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.FIREBASE_APP_ID,
  ...(ENV.FIREBASE_MEASUREMENT_ID ? { measurementId: ENV.FIREBASE_MEASUREMENT_ID } : {}),
};

// Check if minimum required Firebase keys are present
export const isFirebaseEnvConfigured = Boolean(
  ENV.FIREBASE_API_KEY && ENV.FIREBASE_PROJECT_ID && ENV.FIREBASE_APP_ID
);

// List of env names for Vercel dashboard (bas value daalni hai)
export const VERCEL_ENV_NAMES = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
  'NEXT_PUBLIC_OWNER_EMAIL',
  'NEXT_PUBLIC_ACCESS_PIN',
] as const;
