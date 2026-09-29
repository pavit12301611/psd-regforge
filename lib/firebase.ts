/**
 * RegForge — Firebase bootstrap (client SDK).
 *
 * VERCEL DEPLOYMENT:
 * Vercel dashboard pe jaake Environment Variables me in naam se keys daal do:
 * - NEXT_PUBLIC_FIREBASE_API_KEY
 * - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 * - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 * - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 * - NEXT_PUBLIC_FIREBASE_APP_ID
 * - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID (optional)
 *
 * Local me .env.local me same naam se daal do. Code lib/env.ts se read karta hai.
 * Firebase optional hai: keys nahi hain to localStorage mode me chalega.
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseEnvConfig, isFirebaseEnvConfigured } from './env';

// Vercel env se config — trim ho ke aata hai lib/env.ts se
const config = {
  apiKey: firebaseEnvConfig.apiKey ?? '',
  authDomain: firebaseEnvConfig.authDomain ?? '',
  projectId: firebaseEnvConfig.projectId ?? '',
  storageBucket: firebaseEnvConfig.storageBucket ?? '',
  messagingSenderId: firebaseEnvConfig.messagingSenderId ?? '',
  appId: firebaseEnvConfig.appId ?? '',
  ...(firebaseEnvConfig.measurementId ? { measurementId: firebaseEnvConfig.measurementId } : {}),
};

// Export for debugging / Vercel check
export const firebaseConfig = config;
export const firebaseConfigured = isFirebaseEnvConfigured;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function boot() {
  if (!firebaseConfigured) return null;
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return { app: app as FirebaseApp, auth: auth as Auth, db: db as Firestore };
}

export function fb() {
  return boot();
}

export function authErrorCode(err: unknown): string {
  return (err as { code?: string })?.code ?? '';
}

export function readableAuthError(err: unknown): string {
  const code = authErrorCode(err);
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Firebase rejected the password for this account. If it already existed with a different password, reset it in the Firebase console (Authentication → Users).';
    case 'auth/email-already-in-use':
      return 'A Firebase account already exists for this email with a different password. Reset it in the Firebase console.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is disabled. Enable it in Firebase console → Authentication → Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network blocked the Firebase request. Check your connection, then retry.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    default:
      return err instanceof Error ? err.message : 'Firebase authentication failed.';
  }
}

/**
 * Owner sign-in. The owner's Firebase password is the access PIN, and the account
 * is created on first login so nothing has to be set up by hand.
 */
export async function ownerSignIn(email: string, password: string): Promise<User | null> {
  const f = fb();
  if (!f) return null;
  try {
    const cred = await signInWithEmailAndPassword(f.auth, email, password);
    return cred.user;
  } catch (err) {
    const code = authErrorCode(err);
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
      try {
        const cred = await createUserWithEmailAndPassword(f.auth, email, password);
        return cred.user;
      } catch (createErr) {
        if (authErrorCode(createErr) === 'auth/email-already-in-use') throw err;
        throw createErr;
      }
    }
    throw err;
  }
}

/** Guests (clients) read/write through the shared link with an anonymous session. */
export async function ensureClientSession(): Promise<User | null> {
  const f = fb();
  if (!f) return null;
  if (f.auth.currentUser) return f.auth.currentUser;
  try {
    const cred = await signInAnonymously(f.auth);
    return cred.user;
  } catch {
    // Anonymous auth may be disabled — the local fallback still works.
    return null;
  }
}

/** Waits until Firebase has restored any persisted session, then makes sure we have one. */
export async function ensureSession(): Promise<User | null> {
  const f = fb();
  if (!f) return null;
  if (f.auth.currentUser) return f.auth.currentUser;
  await new Promise<void>((resolve) => {
    const stop = onAuthStateChanged(f.auth, () => {
      stop();
      resolve();
    });
    setTimeout(() => {
      stop();
      resolve();
    }, 1200);
  });
  if (f.auth.currentUser) return f.auth.currentUser;
  return ensureClientSession();
}

export async function fbSignOut(): Promise<void> {
  const f = fb();
  if (!f) return;
  try {
    await signOut(f.auth);
  } catch {
    /* ignore */
  }
}
