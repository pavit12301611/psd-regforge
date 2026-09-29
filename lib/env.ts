/**
 * RegForge — Centralized ENV handling for Vercel + Local.
 *
 * You do NOT need to create variables one by one. On Vercel, add ONE variable:
 *   Name:  FIREBASE_CONFIG
 *   Value: paste the Firebase config snippet as-is (apiKey, authDomain, projectId, ...)
 * Or paste a whole .env block into Vercel's Key field. See lib/resolve-env.mjs.
 */

// NOTE: next.config.mjs resolves every accepted variable style (single FIREBASE_CONFIG blob,
// pasted .env, prefixed / un-prefixed names) into NEXT_PUBLIC_REGFORGE_ENV at build time.
// It must be referenced literally so Next.js inlines it into the browser bundle.
type Resolved = Partial<
  Record<
    | 'apiKey'
    | 'authDomain'
    | 'projectId'
    | 'storageBucket'
    | 'messagingSenderId'
    | 'appId'
    | 'measurementId',
    string
  >
>;

function load(): Resolved {
  try {
    return JSON.parse(process.env.NEXT_PUBLIC_REGFORGE_ENV || '{}') as Resolved;
  } catch {
    return {};
  }
}

const R = load();

export const ENV = {
  FIREBASE_API_KEY: R.apiKey ?? '',
  FIREBASE_AUTH_DOMAIN: R.authDomain ?? '',
  FIREBASE_PROJECT_ID: R.projectId ?? '',
  FIREBASE_STORAGE_BUCKET: R.storageBucket ?? '',
  FIREBASE_MESSAGING_SENDER_ID: R.messagingSenderId ?? '',
  FIREBASE_APP_ID: R.appId ?? '',
  FIREBASE_MEASUREMENT_ID: R.measurementId ?? '',

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
] as const;
